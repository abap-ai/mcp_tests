import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
    CallToolResultSchema,
    ContentBlock,
    CreateTaskResultSchema,
    CreateTaskResult,
    ErrorCode,
    RELATED_TASK_META_KEY,
    Task,
} from "@modelcontextprotocol/sdk/types.js";
import { getEndpointUrl } from "./config.js";

const TASK_COMPLETION_TIMEOUT_MS = 120_000;
const TASK_POLL_INTERVAL_MS = 2_000;
const TASK_CANCEL_SETTLE_MS = 65_000;

function createTaskClient(): Client {
    return new Client(
        {
            name: "test-client",
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
}

function expectIsoTimestamp(value: string): void {
    expect(value).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(value))).toBe(false);
}

function expectRecentIsoTimestamp(value: string, earliestMs: number, latestMs = Date.now()): void {
    expectIsoTimestamp(value);
    const parsed = Date.parse(value);
    const toleranceMs = 5 * 60 * 1000;

    expect(parsed).toBeGreaterThanOrEqual(earliestMs - toleranceMs);
    expect(parsed).toBeLessThanOrEqual(latestMs + toleranceMs);
}

async function createToolTask(
    client: Client,
    args: Record<string, unknown>,
    ttl = TASK_COMPLETION_TIMEOUT_MS + 60_000,
): Promise<CreateTaskResult> {
    return client.request(
        {
            method: "tools/call",
            params: {
                name: "Async Task Test",
                arguments: args,
            },
        },
        CreateTaskResultSchema,
        {
            task: { ttl },
            timeout: 10_000,
        },
    );
}

async function waitForTaskStatus(
    client: Client,
    taskId: string,
    expectedStatus: Task["status"],
    timeoutMs = TASK_COMPLETION_TIMEOUT_MS,
): Promise<Task> {
    const deadline = Date.now() + timeoutMs;
    let lastTask = await client.experimental.tasks.getTask(taskId);

    while (lastTask.status !== expectedStatus && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, TASK_POLL_INTERVAL_MS));
        lastTask = await client.experimental.tasks.getTask(taskId);
    }

    expect(lastTask.status).toBe(expectedStatus);
    return lastTask;
}

