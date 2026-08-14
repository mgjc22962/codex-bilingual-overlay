import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { PassThrough } from "node:stream";

import { OverlayController } from "../src/controller.mjs";

function fakeOverlayProcess({ withStdout = false } = {}) {
  const child = new EventEmitter();
  child.written = "";
  child.stdin = {
    writable: true,
    write(chunk) { child.written += String(chunk); },
  };
  child.stdout = withStdout ? new PassThrough() : null;
  child.stderr = null;
  child.exitCode = null;
  child.kill = () => {
    child.exitCode = 0;
    child.stdin.writable = false;
    child.stdout?.destroy();
    child.emit("exit", 0);
    return true;
  };
  return child;
}

function nextTranslation(controller) {
  return once(controller, "translation", { signal: AbortSignal.timeout(750) });
}

test("starts the isolated overlay only when translation is enabled", async () => {
  const child = fakeOverlayProcess();
  const controller = new OverlayController({
    spawnOverlay: () => child,
    translate: async () => "控制 Windows 应用",
  });

  await controller.setMode("hover");
  assert.equal(controller.getStatus().overlayState, "running");
  assert.match(child.written, /MODE\|hover/);

  await controller.setMode("off");
  assert.equal(controller.getStatus().overlayState, "stopped");
  assert.match(child.written, /MODE\|off/);
  assert.match(child.written, /EXIT/);
});

test("translates a hover event and sends only the parenthesized Chinese overlay", async () => {
  const child = fakeOverlayProcess({ withStdout: true });
  const controller = new OverlayController({
    spawnOverlay: () => child,
    translate: async (text) => {
      assert.equal(text, "Control Windows apps from ChatGPT");
      return "通过 ChatGPT 控制 Windows 应用";
    },
  });
  await controller.setMode("hover");

  const source = Buffer.from("Control Windows apps from ChatGPT", "utf8").toString("base64");
  const translatedEvent = nextTranslation(controller);
  child.stdout.write(`HOVER|${source}|100|200|400|32\n`);
  await translatedEvent;

  const translated = Buffer.from("（通过 ChatGPT 控制 Windows 应用）", "utf8").toString("base64");
  assert.ok(child.written.includes(`SHOW|hover|${translated}|100|200|400|32|below`));
  assert.equal(controller.getStatus().translatedBlocks, 1);
  await controller.setMode("off");
});

test("preloads multiple visible blocks and ignores results from an older page revision", async () => {
  const child = fakeOverlayProcess({ withStdout: true });
  const deferred = new Map();
  const controller = new OverlayController({
    spawnOverlay: () => child,
    translate: (text) => new Promise((resolve) => deferred.set(text, resolve)),
  });
  await controller.setMode("preload");

  const first = Buffer.from("Create presentations", "utf8").toString("base64");
  const second = Buffer.from("Manage Google Calendar events", "utf8").toString("base64");
  child.stdout.write("PRELOAD_RESET|7\n");
  child.stdout.write(`PRELOAD|7|a|${first}|10|20|300|30\n`);
  child.stdout.write("PRELOAD_RESET|8\n");
  child.stdout.write(`PRELOAD|8|b|${second}|40|50|320|30\n`);

  while (deferred.size < 2) await new Promise((resolve) => setImmediate(resolve));
  deferred.get("Create presentations")("创建演示文稿");
  deferred.get("Manage Google Calendar events")("管理 Google Calendar 事件");
  await once(controller, "translation");

  const current = Buffer.from("（管理 Google Calendar 事件）", "utf8").toString("base64");
  assert.match(child.written, /RESET\n/);
  assert.ok(child.written.includes(`SHOW|preload-8-b|${current}|40|50|320|30|below`));
  assert.doesNotMatch(child.written, /preload-7-a/);
  await controller.setMode("off");
});

test("localizes a typed title candidate separately from its description", async () => {
  const child = fakeOverlayProcess({ withStdout: true });
  const controller = new OverlayController({ spawnOverlay: () => child });
  await controller.setMode("preload");
  child.stdout.write("PRELOAD_RESET|9\n");

  const title = Buffer.from("Computer Use", "utf8").toString("base64");
  const description = Buffer.from("Control Windows apps from ChatGPT", "utf8").toString("base64");
  const translatedEvent = nextTranslation(controller);
  child.stdout.write(`PRELOAD|9|title-1|title|${title}|${description}|10|20|240|30\n`);
  await translatedEvent;

  const localized = Buffer.from("（电脑控制）", "utf8").toString("base64");
  assert.ok(child.written.includes(`SHOW|preload-9-title-1|${localized}|10|20|240|30|inline`));
  await controller.setMode("off");
});

test("uses the exact localized product name only when that title is hovered", async () => {
  const child = fakeOverlayProcess({ withStdout: true });
  const controller = new OverlayController({
    spawnOverlay: () => child,
    translate: async () => "电脑使用",
  });
  await controller.setMode("hover");

  const title = Buffer.from("Computer Use", "utf8").toString("base64");
  const translatedEvent = nextTranslation(controller);
  child.stdout.write(`HOVER|${title}|100|200|175|30\n`);
  await translatedEvent;

  const localized = Buffer.from("（电脑控制）", "utf8").toString("base64");
  assert.ok(child.written.includes(`SHOW|hover|${localized}|100|200|175|30|inline`));
  await controller.setMode("off");
});

