import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { BlobResourceContents, CallToolResult, ResourceLink, TextResourceContents } from "@modelcontextprotocol/sdk/types.js";

describe('MCP Server Tools Tests', () => {
    const baseUrl = new URL("http://localhost:8000/zmcp");
    let client: Client;
    let transport: StreamableHTTPClientTransport;

    beforeEach(async () => {
        client = new Client({
            name: 'test-client',
            version: '1.0.0'
        });
        const demoServer = "/test/test_full";
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

    test('List tools should return three tools', async () => {
        const tools = (await client.listTools()).tools;
        expect(tools).toHaveLength(4);
    });

    test('List tools should include specific tools', async () => {
        const tools = (await client.listTools()).tools;
        
        const allContentTool = tools.find(t => t.name === "All Content Types");
        expect(allContentTool).toBeDefined();
        expect(allContentTool?.description).toBe("A test tool that returns all content types");

        const inputTestTool = tools.find(t => t.name === "Input Test");
        expect(inputTestTool).toBeDefined();
        expect(inputTestTool?.description).toBe("A test tool with a complex input");
        expect(inputTestTool?.inputSchema).toBeDefined();
    });

    test('Should execute All Content Types tool', async () => {
        const result = await client.callTool({ 
            name: "All Content Types"
        });

        // Check meta information on the result
        expect(result._meta).toBeDefined();
        expect(result._meta?.["abapai/toolTest"]).toBe("This is a test meta information");

        const content = result.content as CallToolResult[]; 
        expect(content).toHaveLength(6); // Now expecting 6 items

        expect(content[0].text).toBe("Text Message");
        expect(content[1].mimeType).toBe("image/gif");
        const textResource = (content[2].resource as unknown) as TextResourceContents;
        expect(textResource.uri).toBe("file://testfile.md");
        const blobResource = (content[3].resource as unknown) as BlobResourceContents;
        expect(blobResource.uri).toBe("file://okay-.gif");
        expect(content[4].mimeType).toBe("audio/wav");

        // New: Check the resource link
        const resourceLink = content[5] as unknown as ResourceLink;
        expect(resourceLink.type).toBe("resource_link");
        expect(resourceLink.description).toBe("Resource Link");
        expect(resourceLink.title).toBe("Link Title");
        expect(resourceLink.name).toBe("Link Name");
        expect(resourceLink.uri).toBe("http://blubb.wuff/abcdf");
        expect(resourceLink._meta).toBeDefined();
        expect(resourceLink._meta?.["abapai/reslinkTest"]).toBe("This is a test resource link meta information");
    });

    test('Should execute Input Test tool successfully', async () => {
        const result = await client.callTool({
            name: "Input Test",
            arguments: {
                TextInput: "Test input",
                TestInputArray: [
                    { Line: 1, Text: "First line" },
                    { Line: 2, Text: "Second line" }
                ]
            }
        });

        const content = result.content as CallToolResult[];
        expect(content).toHaveLength(2);
        expect(content[0].text).toBe("Line 1 : First line");
        expect(content[1].text).toBe("Line 2 : Second line");
    });

    test('Should fail when TextInput is too long', async () => {
        await expect(client.callTool({
            name: "Input Test",
            arguments: {
                TextInput: "x".repeat(101),
                TestInputArray: [{ Line: 1, Text: "Test" }]
            }
        })).rejects.toThrow("String must have maximum length 100, but has 101");
    });

    test('Should fail when calling non-existent tool', async () => {
        await expect(client.callTool({
            name: "NonExistentTool"
        })).rejects.toThrow("Tool NonExistentTool not found.");
    });

    test('Error Test tool should return error state', async () => {
        const result = await client.callTool({
            name: "Error Test"
        });
        
        expect(result.isError).toBe(true);
        const content = result.content as CallToolResult[];
        expect(content[0].text).toBe("This is an error test");
    });

    test('Should execute Structured Output Test tool', async () => {
        const result = await client.callTool({
            name: "Structured Output Test"
        });

        // Check structured content
        const structured = result.structuredContent as Record<string, unknown>;
        expect(structured).toBeDefined();
        expect(structured.test_string).toBe("This is a test string");
        expect(structured.test_object).toBeDefined();
        expect((structured.test_object as any).test_object_string).toBe("This is a test string in an object");
        expect((structured.test_object as any).test_object_integer).toBe(42);

        // Optionally: Check output schema if returned
        if (result.outputSchema) {
            expect(result.outputSchema).toHaveProperty("test_string");
            expect(result.outputSchema).toHaveProperty("test_object");
            const outputSchema = result.outputSchema as { test_object?: { test_object_string?: unknown; test_object_integer?: unknown } };
            expect(outputSchema.test_object).toHaveProperty("test_object_string");
            expect(outputSchema.test_object).toHaveProperty("test_object_integer");
        }
    });
});