import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("starts as a clean stdio MCP server", async () => {
  const serverPath = fileURLToPath(new URL("../src/server.mjs", import.meta.url));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    stderr: "pipe",
  });
  const client = new Client({ name: "stdio-test", version: "1.0.0" });
  await client.connect(transport);
  try {
    const response = await client.listTools();
    assert.equal(response.tools.length, 3);
    assert.equal(response.tools[0].name, "show_bilingual_controls");

    const enabled = await client.callTool({
      name: "set_bilingual_mode",
      arguments: { mode: "hover" },
    });
    assert.equal(enabled.structuredContent.mode, "hover");
    assert.equal(enabled.structuredContent.overlayState, "running");
    await new Promise((resolve) => setTimeout(resolve, 600));
    const whileEnabled = await client.listTools();
    assert.equal(whileEnabled.tools.length, 3);

    const disabled = await client.callTool({
      name: "set_bilingual_mode",
      arguments: { mode: "off" },
    });
    assert.equal(disabled.structuredContent.mode, "off");
    assert.equal(disabled.structuredContent.overlayState, "stopped");
  } finally {
    await client.close();
  }
});
