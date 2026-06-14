import { getEndpointUrl } from "./config.js";

const draftProtocolVersion = "2026-07-28";
const v2Server = "/test/test_v2";
const demoV2BasicServer = process.env.MCP_V2_BASIC_ENDPOINT ?? "/demo/demo_v2_basic";
const demoV2WorkflowServer = process.env.MCP_V2_WORKFLOW_ENDPOINT ?? "/demo/demo_v2_workflow";
const taskId = "00000000000000000000000000000001";
const taskInputRequiredId = "00000000000000000000000000000002";
const taskErrorId = "00000000000000000000000000000003";
const persistedTaskTool = "start_persisted_input_task";
const allowedOrigin = "https://client.example";
const disallowedOrigin = "https://attacker.invalid";

type JsonObject = Record<string, unknown>;

const jsonHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Mcp-Protocol-Version": draftProtocolVersion,
};

function endpoint(serverPath = v2Server): URL {
    return getEndpointUrl(serverPath);
}

function modernMeta(includeTasks = false): JsonObject {
    const clientCapabilities: JsonObject = {};

    if (includeTasks) {
        clientCapabilities.extensions = {
            "io.modelcontextprotocol/tasks": {},
        };
    }

    return {
        "io.modelcontextprotocol/protocolVersion": draftProtocolVersion,
        "io.modelcontextprotocol/clientInfo": {
            name: "raw-v2-test-client",
            version: "1.0.0",
        },
        "io.modelcontextprotocol/clientCapabilities": clientCapabilities,
    };
}

function request(id: string, method: string, params: JsonObject = {}, includeTasks = false): JsonObject {
    return {
        jsonrpc: "2.0",
        id,
        method,
        params: {
            ...params,
            _meta: modernMeta(includeTasks),
        },
    };
}

function mirroredHeaders(body: JsonObject, headers: Record<string, string> = {}): Record<string, string> {
    const result: Record<string, string> = {
        ...jsonHeaders,
        ...headers,
    };

    if (typeof body.method === "string" && !("Mcp-Method" in headers)) {
        result["Mcp-Method"] = body.method;
    }

    const params = body.params;
    if (params && typeof params === "object" && !Array.isArray(params) && !("Mcp-Name" in headers)) {
        const typedParams = params as JsonObject;

        if (
            (body.method === "tools/call" || body.method === "prompts/get") &&
            typeof typedParams.name === "string"
        ) {
            result["Mcp-Name"] = typedParams.name;
        }

        if (body.method === "resources/read" && typeof typedParams.uri === "string") {
            result["Mcp-Name"] = typedParams.uri;
        }
    }

    return result;
}

async function postJson(
    body: JsonObject,
    headers: Record<string, string> = {},
    serverPath = v2Server,
): Promise<Response> {
    return fetch(endpoint(serverPath), {
        method: "POST",
        headers: mirroredHeaders(body, headers),
        body: JSON.stringify(body),
    });
}

