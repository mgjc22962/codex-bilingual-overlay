import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { isRunnablePython } from "../src/runtime-health.mjs";

const publicDirectory = process.env.PUBLIC ?? "C:\\Users\\Public";
const runtimeRoot = process.env.BILINGUAL_RUNTIME_DIR
  ?? resolve(publicDirectory, "CodexBilingualOverlay");
const runtimePython = resolve(runtimeRoot, "python", "Scripts", "python.exe");
const bundledPython = resolve(
  process.env.USERPROFILE,
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "python",
  "python.exe",
);
const modelRoot = resolve(runtimeRoot, "model");
const modelFolder = resolve(modelRoot, "translate-en_zh-1_9");
const modelBinary = resolve(modelFolder, "model", "model.bin");
const tokenizer = resolve(modelFolder, "sentencepiece.model");
const downloads = resolve(runtimeRoot, "downloads");
const archive = resolve(downloads, "translate-en_zh-1_9.argosmodel");
const modelUrl = "https://argos-net.com/v1/translate-en_zh-1_9.argosmodel";
const runtimeEnvironment = resolve(runtimeRoot, "python");
const brokenEnvironment = `${runtimeEnvironment}.broken-${process.pid}-${Date.now()}`;
let rotatedBrokenEnvironment = false;

mkdirSync(runtimeRoot, { recursive: true });
if (existsSync(runtimePython) && !isRunnablePython(runtimePython)) {
  renameSync(runtimeEnvironment, brokenEnvironment);
  rotatedBrokenEnvironment = true;
}

try {
  if (!existsSync(runtimePython)) {
    execFileSync(existsSync(bundledPython) ? bundledPython : "python", [
      "-m", "venv", runtimeEnvironment,
    ], { stdio: "inherit", windowsHide: true });
  }

  execFileSync(runtimePython, [
    "-m", "pip", "install", "--disable-pip-version-check", "--no-input",
    "--only-binary=:all:", "ctranslate2==4.8.1", "sentencepiece==0.2.2",
  ], { stdio: "inherit", windowsHide: true });

  if (!existsSync(modelBinary) || !existsSync(tokenizer)) {
    mkdirSync(downloads, { recursive: true });
    mkdirSync(modelRoot, { recursive: true });
    if (!existsSync(archive)) {
      execFileSync("curl.exe", [
        "-L", "--fail", "--silent", "--show-error", "--output", archive, modelUrl,
      ], { stdio: "inherit", windowsHide: true });
    }
    execFileSync("tar.exe", ["-xf", archive, "-C", modelRoot], {
      stdio: "inherit",
      windowsHide: true,
    });
  }

  execFileSync(runtimePython, [
    "-c",
    "import ctranslate2, sentencepiece; print('RUNTIME_OK', ctranslate2.__version__)",
  ], { stdio: "inherit", windowsHide: true });

  if (!existsSync(modelBinary) || !existsSync(tokenizer)) {
    throw new Error(`Offline model installation is incomplete: ${modelFolder}`);
  }
  if (rotatedBrokenEnvironment) rmSync(brokenEnvironment, { recursive: true, force: true });
} catch (error) {
  if (rotatedBrokenEnvironment) {
    if (existsSync(runtimeEnvironment)) rmSync(runtimeEnvironment, { recursive: true, force: true });
    renameSync(brokenEnvironment, runtimeEnvironment);
  }
  throw error;
}
process.stdout.write(`Bilingual runtime ready: ${runtimeRoot}\n`);
