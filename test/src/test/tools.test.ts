import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { BlobResourceContents, CallToolResult, TextResourceContents } from "@modelcontextprotocol/sdk/types.js";

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
        expect(tools).toHaveLength(3);
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
        
        const content = result.content as CallToolResult[]; 
        expect(content).toHaveLength(5);
        expect(content[0].text).toBe("Text Message");
        expect(content[1].mimeType).toBe("image/gif");
        const textResource = (content[2].resource as unknown) as TextResourceContents;
        expect(textResource.uri).toBe("file://testfile.md");
        const blobResource = (content[3].resource as unknown) as BlobResourceContents;
        expect(blobResource.uri).toBe("file://okay-.gif");
        expect(content[4].mimeType).toBe("audio/wav");
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
});