async function postRawJson(body: JsonObject, headers: Record<string, string>): Promise<Response> {
    return fetch(endpoint(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
}

async function readJson(response: Response): Promise<JsonObject> {
    return (await response.json()) as JsonObject;
}

function resultOf(message: JsonObject): JsonObject {
    const result = message.result;
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    return result as JsonObject;
}

function errorOf(message: JsonObject): JsonObject {
    const error = message.error;
    expect(error).toBeDefined();
    expect(typeof error).toBe("object");
    return error as JsonObject;
}

async function getNeedsInputState(): Promise<string> {
    const response = await postJson(
        request("mrtr-state-helper-1", "tools/call", {
            name: "needs_input",
        }),
    );

    expect(response.status).toBe(200);

    const result = resultOf(await readJson(response));
    expect(typeof result.requestState).toBe("string");
    return result.requestState as string;
}

async function getTaskInputState(): Promise<string> {
    const response = await postJson(
        request(
            "task-state-helper-1",
            "tasks/get",
            {
                taskId: taskInputRequiredId,
            },
            true,
        ),
    );

    expect(response.status).toBe(200);

    const result = resultOf(await readJson(response));
    expect(typeof result.requestState).toBe("string");
    return result.requestState as string;
}

describe("MCP draft v2 raw HTTP tests", () => {
    test("notifications return 202 Accepted without a JSON-RPC response body", async () => {
        const body = {
            jsonrpc: "2.0",
            method: "notifications/initialized",
            params: {
                _meta: modernMeta(),
            },
        };

        const response = await postJson(body);

        expect(response.status).toBe(202);
        expect(await response.text()).toBe("");
    });

    test("modern notifications require Mcp-Protocol-Version", async () => {
        const response = await postRawJson(
            {
                jsonrpc: "2.0",
                method: "notifications/initialized",
                params: {
                    _meta: modernMeta(),
                },
            },
            {
                "Content-Type": "application/json",
                Accept: "application/json",
                "Mcp-Method": "notifications/initialized",
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Protocol-Version");
    });

    test("modern notifications require Mcp-Method", async () => {
        const response = await postRawJson(
            {
                jsonrpc: "2.0",
                method: "notifications/initialized",
                params: {
                    _meta: modernMeta(),
                },
            },
            {
                "Content-Type": "application/json",
                Accept: "application/json",
                "Mcp-Protocol-Version": draftProtocolVersion,
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Method");
    });

    test("modern notifications reject mismatched Mcp-Method", async () => {
        const response = await postRawJson(
            {
                jsonrpc: "2.0",
                method: "notifications/initialized",
                params: {
                    _meta: modernMeta(),
                },
            },
            {
                "Content-Type": "application/json",
                Accept: "application/json",
                "Mcp-Protocol-Version": draftProtocolVersion,
                "Mcp-Method": "tools/list",
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Method");
    });

    test("modern client-sent JSON-RPC responses are invalid requests", async () => {
        const response = await postRawJson(
            {
                jsonrpc: "2.0",
                id: "client-response-1",
                result: {},
            },
            {
                "Content-Type": "application/json",
                Accept: "application/json",
                "Mcp-Protocol-Version": draftProtocolVersion,
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32600);
    });

    test("unknown modern methods return HTTP 404 with JSON-RPC method_not_found", async () => {
        const response = await postJson(request("unknown-method-1", "unknown/method"));

        expect(response.status).toBe(404);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32601);
        expect(String(error.message)).toContain("unknown/method");
    });

    test("GET is rejected on the v2-only endpoint", async () => {
        const response = await fetch(endpoint(), {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        });

        expect(response.status).toBe(405);
        expect(response.headers.get("allow")).toBe("POST, OPTIONS");
        expect(response.headers.get("mcp-session-id")).toBeNull();
    });

    test("DELETE is rejected on the v2-only endpoint", async () => {
        const response = await fetch(endpoint(), {
            method: "DELETE",
            headers: {
                Accept: "application/json",
            },
        });

        expect(response.status).toBe(405);
        expect(response.headers.get("allow")).toBe("POST, OPTIONS");
        expect(response.headers.get("mcp-session-id")).toBeNull();
    });

    test("v2-only CORS preflight advertises modern methods and headers", async () => {
        const response = await fetch(endpoint(), {
            method: "OPTIONS",
            headers: {
                Origin: allowedOrigin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type, Mcp-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Param-Value, X-Not-Allowed",
            },
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("allow")).toBe("POST, OPTIONS");
        expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");

        const allowHeaders = response.headers.get("access-control-allow-headers") ?? "";
        expect(allowHeaders).toContain("Content-Type");
        expect(allowHeaders).toContain("Mcp-Protocol-Version");
        expect(allowHeaders).toContain("Mcp-Method");
        expect(allowHeaders).toContain("Mcp-Name");
        expect(allowHeaders).toContain("Mcp-Param-Value");
        expect(allowHeaders).not.toContain("X-Not-Allowed");
    });

    test("v2 POST with an allowed Origin echoes CORS headers", async () => {
        const response = await postJson(
            request("origin-allowed-1", "server/discover", {}, true),
            {
                Origin: allowedOrigin,
            },
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("access-control-allow-origin")).toBe(allowedOrigin);
        expect(response.headers.get("vary")).toContain("Origin");

        const exposedHeaders = response.headers.get("access-control-expose-headers") ?? "";
        expect(exposedHeaders).toContain("Mcp-Protocol-Version");
    });

    test("v2 POST rejects a disallowed Origin", async () => {
        const response = await postJson(
            request("origin-rejected-1", "server/discover", {}, true),
            {
                Origin: disallowedOrigin,
            },
        );

        expect(response.status).toBe(403);
        expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });

    test("server/discover returns draft metadata without creating a legacy session", async () => {
        const response = await postJson(request("discover-1", "server/discover", {}, true));

        expect(response.status).toBe(200);
        expect(response.headers.get("mcp-protocol-version")).toBe(draftProtocolVersion);
        expect(response.headers.get("mcp-session-id")).toBeNull();

        const message = await readJson(response);
        expect(message.id).toBe("discover-1");

        const result = resultOf(message);
        expect(result.resultType).toBe("complete");
        expect(result.supportedVersions).toEqual([draftProtocolVersion]);
        expect(result.ttlMs).toBe(0);
        expect(result.cacheScope).toBe("private");

        const serverInfo = result.serverInfo as JsonObject;
        expect(serverInfo.name).toBe("ABAP MCP Draft V2 Test Server");

        const capabilities = result.capabilities as JsonObject;
        expect(capabilities.tools).toEqual({});
        expect(capabilities.extensions).toEqual({
            "io.modelcontextprotocol/tasks": {},
        });
    });

    test("missing draft request metadata returns invalid params", async () => {
        const response = await postJson({
            jsonrpc: "2.0",
            id: "missing-meta-1",
            method: "server/discover",
            params: {},
        });

        expect(response.status).toBe(400);

        const message = await readJson(response);
        const error = errorOf(message);
        expect(error.code).toBe(-32602);
        expect(String(error.message)).toContain("io.modelcontextprotocol/protocolVersion");
    });

    test("modern requests require Mcp-Protocol-Version", async () => {
        const response = await postRawJson(
            request("missing-protocol-header-1", "server/discover"),
            {
                "Content-Type": "application/json",
                Accept: "application/json",
                "Mcp-Method": "server/discover",
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Protocol-Version");
    });

    test("mismatched protocol header and metadata returns header mismatch", async () => {
        const response = await postJson(
            request("mismatch-1", "server/discover"),
            {
                ...jsonHeaders,
                "Mcp-Protocol-Version": "2026-07-27",
            },
        );

        expect(response.status).toBe(400);

        const message = await readJson(response);
        const error = errorOf(message);
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Protocol-Version mismatch");
    });

    test("unsupported draft protocol version returns unsupported protocol error", async () => {
        const response = await postJson(
            {
                jsonrpc: "2.0",
                id: "unsupported-protocol-1",
                method: "server/discover",
                params: {
                    _meta: {
                        ...modernMeta(),
                        "io.modelcontextprotocol/protocolVersion": "2099-01-01",
                    },
                },
            },
            {
                ...jsonHeaders,
                "Mcp-Protocol-Version": "2099-01-01",
            },
        );

        expect(response.status).toBe(400);

        const message = await readJson(response);
        const error = errorOf(message);
        expect(error.code).toBe(-32004);
        expect(String(error.message)).toContain("Unsupported protocol version 2099-01-01");
        expect(error.data).toEqual({
            supported: [draftProtocolVersion],
            requested: "2099-01-01",
        });
    });

    test("mismatched Mcp-Method header returns header mismatch", async () => {
        const response = await postJson(
            request("method-header-mismatch-1", "tools/list"),
            {
                "Mcp-Method": "tools/call",
            },
        );

        expect(response.status).toBe(400);

        const message = await readJson(response);
        const error = errorOf(message);
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Method");
    });

    test("mismatched Mcp-Name header returns header mismatch", async () => {
        const response = await postJson(
            request("name-header-mismatch-1", "tools/call", {
                name: "echo",
                arguments: {
                    message: "hello v2",
                },
            }),
            {
                "Mcp-Name": "cache_meta",
            },
        );

        expect(response.status).toBe(400);

        const message = await readJson(response);
        const error = errorOf(message);
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Name");
    });

    test("tools/list returns v2 test tools", async () => {
        const response = await postJson(request("tools-1", "tools/list"));

        expect(response.status).toBe(200);

        const message = await readJson(response);
        const result = resultOf(message);
        const tools = result.tools as JsonObject[];

        expect(tools).toHaveLength(14);
        expect(tools.map((tool) => tool.name)).toEqual([
            "echo",
            "header_string",
            "header_integer",
            "header_boolean",
            "needs_input",
            "start_task",
            "start_unguarded_task",
            persistedTaskTool,
            "cache_meta",
            "cache_zero",
            "bad_header_duplicate",
            "bad_header_token",
            "bad_header_number",
            "bad_header_nested",
        ]);

        const taskTool = tools.find((tool) => tool.name === "start_task");
        expect(taskTool?.execution).toEqual({ taskSupport: "optional" });

        const unguardedTaskTool = tools.find((tool) => tool.name === "start_unguarded_task");
        expect(unguardedTaskTool?.execution).toEqual({ taskSupport: "optional" });

        const persistedTaskToolDef = tools.find((tool) => tool.name === persistedTaskTool);
        expect(persistedTaskToolDef?.execution).toEqual({ taskSupport: "optional" });

        const echoTool = tools.find((tool) => tool.name === "echo");
        const echoInputSchema = echoTool?.inputSchema as JsonObject;
        const echoProperties = echoInputSchema.properties as JsonObject;
        const messageProperty = echoProperties.message as JsonObject;
        expect(messageProperty["x-mcp-header"]).toBe("Message");
    });

    test("demo basic tools/list declares output schemas for all tools", async () => {
        const response = await postJson(request("demo-basic-tools-1", "tools/list"), {}, demoV2BasicServer);

        expect(response.status).toBe(200);

        const message = await readJson(response);
        const result = resultOf(message);
        const tools = result.tools as JsonObject[];

        expect(tools.map((tool) => tool.name)).toEqual(["echo", "server_time", "cache_meta"]);

        for (const tool of tools) {
            const outputSchema = tool.outputSchema as JsonObject | undefined;
            expect(outputSchema).toBeDefined();
            expect(outputSchema?.type).toBe("object");
            expect(outputSchema?.properties).toMatchObject({
                message: {
                    type: "string",
                },
            });
            expect(outputSchema?.required).toContain("message");
        }
    });

    test("demo basic tools/call returns structured content matching output schemas", async () => {
        const calls = [
            {
                id: "demo-basic-echo-1",
                name: "echo",
                arguments: {
                    message: "hello demo",
                },
                expectedText: "Echo: hello demo",
            },
            {
                id: "demo-basic-time-1",
                name: "server_time",
                arguments: {},
                expectedText: expect.stringContaining("ABAP server date"),
            },
            {
                id: "demo-basic-cache-1",
                name: "cache_meta",
                arguments: {},
                expectedText: "This result demonstrates v2 cache hints and result metadata.",
            },
        ];

        for (const call of calls) {
            const response = await postJson(
                request(call.id, "tools/call", {
                    name: call.name,
                    arguments: call.arguments,
                }),
                call.name === "echo" ? { "Mcp-Param-Message": "hello demo" } : {},
                demoV2BasicServer,
            );

            expect(response.status).toBe(200);

            const result = resultOf(await readJson(response));
            const content = result.content as JsonObject[];
            const structuredContent = result.structuredContent as JsonObject | undefined;

            expect(content[0]).toMatchObject({
                type: "text",
                text: call.expectedText,
            });
            expect(structuredContent).toBeDefined();
            expect(structuredContent?.message).toBe(content[0].text);
        }
    });

    test("workflow demo delayed task starts as a normal working task without input requests", async () => {
        const listResponse = await postJson(
            request("demo-workflow-tools-1", "tools/list", {}, true),
            {},
            demoV2WorkflowServer,
        );

        expect(listResponse.status).toBe(200);

        const tools = resultOf(await readJson(listResponse)).tools as JsonObject[];
        const delayedTool = tools.find((tool) => tool.name === "start_delayed_task");
        expect(delayedTool).toBeDefined();
        expect(delayedTool?.execution).toEqual({ taskSupport: "required" });

        const callResponse = await postJson(
            request(
                "demo-workflow-delayed-1",
                "tools/call",
                {
                    name: "start_delayed_task",
                    arguments: {
                        value: 12,
                    },
                    task: {
                        ttl: 300000,
                    },
                },
                true,
            ),
            {},
            demoV2WorkflowServer,
        );

        expect(callResponse.status).toBe(200);

        const result = resultOf(await readJson(callResponse));
        expect(result.resultType).toBe("task");
        expect(result).not.toHaveProperty("requestState");
        expect(result).not.toHaveProperty("inputRequests");

        const task = result.task as JsonObject;
        expect(task.taskId).toEqual(expect.stringMatching(/^[0-9A-F]{32}$/));
        expect(task.status).toBe("working");
        expect(task.statusMessage).toBe("Delayed background task is running.");
        expect(task.pollIntervalMs).toBe(5000);
    });

    test("tools/call accepts matching Mcp-Param headers", async () => {
        const response = await postJson(
            request("param-header-match-1", "tools/call", {
                name: "echo",
                arguments: {
                    message: "hello header",
                },
            }),
            {
                "Mcp-Param-Message": "hello header",
            },
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        expect(result.content).toEqual([
            {
                type: "text",
                text: "hello header",
            },
        ]);
    });

    test("tools/call rejects mismatched Mcp-Param headers", async () => {
        const response = await postJson(
            request("param-header-mismatch-1", "tools/call", {
                name: "echo",
                arguments: {
                    message: "body value",
                },
            }),
            {
                "Mcp-Param-Message": "header value",
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Param-Message");
    });

    test("tools/call rejects missing required Mcp-Param headers", async () => {
        const response = await postRawJson(
            request("param-header-missing-1", "tools/call", {
                name: "echo",
                arguments: {
                    message: "body value",
                },
            }),
            {
                ...jsonHeaders,
                "Mcp-Method": "tools/call",
                "Mcp-Name": "echo",
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Param-Message");
    });

    test("tools/call rejects duplicate x-mcp-header suffixes", async () => {
        const response = await postJson(
            request("param-header-duplicate-1", "tools/call", {
                name: "bad_header_duplicate",
                arguments: {
                    first: "one",
                    second: "two",
                },
            }),
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Duplicate x-mcp-header");
    });

    test("tools/call rejects invalid x-mcp-header token suffixes", async () => {
        const response = await postJson(
            request("param-header-token-1", "tools/call", {
                name: "bad_header_token",
                arguments: {
                    value: "one",
                },
            }),
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Invalid x-mcp-header");
    });

    test("tools/call rejects x-mcp-header on number properties", async () => {
        const response = await postJson(
            request("param-header-number-1", "tools/call", {
                name: "bad_header_number",
                arguments: {
                    amount: 1.25,
                },
            }),
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("number");
    });

    test("tools/call rejects nested x-mcp-header annotations", async () => {
        const response = await postJson(
            request("param-header-nested-1", "tools/call", {
                name: "bad_header_nested",
                arguments: {
                    outer: {
                        inner: "value",
                    },
                },
            }),
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Nested x-mcp-header");
    });

    test("tools/call accepts base64-encoded Mcp-Param string headers", async () => {
        const response = await postJson(
            request("param-header-base64-string-1", "tools/call", {
                name: "header_string",
                arguments: {
                    value: "hello encoded",
                },
            }),
            {
                "Mcp-Param-Value": "=?base64?aGVsbG8gZW5jb2RlZA==?=",
            },
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        expect(result.content).toEqual([
            {
                type: "text",
                text: "header string: hello encoded",
            },
        ]);
    });

    test("tools/call rejects invalid base64 Mcp-Param string headers", async () => {
        const response = await postJson(
            request("param-header-base64-invalid-1", "tools/call", {
                name: "header_string",
                arguments: {
                    value: "hello encoded",
                },
            }),
            {
                "Mcp-Param-Value": "=?base64?not valid!?=",
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Param-Value");
    });

    test("tools/call rejects decoded Mcp-Param control characters", async () => {
        const response = await postJson(
            request("param-header-control-char-1", "tools/call", {
                name: "header_string",
                arguments: {
                    value: "hello\nencoded",
                },
            }),
            {
                "Mcp-Param-Value": "=?base64?aGVsbG8KZW5jb2RlZA==?=",
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Param-Value");
    });

    test("tools/call compares integer Mcp-Param headers numerically", async () => {
        const response = await postJson(
            request("param-header-integer-match-1", "tools/call", {
                name: "header_integer",
                arguments: {
                    count: 123,
                },
            }),
            {
                "Mcp-Param-Count": "000123",
            },
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        expect(result.content).toEqual([
            {
                type: "text",
                text: "header integer: 123",
            },
        ]);
    });

    test("tools/call rejects mismatched integer Mcp-Param headers", async () => {
        const response = await postJson(
            request("param-header-integer-mismatch-1", "tools/call", {
                name: "header_integer",
                arguments: {
                    count: 123,
                },
            }),
            {
                "Mcp-Param-Count": "124",
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Param-Count");
    });

    test("tools/call rejects unsafe integer Mcp-Param headers", async () => {
        const response = await postJson(
            request("param-header-integer-unsafe-1", "tools/call", {
                name: "header_integer",
                arguments: {
                    count: 123,
                },
            }),
            {
                "Mcp-Param-Count": "9007199254740992",
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Param-Count");
    });

    test("tools/call accepts strict boolean Mcp-Param headers", async () => {
        const response = await postJson(
            request("param-header-boolean-match-1", "tools/call", {
                name: "header_boolean",
                arguments: {
                    enabled: true,
                },
            }),
            {
                "Mcp-Param-Enabled": "true",
            },
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        expect(result.content).toEqual([
            {
                type: "text",
                text: "header boolean: true",
            },
        ]);
    });

    test("tools/call rejects non-lowercase boolean Mcp-Param headers", async () => {
        const response = await postJson(
            request("param-header-boolean-strict-1", "tools/call", {
                name: "header_boolean",
                arguments: {
                    enabled: true,
                },
            }),
            {
                "Mcp-Param-Enabled": "True",
            },
        );

        expect(response.status).toBe(400);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32001);
        expect(String(error.message)).toContain("Mcp-Param-Enabled");
    });

    test("prompts/list and prompts/get return draft-compatible prompt data", async () => {
        const listResponse = await postJson(request("prompts-1", "prompts/list"));
        const getResponse = await postJson(
            request("prompt-get-1", "prompts/get", {
                name: "v2_prompt",
                arguments: {
                    topic: "draft",
                },
            }),
        );

        expect(listResponse.status).toBe(200);
        expect(getResponse.status).toBe(200);

        const listResult = resultOf(await readJson(listResponse));
        expect(listResult.prompts).toEqual([
            {
                name: "v2_prompt",
                title: "V2 Prompt",
                description: "Prompt exposed by the draft v2 test server.",
                arguments: [
                    {
                        name: "topic",
                        description: "Topic to include in the prompt.",
                        required: false,
                    },
                ],
            },
        ]);

        const getResult = resultOf(await readJson(getResponse));
        expect(getResult.description).toBe("Prompt exposed by the draft v2 test server.");
        expect(getResult.messages).toEqual([
            {
                role: "user",
                content: {
                    type: "text",
                    text: "Create a short response about draft.",
                },
            },
        ]);
    });

    test("resources/list, resources/templates/list, and resources/read return resource data", async () => {
        const listResponse = await postJson(request("resources-1", "resources/list"));
        const templatesResponse = await postJson(request("resource-templates-1", "resources/templates/list"));
        const readResponse = await postJson(
            request("resource-read-1", "resources/read", {
                uri: "test://v2/resource",
            }),
        );

        expect(listResponse.status).toBe(200);
        expect(templatesResponse.status).toBe(200);
        expect(readResponse.status).toBe(200);

        const listResult = resultOf(await readJson(listResponse));
        expect(listResult.resources).toEqual([
            {
                uri: "test://v2/resource",
                name: "v2-resource",
                title: "V2 Resource",
                description: "Resource exposed by the draft v2 test server.",
                mimeType: "text/plain",
            },
        ]);

        const templatesResult = resultOf(await readJson(templatesResponse));
        expect(templatesResult.resourceTemplates).toEqual([
            {
                uriTemplate: "test://v2/{name}",
                name: "v2-template",
                title: "V2 Template",
                description: "Resource template exposed by the draft v2 test server.",
                mimeType: "text/plain",
            },
        ]);

        const readResult = resultOf(await readJson(readResponse));
        expect(readResult.contents).toEqual([
            {
                uri: "test://v2/resource",
                mimeType: "text/plain",
                text: "Resource content from ABAP v2 test server.",
            },
        ]);
    });

    test("completion/complete returns draft-compatible completion values", async () => {
        const response = await postJson(
            request("complete-1", "completion/complete", {
                ref: {
                    type: "ref/prompt",
                    name: "v2_prompt",
                },
                argument: {
                    name: "topic",
                    value: "dr",
                },
            }),
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        expect(result.completion).toEqual({
            values: ["draft", "drilldown"],
            total: 2,
            hasMore: false,
        });
    });

    test("tools/call returns normal tool content", async () => {
        const response = await postJson(
            request("call-1", "tools/call", {
                name: "echo",
                arguments: {
                    message: "hello v2",
                },
            }),
            {
                "Mcp-Param-Message": "hello v2",
            },
        );

        expect(response.status).toBe(200);

        const message = await readJson(response);
        const result = resultOf(message);
        expect(result.resultType).toBe("complete");
        expect(result.isError).toBe(false);
        expect(result.content).toEqual([
            {
                type: "text",
                text: "hello v2",
            },
        ]);
    });

    test("tools/call can return v2 cache hints and result metadata", async () => {
        const response = await postJson(
            request("cache-meta-1", "tools/call", {
                name: "cache_meta",
            }),
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        expect(result.resultType).toBe("complete");
        expect(result.ttlMs).toBe(2500);
        expect(result.cacheScope).toBe("private");
        expect(result._meta).toEqual({
            "abap.test/trace": "cache-meta",
        });
        expect(result.content).toEqual([
            {
                type: "text",
                text: "Cacheable v2 result with metadata.",
            },
        ]);
    });

    test("tools/call can return zero ttl v2 cache hints", async () => {
        const response = await postJson(
            request("cache-zero-1", "tools/call", {
                name: "cache_zero",
            }),
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        expect(result.resultType).toBe("complete");
        expect(result.ttlMs).toBe(0);
        expect(result.cacheScope).toBe("private");
        expect(result.content).toEqual([
            {
                type: "text",
                text: "Zero-cache v2 result.",
            },
        ]);
    });

    test("tools/call can return MRTR input_required", async () => {
        const response = await postJson(
            request("mrtr-1", "tools/call", {
                name: "needs_input",
            }),
        );

        expect(response.status).toBe(200);

        const message = await readJson(response);
        const result = resultOf(message);
        expect(result.resultType).toBe("input_required");
        expect(typeof result.requestState).toBe("string");
        expect(result.requestState).not.toBe("test-state-1");

        const inputRequests = result.inputRequests as JsonObject;
        const confirm = inputRequests.confirm as JsonObject;
        expect(confirm.method).toBe("elicitation/create");
        expect(confirm.params).toEqual({
            mode: "form",
            message: "Confirm the v2 test action.",
            requestedSchema: {
                type: "object",
                properties: {
                    approved: {
                        type: "boolean",
                        description: "Whether the action is approved.",
                    },
                },
                required: ["approved"],
            },
        });
    });

    test("tools/call can resume an MRTR input_required result", async () => {
        const requestState = await getNeedsInputState();
        const response = await postJson(
            request("mrtr-retry-tool-1", "tools/call", {
                name: "needs_input",
                requestState,
                inputResponses: {
                    confirm: {
                        action: "accept",
                        content: {
                            approved: true,
                        },
                    },
                },
            }),
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        expect(result.isError).toBe(false);
        expect(result.content).toEqual([
            {
                type: "text",
                text: "Tool retry accepted: needs-input approved=true",
            },
        ]);
    });

    test("tools/call rejects a replayed MRTR requestState", async () => {
        const requestState = await getNeedsInputState();

        const firstResponse = await postJson(
            request("mrtr-replay-tool-1", "tools/call", {
                name: "needs_input",
                requestState,
                inputResponses: {
                    confirm: {
                        action: "accept",
                        content: {
                            approved: true,
                        },
                    },
                },
            }),
        );

        expect(firstResponse.status).toBe(200);
        expect(resultOf(await readJson(firstResponse)).isError).toBe(false);

        const replayResponse = await postJson(
            request("mrtr-replay-tool-2", "tools/call", {
                name: "needs_input",
                requestState,
                inputResponses: {
                    confirm: {
                        action: "accept",
                        content: {
                            approved: true,
                        },
                    },
                },
            }),
        );

        expect(replayResponse.status).toBe(200);

        const error = errorOf(await readJson(replayResponse));
        expect(error.code).toBe(-32602);
        expect(String(error.message)).toContain("requestState");
    });

    test("tools/call rejects a tampered MRTR requestState", async () => {
        const requestState = await getNeedsInputState();
        const parsed = JSON.parse(requestState) as JsonObject;
        const payload = parsed.payload as JsonObject;
        payload.data = "tampered-state";

        const response = await postJson(
            request("mrtr-retry-tampered-state-1", "tools/call", {
                name: "needs_input",
                requestState: JSON.stringify(parsed),
                inputResponses: {
                    confirm: {
                        action: "accept",
                        content: {
                            approved: true,
                        },
                    },
                },
            }),
        );

        expect(response.status).toBe(200);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32602);
        expect(String(error.message)).toContain("requestState");
    });

    test("prompts/get can resume an MRTR input_required result", async () => {
        const response = await postJson(
            request("mrtr-retry-prompt-1", "prompts/get", {
                name: "v2_prompt",
                requestState: "prompt-state-1",
                inputResponses: {
                    confirm: {
                        action: "accept",
                        content: {
                            topic: "retry-prompt",
                        },
                    },
                },
            }),
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        expect(result.description).toBe("Prompt exposed by the draft v2 test server.");
        expect(result.messages).toEqual([
            {
                role: "user",
                content: {
                    type: "text",
                    text: "Create a short response about retry-prompt.",
                },
            },
        ]);
    });

    test("resources/read can resume an MRTR input_required result", async () => {
        const response = await postJson(
            request("mrtr-retry-resource-1", "resources/read", {
                uri: "test://v2/resource",
                requestState: "resource-state-1",
                inputResponses: {
                    confirm: {
                        action: "accept",
                        content: {
                            suffix: "retry-resource",
                        },
                    },
                },
            }),
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        expect(result.contents).toEqual([
            {
                uri: "test://v2/resource",
                mimeType: "text/plain",
                text: "Resource retry accepted: resource-state-1 suffix=retry-resource",
            },
        ]);
    });

    test("task result requires the client tasks extension capability", async () => {
        const response = await postJson(
            request("task-missing-cap-1", "tools/call", {
                name: "start_task",
            }),
        );

        expect(response.status).toBe(200);

        const message = await readJson(response);
        const error = errorOf(message);
        expect(error.code).toBe(-32003);
        expect(String(error.message)).toContain("io.modelcontextprotocol/tasks");
        expect(error.data).toEqual({
            requiredCapabilities: ["io.modelcontextprotocol/tasks"],
        });
    });

    test("router task result guard requires the client tasks extension capability", async () => {
        const response = await postJson(
            request("task-router-missing-cap-1", "tools/call", {
                name: "start_unguarded_task",
            }),
        );

        expect(response.status).toBe(200);

        const message = await readJson(response);
        const error = errorOf(message);
        expect(error.code).toBe(-32003);
        expect(String(error.message)).toContain("io.modelcontextprotocol/tasks");
        expect(error.data).toEqual({
            requiredCapabilities: ["io.modelcontextprotocol/tasks"],
        });
    });

    test("tools/call can return a task extension result", async () => {
        const response = await postJson(
            request(
                "task-1",
                "tools/call",
                {
                    name: "start_task",
                },
                true,
            ),
        );

        expect(response.status).toBe(200);

        const message = await readJson(response);
        const result = resultOf(message);
        expect(result.resultType).toBe("task");

        const task = result.task as JsonObject;
        expect(task.taskId).toBe(taskId);
        expect(task.status).toBe("working");
        expect(task.ttlMs).toBe(60000);
        expect(task.pollIntervalMs).toBe(1000);
    });

    test("router task result guard allows task result with client capability", async () => {
        const response = await postJson(
            request(
                "task-router-cap-1",
                "tools/call",
                {
                    name: "start_unguarded_task",
                },
                true,
            ),
        );

        expect(response.status).toBe(200);

        const message = await readJson(response);
        const result = resultOf(message);
        expect(result.resultType).toBe("task");

        const task = result.task as JsonObject;
        expect(task.taskId).toBe(taskId);
        expect(task.status).toBe("working");
        expect(task.ttlMs).toBe(60000);
        expect(task.pollIntervalMs).toBe(1000);
    });

    test("tasks/get returns task state and terminal result", async () => {
        const response = await postJson(
            request(
                "task-get-1",
                "tasks/get",
                {
                    taskId,
                },
                true,
            ),
        );

        expect(response.status).toBe(200);

        const message = await readJson(response);
        const result = resultOf(message);
        const task = result.task as JsonObject;
        const taskResult = result.result as JsonObject;

        expect(task.taskId).toBe(taskId);
        expect(task.status).toBe("completed");
        expect(taskResult.content).toEqual([
            {
                type: "text",
                text: "Task result from ABAP v2 test server.",
            },
        ]);
    });

    test("tasks/get can return input_required task state", async () => {
        const response = await postJson(
            request(
                "task-get-input-1",
                "tasks/get",
                {
                    taskId: taskInputRequiredId,
                },
                true,
            ),
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        const task = result.task as JsonObject;
        const inputRequests = result.inputRequests as JsonObject;
        const confirm = inputRequests.confirm as JsonObject;

        expect(task.taskId).toBe(taskInputRequiredId);
        expect(task.status).toBe("input_required");
        expect(typeof result.requestState).toBe("string");
        expect(result.requestState).not.toBe("task-state-2");
        expect(confirm.method).toBe("elicitation/create");
    });

    test("tasks/get can return terminal task error", async () => {
        const response = await postJson(
            request(
                "task-get-error-1",
                "tasks/get",
                {
                    taskId: taskErrorId,
                },
                true,
            ),
        );

        expect(response.status).toBe(200);

        const result = resultOf(await readJson(response));
        const task = result.task as JsonObject;
        const taskError = result.error as JsonObject;

        expect(task.taskId).toBe(taskErrorId);
        expect(task.status).toBe("failed");
        expect(taskError.code).toBe(-32603);
        expect(taskError.message).toBe("Task failed in ABAP v2 test server.");
    });

    test("tasks/update accepts requestState and multiple input responses", async () => {
        const requestState = await getTaskInputState();
        const updateResponse = await postJson(
            request(
                "task-update-1",
                "tasks/update",
                {
                    taskId: taskInputRequiredId,
                    requestState,
                    inputResponses: {
                        confirm: {
                            approved: true,
                        },
                        comment: {
                            text: "looks good",
                        },
                    },
                },
                true,
            ),
        );

        expect(updateResponse.status).toBe(200);

        const updateResult = resultOf(await readJson(updateResponse));
        expect(updateResult).toEqual({ resultType: "complete" });
    });

    test("persisted tasks can pause for input and resume through tasks/update", async () => {
        const createResponse = await postJson(
            request(
                "persisted-task-create-1",
                "tools/call",
                {
                    name: persistedTaskTool,
                },
                true,
            ),
        );

        expect(createResponse.status).toBe(200);

        const createResult = resultOf(await readJson(createResponse));
        expect(createResult.resultType).toBe("task");

        const createdTask = createResult.task as JsonObject;
        expect(typeof createdTask.taskId).toBe("string");
        expect(createdTask.status).toBe("input_required");
        expect(createdTask.pollIntervalMs).toBe(1000);

        const taskId = createdTask.taskId as string;
        const getResponse = await postJson(
            request(
                "persisted-task-get-1",
                "tasks/get",
                {
                    taskId,
                },
                true,
            ),
        );

        expect(getResponse.status).toBe(200);

        const getResult = resultOf(await readJson(getResponse));
        expect(getResult.resultType).toBe("complete");
        expect(typeof getResult.requestState).toBe("string");

        const fetchedTask = getResult.task as JsonObject;
        expect(fetchedTask.taskId).toBe(taskId);
        expect(fetchedTask.status).toBe("input_required");

        const inputRequests = getResult.inputRequests as JsonObject;
        const confirm = inputRequests.confirm as JsonObject;
        expect(confirm.method).toBe("elicitation/create");
        expect(confirm.params).toEqual({
            mode: "form",
            message: "Confirm persisted task continuation.",
            requestedSchema: {
                type: "object",
                properties: {
                    approved: {
                        type: "boolean",
                        description: "Whether the task should continue.",
                    },
                },
                required: ["approved"],
            },
        });

        const updateResponse = await postJson(
            request(
                "persisted-task-update-1",
                "tasks/update",
                {
                    taskId,
                    requestState: getResult.requestState,
                    inputResponses: {
                        confirm: {
                            action: "accept",
                            content: {
                                approved: true,
                            },
                        },
                    },
                },
                true,
            ),
        );

        expect(updateResponse.status).toBe(200);
        expect(resultOf(await readJson(updateResponse))).toEqual({ resultType: "complete" });

        const resumedResponse = await postJson(
            request(
                "persisted-task-get-resumed-1",
                "tasks/get",
                {
                    taskId,
                },
                true,
            ),
        );

        expect(resumedResponse.status).toBe(200);

        const resumedResult = resultOf(await readJson(resumedResponse));
        const resumedTask = resumedResult.task as JsonObject;
        expect(resumedTask.taskId).toBe(taskId);
        expect(resumedTask.status).toBe("working");
    });


    test("tasks/update rejects a replayed requestState", async () => {
        const requestState = await getTaskInputState();

        const firstResponse = await postJson(
            request(
                "task-update-replay-1",
                "tasks/update",
                {
                    taskId: taskInputRequiredId,
                    requestState,
                    inputResponses: {
                        confirm: {
                            approved: true,
                        },
                    },
                },
                true,
            ),
        );

        expect(firstResponse.status).toBe(200);
        expect(resultOf(await readJson(firstResponse))).toEqual({ resultType: "complete" });

        const replayResponse = await postJson(
            request(
                "task-update-replay-2",
                "tasks/update",
                {
                    taskId: taskInputRequiredId,
                    requestState,
                    inputResponses: {
                        confirm: {
                            approved: true,
                        },
                    },
                },
                true,
            ),
        );

        expect(replayResponse.status).toBe(200);

        const error = errorOf(await readJson(replayResponse));
        expect(error.code).toBe(-32602);
        expect(String(error.message)).toContain("requestState");
    });

    test("tasks/update rejects a tampered requestState", async () => {
        const requestState = await getTaskInputState();
        const parsed = JSON.parse(requestState) as JsonObject;
        const payload = parsed.payload as JsonObject;
        payload.data = "tampered-task-state";

        const response = await postJson(
            request(
                "task-update-tampered-state-1",
                "tasks/update",
                {
                    taskId: taskInputRequiredId,
                    requestState: JSON.stringify(parsed),
                    inputResponses: {
                        confirm: {
                            approved: true,
                        },
                    },
                },
                true,
            ),
        );

        expect(response.status).toBe(200);

        const error = errorOf(await readJson(response));
        expect(error.code).toBe(-32602);
        expect(String(error.message)).toContain("requestState");
    });

    test("tasks/update missing inputResponses returns invalid params", async () => {
        const response = await postJson(
            request(
                "task-update-missing-input-1",
                "tasks/update",
                {
                    taskId,
                    requestState: "test-state-1",
                },
                true,
            ),
        );

        expect(response.status).toBe(200);

        const message = await readJson(response);
        const error = errorOf(message);
        expect(error.code).toBe(-32602);
        expect(String(error.message)).toContain("inputResponses");
    });

    test("tasks/cancel returns complete acknowledgement for persisted tasks", async () => {
        const createResponse = await postJson(
            request(
                "task-cancel-create-1",
                "tools/call",
                {
                    name: persistedTaskTool,
                },
                true,
            ),
        );

        expect(createResponse.status).toBe(200);

        const createResult = resultOf(await readJson(createResponse));
        const createdTask = createResult.task as JsonObject;
        const persistedTaskId = createdTask.taskId as string;

        const cancelResponse = await postJson(
            request(
                "task-cancel-1",
                "tasks/cancel",
                {
                    taskId: persistedTaskId,
                },
                true,
            ),
        );

        expect(cancelResponse.status).toBe(200);
        expect(resultOf(await readJson(cancelResponse))).toEqual({ resultType: "complete" });

        const getResponse = await postJson(
            request(
                "task-cancel-get-1",
                "tasks/get",
                {
                    taskId: persistedTaskId,
                },
                true,
            ),
        );

        expect(getResponse.status).toBe(200);

        const getResult = resultOf(await readJson(getResponse));
        const cancelledTask = getResult.task as JsonObject;
        expect(cancelledTask.taskId).toBe(persistedTaskId);
        expect(cancelledTask.status).toBe("cancelled");
        expect(String(errorOf(getResult).message)).toContain("was cancelled");
    });
});
