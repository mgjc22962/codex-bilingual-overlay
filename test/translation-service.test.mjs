import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { TranslationService } from "../src/translation-service.mjs";

function fakeWorker() {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {
    child.emit("exit", 0);
    return true;
  };
  return child;
}

test("uses one isolated worker and caches repeated translations", async () => {
  const child = fakeWorker();
  let spawnCount = 0;
  let requestCount = 0;
  child.stdin.on("data", (chunk) => {
    for (const line of chunk.toString("utf8").trim().split("\n")) {
      const request = JSON.parse(line);
      requestCount += 1;
      child.stdout.write(`${JSON.stringify({ id: request.id, translated: "创建演示文稿" })}\n`);
    }
  });

  const service = new TranslationService({
    spawnWorker: () => {
      spawnCount += 1;
      return child;
    },
  });

  assert.equal(await service.translate("Create presentations"), "创建演示文稿");
  assert.equal(await service.translate("Create presentations"), "创建演示文稿");
  assert.equal(spawnCount, 1);
  assert.equal(requestCount, 1);
  service.close();
});

test("restores brands and technical tokens after translation", async () => {
  const child = fakeWorker();
  child.stdin.on("data", (chunk) => {
    const request = JSON.parse(chunk.toString("utf8"));
    assert.doesNotMatch(request.text, /ChatGPT|SKILL\.md/);
    child.stdout.write(`${JSON.stringify({
      id: request.id,
      translated: `通过 ${request.text} 控制应用`,
    })}\n`);
  });
  const service = new TranslationService({ spawnWorker: () => child });

  const translated = await service.translate("Control apps with ChatGPT from SKILL.md");
  assert.match(translated, /ChatGPT/);
  assert.match(translated, /SKILL\.md/);
  service.close();
});

test("rejects pending work when the worker fails without crashing the host", async () => {
  const child = fakeWorker();
  const service = new TranslationService({ spawnWorker: () => child, requestTimeoutMs: 1000 });
  const pending = service.translate("Control Windows apps");
  child.emit("exit", 9);

  await assert.rejects(pending, /exited with code 9/);
  assert.equal(service.getStatus().modelState, "failed");
  assert.match(service.getStatus().lastError, /exited with code 9/);
});

test("warms the offline model before the first hover translation", async () => {
  const child = fakeWorker();
  const service = new TranslationService({ spawnWorker: () => child });

  const warming = service.warmUp();
  assert.equal(service.getStatus().modelState, "loading");
  child.stdout.write(`${JSON.stringify({ type: "ready" })}\n`);

  await warming;
  assert.equal(service.getStatus().modelState, "ready");
  service.close();
});

test("keeps the worker startup error when the process exits", async () => {
  const child = fakeWorker();
  const service = new TranslationService({ spawnWorker: () => child });

  const warming = service.warmUp();
  child.stderr.write("No Python at C:\\Users\\old-profile\\python.exe\n");
  child.emit("exit", 103);

  await assert.rejects(warming, /No Python at .*exited with code 103/u);
  assert.match(service.getStatus().lastError, /No Python at .*exited with code 103/u);
});
