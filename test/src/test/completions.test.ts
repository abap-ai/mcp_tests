import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
    CompleteResultSchema,
    PromptReferenceSchema,
    ResourceTemplateReferenceSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getEndpointUrl } from "./config.js";

describe("MCP Server Completion Tests", () => {
    let client: Client;
    let transport: StreamableHTTPClientTransport;

    beforeEach(async () => {
        client = new Client({
            name: "test-client",
            version: "1.0.0",
        });
        transport = new StreamableHTTPClientTransport(getEndpointUrl("/test/test_full"));
        await client.connect(transport);
    });

    afterEach(async () => {
        if (client) {
            await client.close();
        }
    });

    test("full server advertises completion support", () => {
        expect(client.getServerCapabilities()?.completions).toBeDefined();
    });

    test("completes prompt argument values", async () => {
        const ref = PromptReferenceSchema.parse({ type: "ref/prompt", name: "complex" });

        const result = await client.complete({
            ref,
            argument: { name: "required", value: "value" },
        });

        expect(() => CompleteResultSchema.parse(result)).not.toThrow();
        expect(result.completion.values).toEqual(["value1", "value2", "value3"]);
        expect(result.completion.values.length).toBeLessThanOrEqual(100);
        expect(result.completion.total).toBeUndefined();
        expect(result.completion.hasMore).toBeUndefined();
    });

    test("filters prompt completions by the partial argument value", async () => {
        const result = await client.complete({
            ref: { type: "ref/prompt", name: "complex" },
            argument: { name: "required", value: "value2" },
        });

        expect(CompleteResultSchema.parse(result).completion.values).toEqual(["value2"]);
    });

    test("uses completion context for already resolved prompt arguments", async () => {
        const result = await client.complete({
            ref: { type: "ref/prompt", name: "complex" },
            argument: { name: "optional", value: "" },
            context: {
                arguments: {
                    required: "value1",
                },
            },
        });

        expect(CompleteResultSchema.parse(result).completion).toMatchObject({
            values: ["opt_for_value1_a", "opt_for_value1_b"],
            total: 10,
            hasMore: true,
        });
    });

    test("completes prompt arguments on other advertised prompts", async () => {
        const result = await client.complete({
            ref: { type: "ref/prompt", name: "test_meta" },
            argument: { name: "testArg", value: "arg_value_b" },
        });

        expect(CompleteResultSchema.parse(result).completion.values).toEqual(["arg_value_b"]);
    });

    test("completes resource template arguments", async () => {
        const templates = (await client.listResourceTemplates()).resourceTemplates;
        expect(templates.some(template => template.uriTemplate === "file://{path}")).toBe(true);

        const ref = ResourceTemplateReferenceSchema.parse({
            type: "ref/resource",
            uri: "file://{path}",
        });

        const result = await client.complete({
            ref,
            argument: { name: "path", value: "/t" },
        });

        expect(CompleteResultSchema.parse(result).completion.values).toEqual(["/tmp"]);
    });

    test("returns an empty standard completion result for unsupported arguments", async () => {
        const result = await client.complete({
            ref: { type: "ref/prompt", name: "simple" },
            argument: { name: "missing", value: "" },
        });

        expect(CompleteResultSchema.parse(result).completion).toEqual({ values: [] });
    });
});
