import test from "node:test";
import assert from "node:assert/strict";

import {
  splitStructuredText,
  translateStructuredText,
} from "../src/full-text.mjs";

test("keeps English paragraph boundaries in one combined Chinese result", async () => {
  const source = [
    "First paragraph.",
    "Second paragraph.",
    "• guidance: Guide.\n• api: Reference.",
  ].join("\n\n");
  const calls = [];
  const translations = new Map([
    ["First paragraph.", "第一段。"],
    ["Second paragraph.", "第二段。"],
    ["• guidance: Guide.\n• api: Reference.", "• guidance：指南。\n• api：参考。"],
  ]);

  const result = await translateStructuredText(source, async (chunk) => {
    calls.push(chunk);
    return translations.get(chunk);
  });

  assert.deepEqual(calls, [
    "First paragraph.",
    "Second paragraph.",
    "• guidance: Guide.\n• api: Reference.",
  ]);
  assert.equal(result, [
    "第一段。",
    "第二段。",
    "• guidance：指南。\n• api：参考。",
  ].join("\n\n"));
});

test("splits an oversized paragraph at sentence boundaries without reordering", () => {
  const source = "Alpha sentence is complete. Beta sentence is also complete. Gamma ends.";

  assert.deepEqual(splitStructuredText(source, 35), [
    { paragraph: 0, chunk: "Alpha sentence is complete." },
    { paragraph: 0, chunk: "Beta sentence is also complete." },
    { paragraph: 0, chunk: "Gamma ends." },
  ]);
});

test("normalizes line endings but preserves bullet lines inside one paragraph", () => {
  const source = "Heading\r\n\r\n• guidance: One\r\n• api: Two";

  assert.deepEqual(splitStructuredText(source), [
    { paragraph: 0, chunk: "Heading" },
    { paragraph: 1, chunk: "• guidance: One\n• api: Two" },
  ]);
});
