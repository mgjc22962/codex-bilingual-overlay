import test from "node:test";
import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createProtocol, CONTROL_RESOURCE_URI } from "../src/protocol.mjs";
import { createMcpServer } from "../src/mcp-server.mjs";

async function withClient(run) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(createProtocol());
  const client = new Client({ name: "bilingual-test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

test("serves all three control tools over a real MCP connection", async () => {
  await withClient(async (client) => {
    const response = await client.listTools();
    assert.deepEqual(
      response.tools.map((tool) => tool.name),
      ["show_bilingual_controls", "set_bilingual_mode", "get_bilingual_status"],
    );

    const status = await client.callTool({
      name: "get_bilingual_status",
      arguments: {},
    });
    assert.equal(status.structuredContent.mode, "hover");
  });
});

test("serves a self-contained bilingual control card", async () => {
  await withClient(async (client) => {
    const response = await client.readResource({ uri: CONTROL_RESOURCE_URI });
    const resource = response.contents[0];

    assert.equal(resource.mimeType, "text/html;profile=mcp-app");
    assert.match(resource.text, /中英双语增强器/);
    assert.match(resource.text, /data-mode="off"/);
    assert.match(resource.text, /data-mode="hover"/);
    assert.match(resource.text, /data-mode="preload"/);
    assert.match(resource.text, /callTool/);
    assert.match(resource.text, /callTool\("set_bilingual_mode", \{ mode \}\)/);
    assert.doesNotMatch(resource.text, /callTool\(\{ name: "set_bilingual_mode"/);
  });
});
