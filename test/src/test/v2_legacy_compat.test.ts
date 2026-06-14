import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Protocol } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
    CallToolResultSchema,
    CancelTaskResultSchema,
    ClientCapabilities,
    CompleteResultSchema,
    CreateTaskResultSchema,
    EmptyResultSchema,
    ErrorCode,
    GetTaskResultSchema,
    Implementation,
    InitializeResultSchema,
    ListTasksResultSchema,
    ReadResourceResultSchema,
    SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";
import { getEndpointUrl } from "./config.js";

const legacyV2Server = process.env.MCP_V2_LEGACY_ENDPOINT ?? "/test/test_v2";
const legacyWorkflowServer = process.env.MCP_V2_WORKFLOW_ENDPOINT ?? "/demo/demo_v2_workflow";
const legacyProtocolVersions = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
const taskId = "00000000000000000000000000000001";
const inputRequiredTaskId = "00000000000000000000000000000002";
const failedTaskId = "00000000000000000000000000000003";

type LegacyProtocolVersion = (typeof legacyProtocolVersions)[number];
type InternalClient = {
    _clientInfo: Implementation;
    _capabilities: ClientCapabilities;
    _serverCapabilities?: unknown;
    _serverVersion?: unknown;
    _instructions?: string;
};

async function connectWithProtocol(
    client: Client,
    transport: StreamableHTTPClientTransport,
    protocolVersion: LegacyProtocolVersion,
): Promise<void> {
    await Protocol.prototype.connect.call(client, transport);

    try {
        const internal = client as unknown as InternalClient;
        const result = await client.request(
            {
                method: "initialize",
                params: {
                    protocolVersion,
                    capabilities: internal._capabilities,
                    clientInfo: internal._clientInfo,
                },
            },
            InitializeResultSchema,
        );

        if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
            throw new Error(`Server's protocol version is not supported: ${result.protocolVersion}`);
        }

        internal._serverCapabilities = result.capabilities;
        internal._serverVersion = result.serverInfo;
        internal._instructions = result.instructions;
        transport.setProtocolVersion(result.protocolVersion);

        await client.notification({ method: "notifications/initialized" });
    } catch (error) {
        await client.close();
        throw error;
    }
}

async function createClient(protocolVersion: LegacyProtocolVersion): Promise<{
    client: Client;
    transport: StreamableHTTPClientTransport;
}>;
async function createClient(
    protocolVersion: LegacyProtocolVersion,
    serverPath: string,
): Promise<{
    client: Client;
    transport: StreamableHTTPClientTransport;
}>;
async function createClient(
    protocolVersion: LegacyProtocolVersion,
    serverPath = legacyV2Server,
): Promise<{
    client: Client;
    transport: StreamableHTTPClientTransport;
}> {
    const client = new Client(
        {
            name: `legacy-v2-compat-${protocolVersion}`,
            version: "1.0.0",
        },
        {
            capabilities: {
                tasks: {
                    list: {},
                    cancel: {},
                },
            },
        },
    );

    const transport = new StreamableHTTPClientTransport(getEndpointUrl(serverPath));
    await connectWithProtocol(client, transport, protocolVersion);
    return { client, transport };
}

async function withClient<T>(
    protocolVersion: LegacyProtocolVersion,
    run: (client: Client, transport: StreamableHTTPClientTransport) => Promise<T> | T,
    serverPath = legacyV2Server,
): Promise<T> {
    const { client, transport } = await createClient(protocolVersion, serverPath);
    try {
        return await run(client, transport);
    } finally {
        await client.close();
    }
}

