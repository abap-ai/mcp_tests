export function getMcpBaseUrl(): URL {
    return new URL(process.env.MCP_BASE_URL ?? "http://localhost:8000/zmcp");
}

export function getEndpointUrl(path: string): URL {
    const baseUrl = getMcpBaseUrl();
    const normalizedBase = baseUrl.toString().endsWith("/") ? baseUrl.toString() : `${baseUrl.toString()}/`;
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    return new URL(normalizedPath, normalizedBase);
}
