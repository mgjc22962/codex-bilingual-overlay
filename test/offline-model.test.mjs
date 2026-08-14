import test from "node:test";
import assert from "node:assert/strict";

import { TranslationService } from "../src/translation-service.mjs";

test("translates a real plugin description with the installed offline model", { timeout: 30_000 }, async () => {
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
