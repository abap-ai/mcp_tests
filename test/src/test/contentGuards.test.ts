import {
    BlobResourceContents,
    EmbeddedResource,
    TextContent,
    TextResourceContents,
} from "@modelcontextprotocol/sdk/types.js";
import {
    isBlobResourceContents,
    isEmbeddedResource,
    isTextContent,
    isTextResourceContents,
} from "./contentGuards.js";

describe("contentGuards", () => {
    test("identifies text content blocks", () => {
        const content: TextContent = {
            type: "text",
            text: "hello",
        };

        expect(isTextContent(content)).toBe(true);
    });

    test("identifies embedded resource content blocks", () => {
        const content: EmbeddedResource = {
            type: "resource",
            resource: {
                uri: "file://example.txt",
                mimeType: "text/plain",
                text: "hello",
            },
        };

        expect(isEmbeddedResource(content)).toBe(true);
    });

    test("distinguishes text and blob resource contents", () => {
        const textResource: TextResourceContents = {
            uri: "file://example.txt",
            mimeType: "text/plain",
            text: "hello",
        };
        const blobResource: BlobResourceContents = {
            uri: "file://example.bin",
            mimeType: "application/octet-stream",
            blob: "aGVsbG8=",
        };

        expect(isTextResourceContents(textResource)).toBe(true);
        expect(isBlobResourceContents(textResource)).toBe(false);
        expect(isBlobResourceContents(blobResource)).toBe(true);
        expect(isTextResourceContents(blobResource)).toBe(false);
    });
});
