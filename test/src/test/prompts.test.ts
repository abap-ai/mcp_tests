import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { IconSchema, ResourceLink, ResourceLinkSchema, TextResourceContents } from "@modelcontextprotocol/sdk/types.js";
import {
    isBlobResourceContents,
    isEmbeddedResource,
    isTextContent,
    isTextResourceContents,
} from "./contentGuards.js";
import { getEndpointUrl } from "./config.js";

describe('MCP Server Prompts Tests', () => {
    let client: Client;
    let transport: StreamableHTTPClientTransport;

    beforeEach(async () => {
        client = new Client({
            name: 'test-client',
            version: '1.0.0'
        });
        const demoServer = "/test/test_full";
        transport = new StreamableHTTPClientTransport(
            getEndpointUrl(demoServer),
        );
        await client.connect(transport);
    });

    afterEach(async () => {
        if (client) {
            await client.close();
        }
    });

    test('List prompts should return five prompts', async () => {
        const prompts = (await client.listPrompts()).prompts;
        expect(prompts).toHaveLength(5);
    });

    test('List prompts should include standard icons where advertised', async () => {
        const prompts = (await client.listPrompts()).prompts;

        const simplePrompt = prompts.find(p => p.name === "simple");
        expect(simplePrompt?.icons?.length).toBeGreaterThan(0);
        expect(() => IconSchema.array().parse(simplePrompt?.icons)).not.toThrow();
        expect(typeof simplePrompt?.icons?.[0]?.src).toBe("string");
        expect(typeof simplePrompt?.icons?.[0]?.mimeType).toBe("string");

        const metaPrompt = prompts.find(p => p.name === "test_meta");
        expect(() => IconSchema.array().parse(metaPrompt?.icons)).not.toThrow();
        expect(typeof metaPrompt?.icons?.[0]?.src).toBe("string");
        expect(typeof metaPrompt?.icons?.[0]?.mimeType).toBe("string");
        expect(metaPrompt?.icons?.[0]?.sizes).toEqual(["16x16"]);
        expect(metaPrompt?.icons?.[0]?.theme).toBe("light");

        const orderedPrompt = prompts.find(p => p.name === "ordered");
        expect(orderedPrompt?.icons).toBeUndefined();
    });

    test('List prompt should have one prompt with name "simple" and no arguments', async () => {
        const prompts = (await client.listPrompts()).prompts;
        const prompt = prompts.find(p => p.name === "simple");
        expect(prompt).toBeDefined();
        expect(prompt?.arguments).toBeUndefined();
    });

    test('List prompt should have one prompt with name "complex" and two arguments', async () => {
        const prompts = (await client.listPrompts()).prompts;
        const prompt = prompts.find(p => p.name === "complex");
        expect(prompt).toBeDefined();
        expect(prompt?.description).toEqual("A more complex test prompt with two arguments");
        expect(prompt?.arguments).toHaveLength(2);
        expect(prompt?.arguments?.[0]?.name).toEqual("optional");
        expect(prompt?.arguments?.[0]?.description).toEqual("Optional argument");
        expect(prompt?.arguments?.[0]?.required).not.toBeTruthy();
        expect(prompt?.arguments?.[1]?.name).toEqual("required");
        expect(prompt?.arguments?.[1]?.description).toEqual("Required argument");
        expect(prompt?.arguments?.[1]?.required).toEqual(true);
    });

    test('should get simple prompt by name', async () => {
        const prompt = await client.getPrompt({ name: "simple" });
        expect(prompt.description).toBe("Simple test prompt");
        expect(isTextContent(prompt.messages[0].content)).toBe(true);
        if (!isTextContent(prompt.messages[0].content)) {
            throw new Error("Expected text content");
        }
        expect(prompt.messages[0].content.text).toBe("This is a simple test prompt");
        expect(prompt.messages[0].role).toBe("user");
    });

    test('should get complex prompt by name with all arguments', async () => {
        const prompt = await client.getPrompt({ name: "complex",  arguments : { required: "req", optional: "opt" } });
        expect(prompt.description).toBe("A more complex test prompt with two arguments");
        expect(prompt.messages[0].role).toBe("user");
        expect(isTextContent(prompt.messages[0].content)).toBe(true);
        if (!isTextContent(prompt.messages[0].content)) {
            throw new Error("Expected text content");
        }
        expect(prompt.messages[0].content.text).toBe("Execute a complex test with required parameter 'req' with optional parameter 'opt'");
    });

    test('Complex prompt with missing required argument should throw error', async () => {
        await expect(client.getPrompt({ name: "complex", arguments: { optional: "opt" } }))
            .rejects
            .toThrow("MCP error -32602: Prompt complex requires parameter 'required'");
    });

    test('should throw error when getting non-existent prompt', async () => {
        await expect(client.getPrompt({ name: "nonexistent" }))
            .rejects
            .toThrow();
    });

    test('prompt all_content_types should return all content types)', async () => {
        const prompt = await client.getPrompt({ name: "all_content_types" });
        expect(prompt.messages.find(m => m.content.type === "text")).toBeDefined();
        expect(prompt.messages.find(m => m.content.type === "image")).toBeDefined();
        expect(prompt.messages.find(m => m.content.type === "audio")).toBeDefined();
        expect(
            prompt.messages.find(
                m =>
                    isEmbeddedResource(m.content) &&
                    m.content.resource.mimeType === "text/markdown" &&
                    isTextResourceContents(m.content.resource) &&
                    m.content.resource.text !== "",
            ),
        ).toBeDefined();
        expect(
            prompt.messages.find(
                m =>
                    isEmbeddedResource(m.content) &&
                    m.content.resource.mimeType === "image/gif" &&
                    isBlobResourceContents(m.content.resource) &&
                    m.content.resource.blob !== "",
            ),
        ).toBeDefined();
        expect(prompt.messages.find(m => m.content.type === "resource_link")).toBeDefined();
    });
    
    test('Ensure order of messages is preserved', async () => {
        const prompt = await client.getPrompt({ name: "ordered" });
        expect(isTextContent(prompt.messages[0].content)).toBe(true);
        if (!isTextContent(prompt.messages[0].content)) {
            throw new Error("Expected text content");
        }
        expect(prompt.messages[0].content.text).toBe("This is the first message");
        expect(isEmbeddedResource(prompt.messages[1].content)).toBe(true);
        if (!isEmbeddedResource(prompt.messages[1].content)) {
            throw new Error("Expected embedded resource content");
        }
        const resourceMessage = prompt.messages[1].content.resource as TextResourceContents;
        expect(resourceMessage.text).toBe("This is the second message");
        expect(isTextContent(prompt.messages[2].content)).toBe(true);
        if (!isTextContent(prompt.messages[2].content)) {
            throw new Error("Expected text content");
        }
        expect(prompt.messages[2].content.text).toBe("This is the third message");
    });

    test('List prompt should have one prompt with name "test_meta" and new fields', async () => {
        const prompts = (await client.listPrompts()).prompts;
        const prompt = prompts.find(p => p.name === "test_meta");
        expect(prompt).toBeDefined();
        expect(prompt?.description).toBe("Adding Meta Information");
        expect(prompt?.title).toBe("Test Meta Tile");
        expect(prompt?._meta).toBeDefined();
        expect(prompt?._meta?.["abapai/test1"]).toBe("This is a test meta information");
        expect(prompt?._meta?.["abapai/test2"]).toBe("This is another test meta information");
        expect(prompt?.arguments).toHaveLength(1);
        expect(prompt?.arguments?.[0]?.name).toBe("testArg");
        expect(prompt?.arguments?.[0]?.description).toBe("Test Arg Description");
    });

        test('test_meta prompt should return resource link message with meta information', async () => {
        const prompt = await client.getPrompt({ name: "test_meta", arguments: { testArg: "test_value" } });
        expect(prompt.description).toBe("Adding Meta Information");
        expect(prompt._meta).toBeDefined();
        expect(prompt._meta?.["abapai/promptTest"]).toBe("This is a test meta information");
        
        // Check for resource link message
        const resourceLinkContent = prompt.messages.find(
            m => m.content.type === "resource_link",
        )?.content;
        expect(() => ResourceLinkSchema.parse(resourceLinkContent)).not.toThrow();
        expect(resourceLinkContent?.type).toBe("resource_link");
        const resourceLinkMessage = resourceLinkContent as ResourceLink;
        expect(resourceLinkMessage).toBeDefined();
        expect(resourceLinkMessage?.uri).toBe("http://blubb.wuff/abcdf");
        expect(resourceLinkMessage?.description).toBe("Resource Link");
        expect(resourceLinkMessage?.title).toBe("Link Title");
        expect(resourceLinkMessage?._meta).toBeDefined();
        expect(resourceLinkMessage?._meta?.["abapai/reslinkTest"]).toBe("This is a test resource link meta information");
    });
});
