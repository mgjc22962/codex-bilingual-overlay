import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMcpServer } from "./mcp-server.mjs";
import { createBilingualRuntime } from "./runtime.mjs";

const runtime = createBilingualRuntime();
const server = createMcpServer(runtime.protocol);
const transport = new StdioServerTransport();

async function shutdown() {
  await runtime.close();
  await server.close();
}

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

try {
  await server.connect(transport);
} catch (error) {
  process.stderr.write(`codex-bilingual-overlay MCP failed: ${error?.stack || error}\n`);
  process.exitCode = 1;
}
