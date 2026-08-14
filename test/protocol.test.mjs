import test from "node:test";
import assert from "node:assert/strict";

import { createProtocol } from "../src/protocol.mjs";

test("advertises exactly the three bilingual control tools", () => {
  const protocol = createProtocol();

  assert.deepEqual(
    protocol.listTools().map((tool) => tool.name),
    [
      "show_bilingual_controls",
      "set_bilingual_mode",
      "get_bilingual_status",
    ],
  );
});

test("defaults to hover mode and returns a control-card resource", async () => {
  const protocol = createProtocol();

  const result = await protocol.callTool("show_bilingual_controls", {});

  assert.equal(result.structuredContent.mode, "hover");
  assert.equal(result._meta.ui.resourceUri, "ui://codex-bilingual-overlay/controls-v1.html");
  assert.match(result.content[0].text, /悬停翻译/);
});

test("starts hover on the first explicit control-card open but respects a later off choice", async () => {
  let runtimeMode = "off";
  const changes = [];
  const protocol = createProtocol({
    getRuntimeStatus: () => ({ mode: runtimeMode }),
    onModeChange: async (mode) => {
      runtimeMode = mode;
      changes.push(mode);
      return { mode };
    },
  });

  const first = await protocol.callTool("show_bilingual_controls", {});
  assert.equal(first.structuredContent.mode, "hover");
  await protocol.callTool("set_bilingual_mode", { mode: "off" });
  const reopened = await protocol.callTool("show_bilingual_controls", {});
  assert.equal(reopened.structuredContent.mode, "off");
  assert.deepEqual(changes, ["hover", "off"]);
});

test("restores the saved page-preload mode in a fresh MCP process", async () => {
  let savedMode = "hover";
  const modeStore = {
    read: () => savedMode,
    write: (mode) => { savedMode = mode; },
  };

  let firstRuntimeMode = "off";
  const first = createProtocol({
    modeStore,
    getRuntimeStatus: () => ({ mode: firstRuntimeMode }),
    onModeChange: async (mode) => {
      firstRuntimeMode = mode;
      return { mode };
    },
  });
  await first.callTool("set_bilingual_mode", { mode: "preload" });

  let secondRuntimeMode = "off";
  const restoredChanges = [];
  const second = createProtocol({
    modeStore,
    getRuntimeStatus: () => ({ mode: secondRuntimeMode }),
    onModeChange: async (mode) => {
      secondRuntimeMode = mode;
      restoredChanges.push(mode);
      return { mode };
    },
  });
  const reopened = await second.callTool("show_bilingual_controls", {});

  assert.equal(reopened.structuredContent.mode, "preload");
  assert.deepEqual(restoredChanges, ["preload"]);
});

test("changes mode only for supported values", async () => {
  const protocol = createProtocol();

  const changed = await protocol.callTool("set_bilingual_mode", { mode: "preload" });
  assert.equal(changed.structuredContent.mode, "preload");

  await assert.rejects(
    protocol.callTool("set_bilingual_mode", { mode: "invalid" }),
    /Unsupported bilingual mode/,
  );
  assert.equal(protocol.getStatus().mode, "preload");
});

test("status exposes the failure-isolation fields", async () => {
  const protocol = createProtocol();

  const result = await protocol.callTool("get_bilingual_status", {});

  assert.deepEqual(result.structuredContent, {
    mode: "hover",
    overlayState: "stopped",
    modelState: "not-installed",
    translatedBlocks: 0,
    totalBlocks: 0,
    lastError: null,
  });
});

test("keeps the previous mode and reports an isolated controller failure", async () => {
  const protocol = createProtocol({
    onModeChange: async () => { throw new Error("overlay unavailable"); },
  });

  await assert.rejects(
    protocol.callTool("set_bilingual_mode", { mode: "preload" }),
    /overlay unavailable/,
  );
  assert.equal(protocol.getStatus().mode, "hover");
  assert.equal(protocol.getStatus().lastError, "overlay unavailable");
});

test("merges live process state into status responses", async () => {
  const protocol = createProtocol({
    getRuntimeStatus: () => ({ overlayState: "running", modelState: "ready" }),
  });

  assert.equal(protocol.getStatus().overlayState, "running");
  assert.equal(protocol.getStatus().modelState, "ready");
});
