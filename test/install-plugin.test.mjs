import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("installer copies a clean plugin and preserves existing personal marketplace entries", () => {
  const temp = mkdtempSync(join(tmpdir(), "codex-bilingual-install-"));
  try {
    const pluginHome = join(temp, "plugins", "codex-bilingual-overlay");
    const marketplace = join(temp, ".agents", "plugins", "marketplace.json");
    mkdirSync(dirname(marketplace), { recursive: true });
    writeFileSync(marketplace, JSON.stringify({
      name: "personal",
      interface: { displayName: "Personal" },
      plugins: [{
        name: "existing-plugin",
        source: { source: "local", path: "./plugins/existing-plugin" },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: "Productivity",
      }],
    }));

    const result = spawnSync(process.execPath, [
      resolve("scripts/install-plugin.mjs"),
      "--skip-dependencies",
      "--skip-runtime",
      "--skip-codex",
    ], {
      cwd: resolve("."),
      env: {
        ...process.env,
        BILINGUAL_PLUGIN_HOME: pluginHome,
        BILINGUAL_MARKETPLACE_FILE: marketplace,
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(pluginHome, ".codex-plugin", "plugin.json")), true);
    assert.equal(existsSync(join(pluginHome, "node_modules")), false);
    assert.equal(existsSync(join(pluginHome, ".git")), false);
    const saved = JSON.parse(readFileSync(marketplace, "utf8"));
    assert.deepEqual(saved.plugins.map(({ name }) => name), ["existing-plugin", "codex-bilingual-overlay"]);
    const entry = saved.plugins[1];
    assert.equal(entry.source.path, "./plugins/codex-bilingual-overlay");
    assert.equal(entry.policy.installation, "AVAILABLE");
    assert.equal(entry.policy.authentication, "ON_INSTALL");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("installer can run npm ci in an isolated Windows plugin target", { timeout: 120_000 }, () => {
  const temp = mkdtempSync(join(tmpdir(), "codex-bilingual-npm-install-"));
  try {
    const pluginHome = join(temp, "plugins", "codex-bilingual-overlay");
    const marketplace = join(temp, ".agents", "plugins", "marketplace.json");
    const result = spawnSync(process.execPath, [
      resolve("scripts/install-plugin.mjs"),
      "--skip-runtime",
      "--skip-codex",
    ], {
      cwd: resolve("."),
      env: {
        ...process.env,
        BILINGUAL_PLUGIN_HOME: pluginHome,
        BILINGUAL_MARKETPLACE_FILE: marketplace,
      },
      encoding: "utf8",
      timeout: 120_000,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(pluginHome, "node_modules", "zod")), true);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
