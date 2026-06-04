import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { LATEST_PROTOCOL_VERSION, ServerCapabilitiesSchema } from "@modelcontextprotocol/sdk/types.js";
import { getEndpointUrl } from "./config.js";

describe('MCP Server Capabilities Tests', () => {
    let client: Client;
    let transport: StreamableHTTPClientTransport;

    beforeEach(() => {
        client = new Client({
            name: 'test-client',
            version: '1.0.0'
        });
    });

    afterEach(async () => {
        if (client) {
            await client.close();
        }
    });

    test('minimal server should have no capabilities but valid name and version', async () => {
        const demoServer = "/test/test_minimal";
        transport = new StreamableHTTPClientTransport(
            getEndpointUrl(demoServer),
        );
        await client.connect(transport);

        expect(client.getServerCapabilities()?.prompts).toBeUndefined();
        expect(client.getServerCapabilities()?.resources).toBeUndefined();
        expect(client.getServerCapabilities()?.tools).toBeUndefined();
    });

    test('full server should expose supported capabilities only', async () => {
        const demoServer = "/test/test_full";
        transport = new StreamableHTTPClientTransport(
            getEndpointUrl(demoServer),
        );
        await client.connect(transport);

        const capabilities = ServerCapabilitiesSchema.parse(client.getServerCapabilities());
        expect(capabilities.prompts).toBeDefined();
        expect(capabilities.prompts?.listChanged).toBeUndefined();
        expect(capabilities.resources).toBeDefined();
        expect(capabilities.resources?.subscribe).toBeUndefined();
        expect(capabilities.resources?.listChanged).toBeUndefined();
        expect(capabilities.tools).toBeDefined();
        expect(capabilities.tools?.listChanged).toBeUndefined();
        expect(capabilities.tasks?.list).toBeDefined();
        expect(capabilities.tasks?.cancel).toBeDefined();
        expect(capabilities.tasks?.requests?.tools?.call).toBeDefined();
        expect(capabilities.logging).toBeUndefined();
        expect(capabilities.completions).toBeDefined();
        expect(transport.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
    });

    test('advertised capabilities have routable request methods', async () => {
        const demoServer = "/test/test_full";
        transport = new StreamableHTTPClientTransport(
            getEndpointUrl(demoServer),
        );
        await client.connect(transport);

        await expect(client.listPrompts()).resolves.toBeDefined();
        await expect(client.listResources()).resolves.toBeDefined();
        await expect(client.listResourceTemplates()).resolves.toBeDefined();
        await expect(client.listTools()).resolves.toBeDefined();
        await expect(client.experimental.tasks.listTasks()).resolves.toBeDefined();
        await expect(client.complete({
            ref: { type: "ref/prompt", name: "complex" },
            argument: { name: "required", value: "value" },
        })).resolves.toBeDefined();
    });

    test('full server should expose implementation metadata with icons', async () => {
        const demoServer = "/test/test_full";
        transport = new StreamableHTTPClientTransport(
            getEndpointUrl(demoServer),
        );
        await client.connect(transport);

        const serverVersion = client.getServerVersion();
        expect(serverVersion?.name).toBe("Test Server with full feature set");
        expect(serverVersion?.title).toBe("Full Feature Test Server");
        expect(serverVersion?.description).toBeDefined();
        expect(serverVersion?.icons?.length).toBeGreaterThan(0);
        expect(typeof serverVersion?.icons?.[0]?.src).toBe("string");
        expect(typeof serverVersion?.icons?.[0]?.mimeType).toBe("string");
    });

    test('full server should have instructions', async () => {
        const demoServer = "/test/test_full";
        transport = new StreamableHTTPClientTransport(
            getEndpointUrl(demoServer),
        );
        await client.connect(transport);

        expect(client.getInstructions()).toContain("Use this server to test the implementation");
    });
});