describe("MCP Server Task Tests", () => {
    let client: Client;
    let transport: StreamableHTTPClientTransport;

    beforeEach(async () => {
        client = createTaskClient();
        transport = new StreamableHTTPClientTransport(getEndpointUrl("/test/test_full"));
        await client.connect(transport);
        await client.listTools();
    });

    afterEach(async () => {
        if (client) {
            await client.close();
        }
    });

    test("Async Task Test advertises optional task execution", async () => {
        const tools = (await client.listTools()).tools;
        const taskTool = tools.find(tool => tool.name === "Async Task Test");

        expect(taskTool).toBeDefined();
        expect(taskTool?.execution?.taskSupport).toBe("optional");
        expect(taskTool?.inputSchema.required).toContain("mode");
        expect(taskTool?.inputSchema.properties?.mode).toMatchObject({
            type: "string",
            enum: ["complete", "fail", "complete_error", "stay_working"],
        });
        expect(taskTool?.inputSchema.properties?.value).toMatchObject({
            type: "integer",
            minimum: 0,
            maximum: 1000,
        });
    });

    test("tools do not advertise unsupported input_required task mode", async () => {
        const tools = (await client.listTools()).tools;

        for (const tool of tools) {
            const modeSchema = tool.inputSchema.properties?.mode;
            if (modeSchema && typeof modeSchema === "object" && "enum" in modeSchema) {
                expect((modeSchema as { enum?: unknown[] }).enum).not.toContain("input_required");
            }
        }
    });

    test("Async Task Test still supports synchronous fallback", async () => {
        const result = await client.callTool({
            name: "Async Task Test",
            arguments: {
                mode: "complete",
                value: 7,
            },
        });

        const content = result.content as ContentBlock[];
        expect(content[0].type).toBe("text");
        if (content[0].type !== "text") {
            throw new Error("Expected text content");
        }
        expect(content[0].text).toContain("49");
    });

    test("task-augmented calls are rejected for tools without task support", async () => {
        await expect(
            client.request(
                {
                    method: "tools/call",
                    params: {
                        name: "All Content Types",
                    },
                },
                CreateTaskResultSchema,
                {
                    task: { ttl: 60_000 },
                    timeout: 10_000,
                },
            ),
        ).rejects.toMatchObject({ code: ErrorCode.MethodNotFound });
    });

    test("required task tools reject synchronous calls and accept task-augmented calls", async () => {
        const tools = (await client.listTools()).tools;
        const requiredTaskTool = tools.find(tool => tool.name === "Required Task Test");

        expect(requiredTaskTool).toBeDefined();
        expect(requiredTaskTool?.execution?.taskSupport).toBe("required");

        await expect(
            client.callTool({
                name: "Required Task Test",
                arguments: {
                    mode: "stay_working",
                    value: 7,
                },
            }),
        ).rejects.toMatchObject({ code: ErrorCode.InvalidRequest });

        const created = await client.request(
            {
                method: "tools/call",
                params: {
                    name: "Required Task Test",
                    arguments: {
                        mode: "stay_working",
                        value: 7,
                    },
                },
            },
            CreateTaskResultSchema,
            {
                task: { ttl: 60_000 },
                timeout: 10_000,
            },
        );

        expect(created.task.status).toBe("working");

        const cancelled = await client.experimental.tasks.cancelTask(created.task.taskId);
        expect(cancelled.status).toBe("cancelled");
    });

    test("task-augmented complete mode runs as a long-lived task and exposes the completed tool result", async () => {
        const startedAt = Date.now();
        const created = await createToolTask(client, {
            mode: "complete",
            value: 7,
        });

        expect(created.task.taskId).toEqual(expect.any(String));
        expect(created.task.status).toBe("working");
        expectRecentIsoTimestamp(created.task.createdAt, startedAt);
        expectRecentIsoTimestamp(created.task.lastUpdatedAt, startedAt);
        expect(created.task.ttl).toEqual(expect.any(Number));

        const initiallyFetched = await client.experimental.tasks.getTask(created.task.taskId);
        expect(initiallyFetched.taskId).toBe(created.task.taskId);
        expect(initiallyFetched.status).toBe("working");

        const task = await waitForTaskStatus(client, created.task.taskId, "completed");
        expect(task.taskId).toBe(created.task.taskId);
        expectRecentIsoTimestamp(task.createdAt, startedAt);
        expectRecentIsoTimestamp(task.lastUpdatedAt, startedAt);

        const result = await client.experimental.tasks.getTaskResult(
            created.task.taskId,
            CallToolResultSchema,
        );
        expect(result._meta?.[RELATED_TASK_META_KEY]?.taskId).toBe(created.task.taskId);

        const content = result.content as ContentBlock[];
        expect(content[0].type).toBe("text");
        if (content[0].type !== "text") {
            throw new Error("Expected text content");
        }
        expect(content[0].text).toContain("49");
    }, TASK_COMPLETION_TIMEOUT_MS + 30_000);

    test("task TTL is interpreted as milliseconds on the wire", async () => {
        const created = await createToolTask(
            client,
            {
                mode: "stay_working",
                value: 7,
            },
            60_000,
        );

        expect(created.task.ttl).toBe(60_000);

        const fetched = await client.experimental.tasks.getTask(created.task.taskId);
        expect(fetched.ttl).toBe(60_000);

        const cancelled = await client.experimental.tasks.cancelTask(created.task.taskId);
        expect(cancelled.status).toBe("cancelled");
    });

    test("task-augmented fail mode reports a failed task", async () => {
        const created = await createToolTask(client, {
            mode: "fail",
            value: 7,
        });

        const task = await client.experimental.tasks.getTask(created.task.taskId);
        expect(task.status).toBe("failed");
        expectIsoTimestamp(task.createdAt);
        expectIsoTimestamp(task.lastUpdatedAt);

        await expect(
            client.experimental.tasks.getTaskResult(created.task.taskId, CallToolResultSchema),
        ).rejects.toThrow("Simulated task failure for testing");
    });

    test("task completed with isError payload is stored as failed and returned from tasks/result", async () => {
        const created = await createToolTask(client, {
            mode: "complete_error",
            value: 7,
        });

        const task = await client.experimental.tasks.getTask(created.task.taskId);
        expect(task.status).toBe("failed");

        const result = await client.experimental.tasks.getTaskResult(
            created.task.taskId,
            CallToolResultSchema,
        );

        expect(result.isError).toBe(true);
        expect(result._meta?.[RELATED_TASK_META_KEY]?.taskId).toBe(created.task.taskId);

        const content = result.content as ContentBlock[];
        expect(content[0].type).toBe("text");
        if (content[0].type !== "text") {
            throw new Error("Expected text content");
        }
        expect(content[0].text).toContain("Simulated task result error for testing");
    });

    test("tasks/result rejects non-terminal tasks instead of returning an empty payload", async () => {
        const created = await createToolTask(client, {
            mode: "stay_working",
            value: 7,
        });

        await expect(
            client.experimental.tasks.getTaskResult(created.task.taskId, CallToolResultSchema),
        ).rejects.toThrow("poll tasks/get and retry tasks/result once completed");

        const cancelled = await client.experimental.tasks.cancelTask(created.task.taskId);
        expect(cancelled.status).toBe("cancelled");
    });

    test("working tasks can be listed, fetched, and cancelled", async () => {
        const created = await createToolTask(client, {
            mode: "stay_working",
            value: 7,
        });

        const taskId = created.task.taskId;
        expectIsoTimestamp(created.task.createdAt);
        expectIsoTimestamp(created.task.lastUpdatedAt);

        const fetched = await client.experimental.tasks.getTask(taskId);
        expect(fetched.taskId).toBe(taskId);
        expect(fetched.status).toBe("working");

        const listed = await client.experimental.tasks.listTasks();
        expect(listed.tasks.some(task => task.taskId === taskId)).toBe(true);

        const cancelled = await client.experimental.tasks.cancelTask(taskId);
        expect(cancelled.taskId).toBe(taskId);
        expect(cancelled.status).toBe("cancelled");
        expectIsoTimestamp(cancelled.createdAt);
        expectIsoTimestamp(cancelled.lastUpdatedAt);

        const fetchedAfterCancel = await client.experimental.tasks.getTask(taskId);
        expect(fetchedAfterCancel.taskId).toBe(taskId);
        expect(fetchedAfterCancel.status).toBe("cancelled");

        await expect(client.experimental.tasks.cancelTask(taskId)).rejects.toMatchObject({
            code: ErrorCode.InvalidParams,
        });
    });

    test("running complete-mode tasks can be cancelled before completion and remain cancelled", async () => {
        const created = await createToolTask(client, {
            mode: "complete",
            value: 8,
        });

        const taskId = created.task.taskId;
        expect(created.task.status).toBe("working");

        const fetchedBeforeCancel = await client.experimental.tasks.getTask(taskId);
        expect(fetchedBeforeCancel.taskId).toBe(taskId);
        expect(fetchedBeforeCancel.status).toBe("working");

        const cancelled = await client.experimental.tasks.cancelTask(taskId);
        expect(cancelled.taskId).toBe(taskId);
        expect(cancelled.status).toBe("cancelled");
        expectIsoTimestamp(cancelled.createdAt);
        expectIsoTimestamp(cancelled.lastUpdatedAt);

        await new Promise(resolve => setTimeout(resolve, TASK_CANCEL_SETTLE_MS));

        const fetchedAfterNormalCompletionWindow = await client.experimental.tasks.getTask(taskId);
        expect(fetchedAfterNormalCompletionWindow.taskId).toBe(taskId);
        expect(fetchedAfterNormalCompletionWindow.status).toBe("cancelled");

        await expect(
            client.experimental.tasks.getTaskResult(taskId, CallToolResultSchema),
        ).rejects.toThrow();
    }, TASK_CANCEL_SETTLE_MS + 30_000);

});