test("shows a card title translation and its description translation at the same time", async () => {
  const child = fakeOverlayProcess({ withStdout: true });
  const controller = new OverlayController({ spawnOverlay: () => child });
  const translations = [];
  controller.on("translation", (event) => translations.push(event));
  await controller.setMode("hover");

  const title = Buffer.from("Computer Use", "utf8").toString("base64");
  const description = Buffer.from("Control Windows apps from ChatGPT", "utf8").toString("base64");
  child.stdout.write(`HOVER_CARD|${title}|${description}|100|200|180|28|100|234|340|28\n`);
  await new Promise((resolve) => setImmediate(resolve));

  const localizedTitle = Buffer.from("（电脑控制）", "utf8").toString("base64");
  const localizedDescription = Buffer.from("（通过 ChatGPT 控制 Windows 应用）", "utf8").toString("base64");
  assert.ok(child.written.includes(`SHOW|hover-card-title|${localizedTitle}|100|200|180|28|inline`));
  assert.ok(child.written.includes(`SHOW|hover-card-description|${localizedDescription}|100|234|340|28|below`));
  assert.deepEqual(translations.map(({ key }) => key), ["hover-card-title", "hover-card-description"]);
  await controller.setMode("off");
});

test("shows one complete Skill translation panel while its body is hovered", async () => {
  const child = fakeOverlayProcess({ withStdout: true });
  const translations = new Map([
    ["Use this skill.", "使用此技能。"],
    ["Initialize the runtime.", "初始化运行时。"],
  ]);
  const controller = new OverlayController({
    spawnOverlay: () => child,
    translate: async (text) => translations.get(text),
  });
  await controller.setMode("hover");

  const source = Buffer.from("Use this skill.\n\nInitialize the runtime.", "utf8").toString("base64");
  const translatedEvent = nextTranslation(controller);
  child.stdout.write(`HOVER_FULL|${source}|180|190|560|520\n`);
  await translatedEvent;

  const panel = Buffer.from("完整中文翻译\n\n使用此技能。\n\n初始化运行时。", "utf8").toString("base64");
  assert.ok(child.written.includes(`SHOW|hover|${panel}|180|190|560|520|panel`));
  await controller.setMode("off");
});

test("never opens a full translation panel for a Chinese chat block with English terms", async () => {
  const child = fakeOverlayProcess({ withStdout: true });
  let translateCalls = 0;
  const controller = new OverlayController({
    spawnOverlay: () => child,
    translate: async () => {
      translateCalls += 1;
      return "不应出现";
    },
  });
  await controller.setMode("hover");

  const mixedChinese = "这是一个中文对话大段，不能打开全文翻译面板。Computer Use Codex plugin skill translations controller automation.";
  const source = Buffer.from(mixedChinese, "utf8").toString("base64");
  child.stdout.write(`HOVER_FULL|${source}|180|190|560|520\n`);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(translateCalls, 0);
  assert.doesNotMatch(child.written, /SHOW\|hover\|/u);
  await controller.setMode("off");
});

test("translates only extracted English from a Chinese conversation block", async () => {
  const child = fakeOverlayProcess({ withStdout: true });
  const inputs = [];
  const controller = new OverlayController({
    spawnOverlay: () => child,
    translate: async (text) => { inputs.push(text); return "英文内容译文"; },
  });
  await controller.setMode("hover");
  const mixed = Buffer.from("这是很长的中文对话，只有 Computer Use 和 This is a complete English sentence. 需要翻译。", "utf8").toString("base64");
  child.stdout.write(`HOVER|${mixed}|100|100|700|180\n`);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(inputs, ["Computer Use\n\nThis is a complete English sentence."]);
  assert.doesNotMatch(inputs[0], /\p{Script=Han}/u);
  await controller.setMode("off");
});

test("renders one paragraph-preserving full Skill translation panel", async () => {
  const child = fakeOverlayProcess({ withStdout: true });
  const translations = new Map([
    ["First paragraph.", "第一段。"],
    ["Second paragraph.", "第二段。"],
  ]);
  const controller = new OverlayController({
    spawnOverlay: () => child,
    translate: async (text) => translations.get(text),
  });
  await controller.setMode("preload");
  child.stdout.write("PRELOAD_RESET|10\n");

  const fullText = Buffer.from("First paragraph.\n\nSecond paragraph.", "utf8").toString("base64");
  const empty = Buffer.from("", "utf8").toString("base64");
  const translatedEvent = nextTranslation(controller);
  child.stdout.write(`PRELOAD|10|full-1|full|${fullText}|${empty}|600|180|620|700\n`);
  await translatedEvent;

  const panel = Buffer.from("完整中文翻译\n\n第一段。\n\n第二段。", "utf8").toString("base64");
  assert.ok(child.written.includes(`SHOW|preload-10-full-1|${panel}|600|180|620|700|panel`));
  assert.equal((child.written.match(/preload-10-full-1/g) ?? []).length, 1);
  await controller.setMode("off");
});

test("keeps an unreliable unknown title unchanged", async () => {
  const child = fakeOverlayProcess({ withStdout: true });
  const controller = new OverlayController({ spawnOverlay: () => child });
  await controller.setMode("preload");
  child.stdout.write("PRELOAD_RESET|11\n");

  const unknown = Buffer.from("Acme", "utf8").toString("base64");
  const empty = Buffer.from("", "utf8").toString("base64");
  child.stdout.write(`PRELOAD|11|title-2|title|${unknown}|${empty}|10|60|240|30\n`);
  await new Promise((resolve) => setImmediate(resolve));

  assert.doesNotMatch(child.written, /preload-11-title-2/);
  await controller.setMode("off");
});

test("isolates an overlay crash and can still return to off", async () => {
  const child = fakeOverlayProcess();
  const controller = new OverlayController({ spawnOverlay: () => child });
  await controller.setMode("hover");
  child.stdin.writable = false;
  child.emit("exit", 9);

  assert.equal(controller.getStatus().overlayState, "failed");
  assert.match(controller.getStatus().lastError, /code 9/);
  const stopped = await controller.setMode("off");
  assert.equal(stopped.overlayState, "stopped");
  assert.equal(stopped.mode, "off");
});
