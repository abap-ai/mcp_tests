import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getEndpointUrl } from "./config.js";

describe('MCP Connection Tests', () => {
    const demoServer = "/test/test_minimal";

    test('should successfully connect to server', async () => {
        const client = new Client({
            name: 'test-client',
            version: '1.0.0'
        });
        const transport = new StreamableHTTPClientTransport(
            getEndpointUrl(demoServer),
        );
        
        await expect(client.connect(transport)).resolves.not.toThrow();
        await client.close();
    });
});