describe("MCP v2 server legacy SDK compatibility", () => {
    describe.each(legacyProtocolVersions)("protocol %s", protocolVersion => {
        let client: Client;
        let transport: StreamableHTTPClientTransport;

        beforeEach(async () => {
            ({ client, transport } = await createClient(protocolVersion));
        });

        afterEach(async () => {
            await client?.close();
        });

        test("initializes statelessly without an MCP session", () => {
            expect(transport.protocolVersion).toBe(protocolVersion);
            expect(transport.sessionId).toBeUndefined();
            expect(client.getServerVersion()?.name).toBeDefined();
            expect(client.getServerCapabilities()).toMatchObject({
                tools: expect.any(Object),
            });
        });

        test("responds to ping", async () => {
            await expect(client.ping()).resolves.toEqual({});
        });

        test("lists and calls tools through the legacy SDK shape", async () => {
            const tools = (await client.listTools()).tools;
            const echo = tools.find(tool => tool.name === "echo");

            expect(echo).toBeDefined();
            expect(echo?.inputSchema.properties).toHaveProperty("message");

            const result = await client.callTool({
                name: "echo",
                arguments: {
                    message: `hello ${protocolVersion}`,
                },
            });

            expect(result.isError).toBe(false);
            expect(result.content).toEqual([
                {
                    type: "text",
                    text: `hello ${protocolVersion}`,
                },
            ]);
        });

        test("serves prompts, resources, templates, and completions", async () => {
            const prompts = (await client.listPrompts()).prompts;
            expect(prompts.map(prompt => prompt.name)).toContain("v2_prompt");

            const prompt = await client.getPrompt({
                name: "v2_prompt",
                arguments: {
                    topic: "legacy",
                },
            });
            expect(prompt.messages[0].content).toMatchObject({
                type: "text",
                text: "Create a short response about legacy.",
            });

            const resources = (await client.listResources()).resources;
            expect(resources.map(resource => resource.uri)).toContain("test://v2/resource");

            const templates = (await client.listResourceTemplates()).resourceTemplates;
            expect(templates.map(template => template.uriTemplate)).toContain("test://v2/{name}");

            const read = await client.readResource({ uri: "test://v2/resource" });
            expect(read.contents).toEqual([
                {
                    uri: "test://v2/resource",
                    mimeType: "text/plain",
                    text: "Resource content from ABAP v2 test server.",
                },
            ]);

            const completion = await client.complete({
                ref: {
                    type: "ref/prompt",
                    name: "v2_prompt",
                },
                argument: {
                    name: "topic",
                    value: "dr",
                },
            });
            expect(completion.completion.values).toEqual(["draft", "drilldown"]);
        });

        test("creates task results through tools/call regardless of legacy protocol version", async () => {
            const created = await client.request(
                {
                    method: "tools/call",
                    params: {
                        name: "start_task",
                    },
                },
                CreateTaskResultSchema,
                {
                    task: { ttl: 60_000 },
                    timeout: 10_000,
                },
            );

            expect(created.task.taskId).toBe(taskId);
            expect(created.task.status).toBe("working");
            expect(created.task.ttl).toBe(60_000);
            expect(created.task.pollInterval).toBe(1_000);
        });

        test("reads terminal task state through the legacy task shape", async () => {
            const task = await client.request(
                {
                    method: "tasks/get",
                    params: {
                        taskId,
                    },
                },
                GetTaskResultSchema,
            );

            expect(task.taskId).toBe(taskId);
            expect(task.status).toBe("completed");
            expect(task.statusMessage).toBe("Task completed.");
            expect(task.ttl ?? null).toBeNull();
        });

        test("reads terminal task result payload", async () => {
            const result = await client.request(
                {
                    method: "tasks/result",
                    params: {
                        taskId,
                    },
                },
                CallToolResultSchema,
            );

            expect(result.content).toEqual([
                {
                    type: "text",
                    text: "Task result from ABAP v2 test server.",
                },
            ]);
        });

        test("handles tasks/list in stateless compatibility mode", async () => {
            const list = await client.request(
                {
                    method: "tasks/list",
                    params: {},
                },
                ListTasksResultSchema,
            );

            expect(Array.isArray(list.tasks)).toBe(true);
            expect(list.tasks.every(task => task.status !== "input_required")).toBe(true);
        });

    });

    test("v2 cache hints and result metadata are stripped for legacy tool clients", async () => {
        await withClient("2025-11-25", async client => {
            const result = await client.callTool({ name: "cache_meta" });

            expect(result.content).toEqual([
                {
                    type: "text",
                    text: "Cacheable v2 result with metadata.",
                },
            ]);
            expect(result).not.toHaveProperty("resultType");
            expect(result).not.toHaveProperty("ttlMs");
            expect(result).not.toHaveProperty("cacheScope");
            expect(result._meta).toMatchObject({
                "abap.test/trace": "cache-meta",
            });
        });
    });

    test("v2 zero-cache hints are stripped for legacy tool clients", async () => {
        await withClient("2025-11-25", async client => {
            const result = await client.callTool({ name: "cache_zero" });

            expect(result.content).toEqual([
                {
                    type: "text",
                    text: "Zero-cache v2 result.",
                },
            ]);
            expect(result).not.toHaveProperty("ttlMs");
            expect(result).not.toHaveProperty("cacheScope");
        });
    });

    test("unknown tools return method-not-found", async () => {
        await withClient("2025-11-25", async client => {
            await expect(client.callTool({ name: "missing_tool" })).rejects.toMatchObject({
                code: ErrorCode.MethodNotFound,
            });
        });
    });

    test("unknown resources return resource-not-found", async () => {
        await withClient("2025-11-25", async client => {
            await expect(client.readResource({ uri: "test://v2/missing" })).rejects.toMatchObject({
                code: -32002,
            });
        });
    });

    test("input-required task states fail explicitly for legacy clients", async () => {
        await withClient("2025-11-25", async client => {
            await expect(
                client.request(
                    {
                        method: "tasks/get",
                        params: {
                            taskId: inputRequiredTaskId,
                        },
                    },
                    GetTaskResultSchema,
                ),
            ).rejects.toMatchObject({
                code: ErrorCode.InvalidParams,
            });
        });
    });

    test("input-required task results fail explicitly for legacy clients", async () => {
        await withClient("2025-11-25", async client => {
            await expect(
                client.request(
                    {
                        method: "tasks/result",
                        params: {
                            taskId: inputRequiredTaskId,
                        },
                    },
                    CallToolResultSchema,
                ),
            ).rejects.toMatchObject({
                code: ErrorCode.InvalidParams,
            });
        });
    });

    test("failed task results map to JSON-RPC errors", async () => {
        await withClient("2025-11-25", async client => {
            await expect(
                client.request(
                    {
                        method: "tasks/result",
                        params: {
                            taskId: failedTaskId,
                        },
                    },
                    CallToolResultSchema,
                ),
            ).rejects.toMatchObject({
                code: ErrorCode.InternalError,
            });
        });
    });

    test("v2 multi-round-trip tool results fail explicitly for legacy clients", async () => {
        await withClient("2025-11-25", async client => {
            await expect(client.callTool({ name: "needs_input" })).rejects.toMatchObject({
                code: ErrorCode.InvalidRequest,
            });
        });
    });

    test("workflow demo direct MRTR still fails explicitly for legacy clients", async () => {
        await withClient(
            "2025-11-25",
            async client => {
                await expect(
                    client.callTool({
                        name: "approval_required",
                        arguments: {
                            reason: "legacy inspector check",
                        },
                    }),
                ).rejects.toMatchObject({
                    code: ErrorCode.InvalidRequest,
                });
            },
            legacyWorkflowServer,
        );
    });

    test("workflow demo persisted input task can be completed through legacy tasks/update", async () => {
        await withClient(
            "2025-11-25",
            async client => {
                const created = await client.request(
                    {
                        method: "tools/call",
                        params: {
                            name: "start_input_task",
                        },
                    },
                    CreateTaskResultSchema,
                    {
                        task: { ttl: 60_000 },
                        timeout: 10_000,
                    },
                );

                expect(created.task.taskId).toMatch(/^[0-9A-F]{32}$/);
                expect(created.task.status).toBe("working");
                expect(created.task.pollInterval).toBe(1_000);

                await expect(
                    client.request(
                        {
                            method: "tasks/update",
                            params: {
                                taskId: created.task.taskId,
                                inputResponses: {
                                    confirm: {
                                        action: "accept",
                                        content: {
                                            approved: true,
                                            comment: "legacy task update",
                                        },
                                    },
                                },
                            },
                        },
                        EmptyResultSchema,
                    ),
                ).resolves.toEqual({});

                const task = await client.request(
                    {
                        method: "tasks/get",
                        params: {
                            taskId: created.task.taskId,
                        },
                    },
                    GetTaskResultSchema,
                );

                expect(task.status).toBe("completed");
                expect(task.statusMessage).toBe("Task completed from tasks/update input.");

                const result = await client.request(
                    {
                        method: "tasks/result",
                        params: {
                            taskId: created.task.taskId,
                        },
                    },
                    CallToolResultSchema,
                );

                expect(result.content[0]).toMatchObject({
                    type: "text",
                    text: "Persisted task completed. Approved=true, comment=legacy task update.",
                });
            },
            legacyWorkflowServer,
        );
    });

    test("workflow demo persisted input task accepts flat legacy tasks/update input", async () => {
        await withClient(
            "2025-11-25",
            async client => {
                const created = await client.request(
                    {
                        method: "tools/call",
                        params: {
                            name: "start_input_task",
                        },
                    },
                    CreateTaskResultSchema,
                    {
                        task: { ttl: 60_000 },
                        timeout: 10_000,
                    },
                );

                await expect(
                    client.request(
                        {
                            method: "tasks/update",
                            params: {
                                taskId: created.task.taskId,
                                approved: true,
                                comment: "flat legacy update",
                            },
                        },
                        EmptyResultSchema,
                    ),
                ).resolves.toEqual({});

                const result = await client.request(
                    {
                        method: "tasks/result",
                        params: {
                            taskId: created.task.taskId,
                        },
                    },
                    CallToolResultSchema,
                );

                expect(result.content[0]).toMatchObject({
                    type: "text",
                    text: "Persisted task completed. Approved=true, comment=flat legacy update.",
                });
            },
            legacyWorkflowServer,
        );
    });

    test("workflow demo delayed task can be cancelled through the legacy task shape", async () => {
        await withClient(
            "2025-11-25",
            async client => {
                const created = await client.request(
                    {
                        method: "tools/call",
                        params: {
                            name: "start_delayed_task",
                            arguments: {
                                value: 5,
                            },
                            task: {
                                ttl: 300000,
                            },
                        },
                    },
                    CreateTaskResultSchema,
                    {
                        task: { ttl: 300000 },
                        timeout: 10_000,
                    },
                );

                expect(created.task.status).toBe("working");
                expect(created.task.statusMessage).toBe("Delayed background task is running.");

                const cancelled = await client.request(
                    {
                        method: "tasks/cancel",
                        params: {
                            taskId: created.task.taskId,
                        },
                    },
                    CancelTaskResultSchema,
                );

                expect(cancelled.taskId).toBe(created.task.taskId);
                expect(cancelled.status).toBe("cancelled");
                expect(cancelled.pollInterval).toBe(5000);

                await expect(
                    client.request(
                        {
                            method: "tasks/result",
                            params: {
                                taskId: created.task.taskId,
                            },
                        },
                        CallToolResultSchema,
                    ),
                ).rejects.toMatchObject({
                    code: ErrorCode.InternalError,
                });
            },
            legacyWorkflowServer,
        );
    });

    test("unsupported legacy protocol versions fail during initialization", async () => {
        const client = new Client({ name: "legacy-v2-compat-unsupported", version: "1.0.0" });
        const transport = new StreamableHTTPClientTransport(getEndpointUrl(legacyV2Server));

        await expect(
            connectWithProtocol(client, transport, "2099-01-01" as LegacyProtocolVersion),
        ).rejects.toThrow();
    });

    test("legacy clients cannot use draft-only server/discover", async () => {
        await withClient("2025-11-25", async client => {
            await expect(
                client.request(
                    {
                        method: "server/discover",
                        params: {},
                    },
                    CompleteResultSchema,
                ),
            ).rejects.toMatchObject({
                code: 400,
            });
        });
    });

    test("legacy clients cannot use draft-only tools/get_input_schema", async () => {
        await withClient("2025-11-25", async client => {
            await expect(
                client.request(
                    {
                        method: "tools/get_input_schema",
                        params: {
                            name: "echo",
                        },
                    },
                    CompleteResultSchema,
                ),
            ).rejects.toMatchObject({
                code: ErrorCode.MethodNotFound,
            });
        });
    });

    test("stateless subscription methods are unsupported", async () => {
        await withClient("2025-11-25", async client => {
            await expect(
                client.request(
                    {
                        method: "resources/subscribe",
                        params: {
                            uri: "test://v2/resource",
                        },
                    },
                    EmptyResultSchema,
                ),
            ).rejects.toMatchObject({
                code: ErrorCode.MethodNotFound,
            });

            await expect(
                client.request(
                    {
                        method: "resources/unsubscribe",
                        params: {
                            uri: "test://v2/resource",
                        },
                    },
                    EmptyResultSchema,
                ),
            ).rejects.toMatchObject({
                code: ErrorCode.MethodNotFound,
            });
        });
    });

    test("logging/setLevel is unsupported when the v2 server does not declare logging", async () => {
        await withClient("2025-11-25", async client => {
            await expect(
                client.request(
                    {
                        method: "logging/setLevel",
                        params: {
                            level: "debug",
                        },
                    },
                    EmptyResultSchema,
                ),
            ).rejects.toMatchObject({
                code: ErrorCode.MethodNotFound,
            });
        });
    });

    test("server-side sampling and roots requests are not legacy client-to-server methods", async () => {
        await withClient("2025-11-25", async client => {
            await expect(
                client.request(
                    {
                        method: "sampling/createMessage",
                        params: {
                            messages: [],
                            maxTokens: 1,
                        },
                    },
                    EmptyResultSchema,
                ),
            ).rejects.toMatchObject({
                code: ErrorCode.MethodNotFound,
            });

            await expect(
                client.request(
                    {
                        method: "roots/list",
                        params: {},
                    },
                    EmptyResultSchema,
                ),
            ).rejects.toMatchObject({
                code: ErrorCode.MethodNotFound,
            });
        });
    });
});
