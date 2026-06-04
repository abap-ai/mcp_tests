import { StreamableHTTPClientTransport, StreamableHTTPClientTransportOptions } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

type FetchFn = typeof fetch;

export class CookieAwareTransport extends StreamableHTTPClientTransport {
    private cookies: string[] = [];
    private originalFetch: FetchFn;
    private mcpSessionId: string | null = null;

    constructor(url: URL, opts?: StreamableHTTPClientTransportOptions) {
        super(url, opts);

        // Store original fetch implementation
        if (typeof globalThis.fetch !== "function") {
            throw new Error("Global fetch is not available in this Node runtime.");
        }
        this.originalFetch = globalThis.fetch.bind(globalThis);

        // Override fetch
        globalThis.fetch = async (url, init): Promise<Response> => {
            // Add stored cookies and session ID to request
            init = init || {};
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...((init.headers as Record<string, string>) || {}),
            };

            if (this.cookies.length > 0) {
                headers.cookie = this.cookies.join("; ");
            }

            if (this.mcpSessionId) {
                headers["mcp-session-id"] = this.mcpSessionId;
            }

            init.headers = headers;

            const response = await this.originalFetch(url, init);

            // Store cookies from response
            const setCookieHeader = response.headers.get('set-cookie');
            if (setCookieHeader) {
                const newCookies = setCookieHeader.split(',').map(cookie => cookie.trim());
                this.cookies = [...this.cookies, ...newCookies];
            }

            // Store MCP session ID from response
            const mcpSessionId = response.headers.get('mcp-session-id');
            if (mcpSessionId) {
                this.mcpSessionId = mcpSessionId;
            }

            return response;
        };
    }

    async close(): Promise<void> {
        // Reset all state
        this.cookies = [];
        this.mcpSessionId = null;
        
        // Restore original fetch
        globalThis.fetch = this.originalFetch;
        
        await super.close();
    }
}
