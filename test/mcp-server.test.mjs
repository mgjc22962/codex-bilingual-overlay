import test from "node:test";
import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { EXTENSION_ID, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

import { createProtocol, CONTROL_RESOURCE_URI } from "../src/protocol.mjs";
import { createMcpServer } from "../src/mcp-server.mjs";

async function withClient(run, { controlWindow, capabilities } = {}) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(createProtocol(), { controlWindow });
  const client = new Client({ name: "bilingual-test", version: "1.0.0" }, { capabilities });
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

test("opens a Windows control window for an MCP client without embedded UI", async () => {
  const opened = [];
  const controlWindow = { show: async (mode) => opened.push(mode) };
  await withClient(async (client) => {
    const controls = await client.callTool({ name: "show_bilingual_controls", arguments: {} });
    assert.deepEqual(opened, ["hover"]);
    assert.match(controls.content[0].text, /已在 Windows 桌面打开/);
    assert.equal(controls.structuredContent.mode, "hover");
  }, { controlWindow });
});

test("reports failure when the Windows control window cannot open", async () => {
  const controlWindow = { show: async () => { throw new Error("desktop unavailable"); } };
  await withClient(async (client) => {
    const controls = await client.callTool({ name: "show_bilingual_controls", arguments: {} });
    assert.equal(controls.isError, true);
    assert.match(controls.content[0].text, /desktop unavailable/);
    const status = await client.callTool({ name: "get_bilingual_status", arguments: {} });
    assert.equal(status.structuredContent.mode, "hover");
  }, { controlWindow });
});

test("keeps embedded controls for clients advertising MCP Apps support", async () => {
  const controlWindow = { show: async () => { throw new Error("Unexpected desktop window"); } };
  const capabilities = { extensions: { [EXTENSION_ID]: { mimeTypes: [RESOURCE_MIME_TYPE] } } };
  await withClient(async (client) => {
    const controls = await client.callTool({ name: "show_bilingual_controls", arguments: {} });
    assert.equal(controls.isError, undefined);
    assert.equal(controls._meta.ui.resourceUri, CONTROL_RESOURCE_URI);
  }, { capabilities, controlWindow });
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
