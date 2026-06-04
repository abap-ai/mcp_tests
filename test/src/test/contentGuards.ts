import {
    BlobResourceContents,
    ContentBlock,
    EmbeddedResource,
    PromptArgument,
    TextContent,
    TextResourceContents,
} from "@modelcontextprotocol/sdk/types.js";

export type PromptArgumentWithTitle = PromptArgument & {
    title?: string;
};

export function isTextContent(content: ContentBlock): content is TextContent {
    return content.type === "text";
}

export function isEmbeddedResource(content: ContentBlock): content is EmbeddedResource {
    return content.type === "resource";
}

export function isTextResourceContents(
    resource: TextResourceContents | BlobResourceContents,
): resource is TextResourceContents {
    return "text" in resource;
}

export function isBlobResourceContents(
    resource: TextResourceContents | BlobResourceContents,
): resource is BlobResourceContents {
    return "blob" in resource;
}
