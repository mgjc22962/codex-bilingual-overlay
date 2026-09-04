import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("distinguishes an existing broken launcher from a runnable executable", async () => {
  const module = await import("../src/runtime-health.mjs");
  const directory = mkdtempSync(join(tmpdir(), "bilingual-runtime-health-"));
  const broken = join(directory, "python.exe");
  writeFileSync(broken, "not an executable");

  try {
    assert.equal(module.isRunnablePython(broken), false);
    const discovered = spawnSync("where.exe", ["python"], { encoding: "utf8" })
      .stdout.split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean);
    const bundled = join(
      process.env.USERPROFILE,
      ".cache", "codex-runtimes", "codex-primary-runtime",
      "dependencies", "python", "python.exe",
    );
    assert.ok([bundled, ...discovered].some((candidate) => module.isRunnablePython(candidate)));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
