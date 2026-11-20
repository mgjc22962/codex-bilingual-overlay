import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const sourceRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(sourceRoot, ".codex-plugin", "plugin.json"), "utf8"));
const cacheRoot = process.argv[2] ?? resolve(
  process.env.USERPROFILE,
  ".codex", "plugins", "cache", "personal", "codex-bilingual-overlay", manifest.version,
);
const serverPath = resolve(cacheRoot, "src", "server.mjs");
if (!existsSync(serverPath)) throw new Error(`Installed MCP server not found: ${serverPath}`);

const stateDir = await mkdtemp(join(tmpdir(), "codex-bilingual-verify-"));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  cwd: cacheRoot,
  env: { CODEX_BILINGUAL_STATE_FILE: join(stateDir, "state.json") },
  stderr: "pipe",
});
const client = new Client({ name: "installed-bilingual-verifier", version: "1.0.0" });
try {
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  const controls = await client.callTool({ name: "show_bilingual_controls", arguments: {} });
  if (controls.isError) throw new Error(controls.content[0]?.text);
  const resource = await client.readResource({ uri: "ui://codex-bilingual-overlay/controls-v1.html" });
  const enabled = await client.callTool({
    name: "set_bilingual_mode",
    arguments: { mode: "hover" },
  });
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 700));
  const status = await client.callTool({ name: "get_bilingual_status", arguments: {} });
  const disabled = await client.callTool({
    name: "set_bilingual_mode",
    arguments: { mode: "off" },
  });
  process.stdout.write(`${JSON.stringify({
    cacheRoot,
    tools: names,
    controlMode: controls.structuredContent?.mode,
    controlCardBytes: resource.contents[0]?.text?.length ?? 0,
    enabledState: enabled.structuredContent?.overlayState,
    statusMode: status.structuredContent?.mode,
    disabledState: disabled.structuredContent?.overlayState,
  })}\n`);
} finally {
  try {
    await client.close();
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
}
