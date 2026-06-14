import { getEndpointUrl, getMcpBaseUrl } from "./config.js";

describe("test config", () => {
    const originalBaseUrl = process.env.MCP_BASE_URL;

    afterEach(() => {
        if (originalBaseUrl === undefined) {
            delete process.env.MCP_BASE_URL;
        } else {
            process.env.MCP_BASE_URL = originalBaseUrl;
        }
    });

    test("uses the default MCP base URL when no environment override is set", () => {
        delete process.env.MCP_BASE_URL;

        expect(getMcpBaseUrl().toString()).toBe("http://192.168.56.101:8000/zmcp");
    });

    test("uses MCP_BASE_URL when provided", () => {
        process.env.MCP_BASE_URL = "http://192.168.56.101:8000/custom-root/";

        expect(getMcpBaseUrl().toString()).toBe("http://192.168.56.101:8000/custom-root/");
    });

    test("builds endpoint URLs relative to the MCP base path", () => {
        process.env.MCP_BASE_URL = "http://192.168.56.101:8000/zmcp";

        expect(getEndpointUrl("/test/test_full").toString()).toBe(
            "http://192.168.56.101:8000/zmcp/test/test_full",
        );
    });
});
