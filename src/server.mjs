import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createControlWindow } from "./control-window.mjs";
import { createMcpServer } from "./mcp-server.mjs";
import { createBilingualRuntime } from "./runtime.mjs";

const runtime = createBilingualRuntime();
const controlWindow = process.platform === "win32"
  ? createControlWindow(async (mode) => {
    const result = await runtime.protocol.callTool("set_bilingual_mode", { mode });
    return result.structuredContent.mode;
  })
  : undefined;
const server = createMcpServer(runtime.protocol, { controlWindow });
const transport = new StdioServerTransport();

async function shutdown() {
  controlWindow?.close();
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
