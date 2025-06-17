import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

describe('MCP Server Annotations Tests', () => {
    const baseUrl = new URL("http://localhost:8000/zmcp");
    let client: Client;
    let transport: StreamableHTTPClientTransport;

    beforeEach(async () => {
        client = new Client({
            name: 'test-client',
            version: '1.0.0'
        });
        const demoServer = "/test/test_annotations";
        transport = new StreamableHTTPClientTransport(
            new URL(baseUrl + demoServer),
        );
        await client.connect(transport);
    });

    afterEach(async () => {
        if (client) {
            await client.close();
        }
    });

    test('List tools should return all tools with annotations', async () => {
        const tools = (await client.listTools()).tools;
        expect(tools).toHaveLength(5);
        
        const allHints = tools.find(t => t.name === "AllHints");
        expect(allHints).toBeDefined();
        expect(allHints?.annotations?.destructiveHint).toBeTruthy();
        expect(allHints?.annotations?.idempotentHint).toBeTruthy();
        expect(allHints?.annotations?.openWorldHint).toBeTruthy();
        expect(allHints?.annotations?.readOnlyHint).toBeTruthy();
        expect(allHints?.annotations?.title).toBe("Human Readable Title");

        const destructiveOnly = tools.find(t => t.name === "DestructiveOnly");
        expect(destructiveOnly?.annotations?.destructiveHint).toBeTruthy();
        expect(destructiveOnly?.annotations?.idempotentHint).toBeFalsy();
    });

    // The SDK does not currently support annotations on list resources
    /*test('List resources should include annotations', async () => {
        const resources = (await client.listResources()).resources;
        const testResource = resources.find(r => r.name === "annotation_test_resource");
        expect(testResource).toBeDefined();
        expect(testResource?.annotations?.audience).toContain("user");
        expect(testResource?.annotations?.priority).toBe("0.1");
    });

    test('List resource templates should include annotations', async () => {
        const templates = (await client.listResourceTemplates()).resourceTemplates;
        const testTemplate = templates.find(t => t.name === "annotation_test_resource_template");
        expect(testTemplate).toBeDefined();
        expect(testTemplate?.annotations?.audience).toContain("user");
        expect(testTemplate?.annotations?.priority).toBe("0.1");
    });*/

    test('Tool call response should include content with annotations and different resource types', async () => {
        const response = await client.callTool({ name: "AllHints" });
        
        const contentArray = Array.isArray(response.content) ? response.content : [];
        expect(contentArray.length).toBeGreaterThan(0);

        const textContent = contentArray.find(c => c.type === "text");
        expect(textContent).toBeDefined();
        expect(textContent?.annotations?.audience).toContain("assistant");

        const audioContent = contentArray.find(c => c.type === "audio");
        expect(audioContent).toBeDefined();
        expect(audioContent?.annotations?.audience).toContain("user");
        expect(audioContent?.annotations?.priority).toBe(0.1);

        const imageContent = contentArray.find(c => c.type === "image");
        expect(imageContent).toBeDefined();
        expect(imageContent?.annotations?.audience).toContain("user");
        expect(imageContent?.annotations?.priority).toBe(0.1);

        // Check text resource type
        const textResource = contentArray.find(c => 
            c.type === "resource" && c.resource && 'text' in c.resource
        );
        expect(textResource).toBeDefined();
        expect(textResource?.annotations).toBeDefined();
        expect(textResource?.annotations?.audience).toContain("user");
        expect(textResource?.annotations?.priority).toBe(0.1);

        // Check blob resource type
        const blobResource = contentArray.find(c => 
            c.type === "resource" && c.resource && ('blob' in c.resource)
        );
        expect(blobResource).toBeDefined();
        expect(blobResource?.annotations).toBeDefined();
        expect(blobResource?.annotations?.audience).toContain("user");
        expect(blobResource?.annotations?.priority).toBe(0.1);
    });

});