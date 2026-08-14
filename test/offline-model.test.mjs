import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { TranslationService } from "../src/translation-service.mjs";

const runtimeRoot = process.env.BILINGUAL_RUNTIME_DIR
  ?? resolve(process.env.PUBLIC ?? "C:\\Users\\Public", "CodexBilingualOverlay");
const hasOfflineRuntime = existsSync(resolve(runtimeRoot, "python", "Scripts", "python.exe"))
  && existsSync(resolve(runtimeRoot, "model", "translate-en_zh-1_9", "model", "model.bin"));

test("translates a real plugin description with the installed offline model", {
  timeout: 30_000,
  skip: hasOfflineRuntime ? false : "offline model is installed separately from the source repository",
}, async () => {
  const service = new TranslationService({ requestTimeoutMs: 25_000 });
  try {
    const source = "Create presentations and documents with ChatGPT";
    const translated = await service.translate(source);
    assert.match(translated, /[\u3400-\u9fff]/);
    assert.match(translated, /ChatGPT/);
    assert.notEqual(translated, source);
    const calendar = await service.translate("Manage Google Calendar events and schedules");
    assert.match(calendar, /Google Calendar/);
    assert.match(calendar, /[\u3400-\u9fff]/);
    assert.equal(service.getStatus().modelState, "ready");
  } finally {
    service.close();
  }
});
