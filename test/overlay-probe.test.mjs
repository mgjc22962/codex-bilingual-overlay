import test from "node:test";
import assert from "node:assert/strict";

import { runOverlayProbe, runPanelProbe } from "../src/overlay-process.mjs";

test("creates a non-activating click-through Windows overlay", async () => {
  const probe = await runOverlayProbe();

  assert.deepEqual(probe, {
    handleCreated: true,
    transparent: true,
    layered: true,
    noActivate: true,
    toolWindow: true,
    hitTest: -1,
  });
});

test("creates a non-overlapping click-through Skill translation panel", async () => {
  const probe = await runPanelProbe();

  assert.equal(probe.transparent, true);
  assert.equal(probe.noActivate, true);
  assert.equal(probe.hitTest, -1);
  assert.equal(probe.layout, "panel");
  assert.equal(probe.overlapsSource, false);
  assert.ok(probe.width >= 360);
  assert.ok(probe.height >= 300);
});

test("aggregates split Skill UIA nodes into one paragraph-preserving source", async () => {
  const module = await import("../src/overlay-process.mjs");
  assert.equal(typeof module.runSkillAggregationProbe, "function");
  const probe = await module.runSkillAggregationProbe();

  assert.equal(probe.found, true);
  assert.match(probe.text, /^Use this skill/u);
  assert.match(probe.text, /SKILL\.md/u);
  assert.match(probe.text, /\n\nInitialize\n\n/u);
  assert.equal(probe.containsTrailingMetadata, false);
});

test("aggregates generic plugin Skill pages without Computer Use markers", async () => {
  const module = await import("../src/overlay-process.mjs");
  assert.equal(typeof module.runGenericSkillAggregationProbe, "function");
  const probe = await module.runGenericSkillAggregationProbe();

  assert.equal(probe.chromeFound, true);
  assert.match(probe.chromeText, /^Control the user's Chrome browser/u);
  assert.match(probe.chromeText, /Stop: choose the right surface/u);
  assert.equal(probe.documentFound, true);
  assert.match(probe.documentText, /^Create and edit document artifacts/u);
  assert.equal(probe.combinedNodeFound, true);
  assert.match(probe.combinedNodeText, /Control Chrome Skill/u);
  assert.match(probe.combinedNodeText, /browser automation tasks/u);
});

test("splits one marketplace card into separate title and description hover targets", async () => {
  const module = await import("../src/overlay-process.mjs");
  assert.equal(typeof module.runCardHoverProbe, "function");
  const probe = await module.runCardHoverProbe();

  assert.equal(probe.title, "Computer Use");
  assert.equal(probe.description, "Control Windows apps from ChatGPT");
  assert.ok(probe.titleY < probe.descriptionY);
  assert.ok(probe.titleWidth > 80);
  assert.ok(probe.descriptionWidth > 160);
});
