# Agent Notes

This test project validates MCP standard conformance for the ABAP MCP SDK test servers.

- Use the real `@modelcontextprotocol/sdk` client APIs and schemas in tests. Do not replace SDK validation with raw JSON shape checks when the SDK exposes a standard schema or method.
- The ABAP SDK currently does not support SSE upgrades, streaming responses, or server-to-client notifications. Tests must not require streaming transport behavior or notification delivery.
- Task tests should use standard task-augmented request/response flows: create with the `task` request option, then use `client.experimental.tasks.getTask`, `getTaskResult`, `listTasks`, and `cancelTask`.
- Keep `MCP_BASE_URL` support intact so the same suite can target different ABAP systems without editing test sources.
