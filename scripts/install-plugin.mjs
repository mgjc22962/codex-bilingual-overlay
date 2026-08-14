import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_NAME = "codex-bilingual-overlay";
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginHome = resolve(process.env.BILINGUAL_PLUGIN_HOME ?? join(homedir(), "plugins", PLUGIN_NAME));
const marketplaceFile = resolve(
  process.env.BILINGUAL_MARKETPLACE_FILE
    ?? join(homedir(), ".agents", "plugins", "marketplace.json"),
);
const flags = new Set(process.argv.slice(2));

function assertSafePluginTarget(target) {
  if (basename(target).toLowerCase() !== PLUGIN_NAME) {
    throw new Error(`Refusing unexpected plugin target: ${target}`);
  }
}

function copyCleanPlugin(source, target) {
  if (resolve(source).toLowerCase() === resolve(target).toLowerCase()) return;
  assertSafePluginTarget(target);
  mkdirSync(target, { recursive: true });
  const excluded = new Set([".git", "node_modules", "coverage", ".env"]);
  cpSync(source, target, {
    recursive: true,
    force: true,
    filter(path) {
      const rel = relative(source, path);
      if (!rel) return true;
      return !excluded.has(rel.split(sep)[0]);
    },
  });
}

function updatePersonalMarketplace(path) {
  const marketplace = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : { name: "personal", interface: { displayName: "Personal" }, plugins: [] };
  marketplace.name ??= "personal";
  marketplace.interface ??= { displayName: "Personal" };
  marketplace.plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  const entry = {
    name: PLUGIN_NAME,
    source: { source: "local", path: `./plugins/${PLUGIN_NAME}` },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Productivity",
  };
  const index = marketplace.plugins.findIndex(({ name }) => name === PLUGIN_NAME);
  if (index >= 0) marketplace.plugins[index] = entry;
  else marketplace.plugins.push(entry);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(marketplace, null, 2)}\n`, "utf8");
}

function run(command, args, cwd, required = true) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", windowsHide: true });
  if (result.status === 0) return true;
  if (required) throw result.error ?? new Error(`${command} failed with exit code ${result.status}`);
  return false;
}

copyCleanPlugin(sourceRoot, pluginHome);
updatePersonalMarketplace(marketplaceFile);

if (!flags.has("--skip-dependencies")) {
  if (process.platform === "win32") {
    run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm.cmd", "ci"], pluginHome);
  } else {
    run("npm", ["ci"], pluginHome);
  }
}
if (!flags.has("--skip-runtime")) {
  run(process.execPath, [join(pluginHome, "scripts", "install-runtime.mjs")], pluginHome);
}

let codexInstalled = false;
if (!flags.has("--skip-codex")) {
  codexInstalled = run("codex", ["plugin", "add", `${PLUGIN_NAME}@personal`], pluginHome, false);
}

process.stdout.write([
  `Plugin source ready: ${pluginHome}`,
  `Personal marketplace ready: ${marketplaceFile}`,
  codexInstalled
    ? "Codex plugin installation completed. Restart Codex and open a new task."
    : "If Codex CLI is unavailable, restart Codex, open Plugins, and install 中英双语增强器 from Personal.",
  "",
].join("\n"));

export { copyCleanPlugin, updatePersonalMarketplace };
