import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBilingualRuntime } from "../src/runtime.mjs";

test("wires MCP modes to the overlay and reports the offline model status", async () => {
  const modes = [];
  let translationClosed = false;
  const controller = {
    async setMode(mode) {
      modes.push(mode);
      return this.getStatus();
    },
    getStatus() {
      return {
        mode: modes.at(-1) ?? "off",
        overlayState: modes.at(-1) === "off" ? "stopped" : "running",
        translatedBlocks: 3,
        totalBlocks: 4,
        lastError: null,
      };
    },
  };
  const translation = {
    translate: async () => "翻译",
    getStatus: () => ({ modelState: "ready", cacheEntries: 2, lastError: null }),
    close: () => { translationClosed = true; },
  };

  const runtime = createBilingualRuntime({ controller, translation });
  const changed = await runtime.protocol.callTool("set_bilingual_mode", { mode: "preload" });
  assert.deepEqual(modes, ["preload"]);
  assert.equal(changed.structuredContent.overlayState, "running");
  assert.equal(changed.structuredContent.modelState, "ready");
  assert.equal(changed.structuredContent.cacheEntries, 2);

  await runtime.close();
  assert.deepEqual(modes, ["preload", "off"]);
  assert.equal(translationClosed, true);
});

test("persists the selected mode across independent runtime processes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "bilingual-mode-"));
  const previousStateFile = process.env.CODEX_BILINGUAL_STATE_FILE;
  process.env.CODEX_BILINGUAL_STATE_FILE = join(directory, "state.json");
  const translation = {
    translate: async () => "翻译",
    getStatus: () => ({ modelState: "ready", lastError: null }),
    close() {},
  };
  const makeController = () => {
    let mode = "off";
    return {
      async setMode(next) { mode = next; return this.getStatus(); },
      getStatus: () => ({ mode, overlayState: mode === "off" ? "stopped" : "running", lastError: null }),
    };
  };

  try {
    const first = createBilingualRuntime({ controller: makeController(), translation });
    await first.protocol.callTool("set_bilingual_mode", { mode: "preload" });

    const second = createBilingualRuntime({ controller: makeController(), translation });
    const reopened = await second.protocol.callTool("show_bilingual_controls", {});
    assert.equal(reopened.structuredContent.mode, "preload");
  } finally {
    if (previousStateFile === undefined) delete process.env.CODEX_BILINGUAL_STATE_FILE;
    else process.env.CODEX_BILINGUAL_STATE_FILE = previousStateFile;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("prewarms translation before enabling an active overlay mode", async () => {
  const events = [];
  const controller = {
    async setMode(mode) {
      events.push(`mode:${mode}`);
      return this.getStatus();
    },
    getStatus: () => ({ mode: "hover", overlayState: "running", lastError: null }),
  };
  const translation = {
    warmUp: async () => { events.push("warm"); },
    translate: async () => "翻译",
    getStatus: () => ({ modelState: "ready", cacheEntries: 0, lastError: null }),
    close() {},
  };
  const runtime = createBilingualRuntime({ controller, translation });

  await runtime.protocol.callTool("set_bilingual_mode", { mode: "hover" });

  assert.deepEqual(events, ["warm", "mode:hover"]);
});

test("keeps the overlay usable when optional model warmup fails", async () => {
  const modes = [];
  let modelState = "installed";
  let modelError = null;
  const controller = {
    async setMode(mode) {
      modes.push(mode);
      return this.getStatus();
    },
    getStatus: () => ({
      mode: modes.at(-1) ?? "off",
      overlayState: modes.at(-1) === "hover" ? "running" : "stopped",
      lastError: null,
    }),
  };
  const translation = {
    async warmUp() {
      modelState = "failed";
      modelError = "offline runtime unavailable";
      throw new Error(modelError);
    },
    translate: async () => "",
    getStatus: () => ({ modelState, cacheEntries: 0, lastError: modelError }),
    close() {},
  };
  const runtime = createBilingualRuntime({ controller, translation });

  const result = await runtime.protocol.callTool("set_bilingual_mode", { mode: "hover" });

  assert.deepEqual(modes, ["hover"]);
  assert.equal(result.structuredContent.overlayState, "running");
  assert.equal(result.structuredContent.modelState, "failed");
  assert.equal(result.structuredContent.lastError, "offline runtime unavailable");
});
