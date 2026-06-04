import {
    ErrorCode,
    InitializeResultSchema,
    JSONRPCErrorResponseSchema,
    JSONRPCResultResponseSchema,
    LATEST_PROTOCOL_VERSION,
} from "@modelcontextprotocol/sdk/types.js";
import { getEndpointUrl } from "./config.js";

const fullServer = "/test/test_full";
const mcpSessionServer = "/test/test_mcp_session";

const jsonHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
};

function endpoint(path = fullServer): URL {
    return getEndpointUrl(path);
}

async function postRaw(body: string, headers: Record<string, string> = jsonHeaders, path = fullServer): Promise<Response> {
    return fetch(endpoint(path), {
        method: "POST",
        headers,
        body,
    });
}

function initializeRequest(id: string | number): string {
    return JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "initialize",
        params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
                name: "raw-http-test-client",
                version: "1.0.0",
            },
        },
    });
}

describe("MCP HTTP transport conformance", () => {
    test("JSON-RPC request id 0 is treated as a request id and echoed", async () => {
        const response = await postRaw(initializeRequest(0));

        expect(response.status).toBe(200);
        const message = JSONRPCResultResponseSchema.parse(await response.json());
        expect(message.id).toBe(0);
        expect(() => InitializeResultSchema.parse(message.result)).not.toThrow();
    });

    test("malformed JSON returns an SDK-parseable JSON-RPC parse error", async () => {
        const response = await postRaw(`{"jsonrpc":"2.0","id":1,"method":`);

        expect(response.status).toBe(400);
        expect(response.headers.get("content-type")?.toLowerCase()).toContain("application/json");

        const message = JSONRPCErrorResponseSchema.parse(await response.json());
        expect(message.error.code).toBe(ErrorCode.ParseError);
    });

    test("structurally invalid JSON-RPC returns invalid request and preserves usable id 0", async () => {
        const response = await postRaw(JSON.stringify({ jsonrpc: "2.0", id: 0 }));

        expect(response.status).toBe(400);
        const message = JSONRPCErrorResponseSchema.parse(await response.json());
        expect(message.id).toBe(0);
        expect(message.error.code).toBe(ErrorCode.InvalidRequest);
    });

    test("JSON-RPC notifications receive 202 and no response body", async () => {
        const response = await postRaw(
            JSON.stringify({
                jsonrpc: "2.0",
                method: "notifications/initialized",
            }),
        );

        expect(response.status).toBe(202);
        expect(await response.text()).toBe("");
    });

    test("JSON-RPC batch arrays are rejected because the ABAP SDK does not support batches", async () => {
        const response = await postRaw(
            JSON.stringify([
                {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "ping",
                },
            ]),
        );

        expect(response.status).toBe(400);
        const message = JSONRPCErrorResponseSchema.parse(await response.json());
        expect(message.error.code).toBe(ErrorCode.InvalidRequest);
    });


    test("MCP session requests without a session id return a JSON-RPC error body", async () => {
        const response = await postRaw(
            JSON.stringify({
                jsonrpc: "2.0",
                id: "missing-session",
                method: "tools/list",
                params: {},
            }),
            jsonHeaders,
            mcpSessionServer,
        );

        expect(response.status).toBe(400);
        expect(response.headers.get("content-type")?.toLowerCase()).toContain("application/json");

        const message = JSONRPCErrorResponseSchema.parse(await response.json());
        expect(message.id).toBe("missing-session");
        expect(message.error.code).toBe(ErrorCode.InvalidRequest);
        expect(message.error.message).toContain("Missing Mcp-Session-Id");
    });

    test("MCP session requests with an unknown session id return a JSON-RPC error body", async () => {
        const response = await postRaw(
            JSON.stringify({
                jsonrpc: "2.0",
                id: "unknown-session",
                method: "tools/list",
                params: {},
            }),
            {
                ...jsonHeaders,
                "Mcp-Session-Id": "00000000000000000000000000000000",
            },
            mcpSessionServer,
        );

        expect(response.status).toBe(404);
        expect(response.headers.get("content-type")?.toLowerCase()).toContain("application/json");

        const message = JSONRPCErrorResponseSchema.parse(await response.json());
        expect(message.id).toBe("unknown-session");
        expect(message.error.code).toBe(ErrorCode.InvalidRequest);
        expect(message.error.message).toContain("Invalid or expired MCP session");
    });

    test("CORS preflight allows MCP request headers", async () => {
        const response = await fetch(endpoint(), {
            method: "OPTIONS",
            headers: {
                Origin: "https://client.example",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
            },
        });

        expect([200, 204]).toContain(response.status);
        const allowHeaders = response.headers.get("access-control-allow-headers")?.toLowerCase();

        expect(allowHeaders).toContain("content-type");
        expect(allowHeaders).toContain("mcp-session-id");
        expect(allowHeaders).toContain("mcp-protocol-version");
    });

    test("GET advertises all supported methods in the Allow header", async () => {
        const response = await fetch(endpoint(), {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        });

        expect(response.status).toBe(405);
        const allow = response.headers.get("allow");

        expect(allow).toContain("POST");
        expect(allow).toContain("DELETE");
        expect(allow).toContain("OPTIONS");
    });

    test("ABAP transport accepts JSON-only requests as a documented no-SSE exception", async () => {
        const response = await postRaw(initializeRequest("json-only"), {
            "Content-Type": "application/json",
            Accept: "application/json",
        });

        expect(response.status).toBe(200);
        const message = JSONRPCResultResponseSchema.parse(await response.json());
        expect(message.id).toBe("json-only");
    });

    test("ABAP transport rejects SSE-only Accept because SSE upgrade is unsupported", async () => {
        const response = await postRaw(initializeRequest("sse-only"), {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
        });

        expect(response.status).toBe(406);
    });
});
