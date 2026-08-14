import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const sourcePath = fileURLToPath(new URL("../scripts/overlay-host.cs", import.meta.url));
const compileCommand = [
  "$ErrorActionPreference='Stop'",
  "Add-Type -Path $env:CODEX_BILINGUAL_OVERLAY_SOURCE -ReferencedAssemblies @('System.Windows.Forms','System.Drawing','WindowsBase','UIAutomationClient','UIAutomationTypes')",
].join("; ");

function spawnHost(entryPoint) {
  return spawn(
    "powershell.exe",
    ["-NoProfile", "-STA", "-Command", `${compileCommand}; [CodexBilingualOverlay.OverlayProgram]::${entryPoint}()`],
    {
      env: { ...process.env, CODEX_BILINGUAL_OVERLAY_SOURCE: sourcePath },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  );
}

async function runProbe(entryPoint) {
  const child = spawnHost(entryPoint);
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (exitCode !== 0) throw new Error(`${entryPoint} failed (${exitCode}): ${stderr.trim()}`);
  return JSON.parse(stdout.trim());
}

export function runOverlayProbe() {
  return runProbe("Probe");
}

export function runPanelProbe() {
  return runProbe("PanelProbe");
}

export function runSkillAggregationProbe() {
  return runProbe("SkillAggregationProbe");
}

export function runGenericSkillAggregationProbe() {
  return runProbe("GenericSkillAggregationProbe");
}

export function runCardHoverProbe() {
  return runProbe("CardHoverProbe");
}

export function startOverlayProcess() {
  return spawnHost("Run");
}
