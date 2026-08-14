import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MODES = new Set(["off", "hover", "preload"]);

function defaultStateFile() {
  return process.env.CODEX_BILINGUAL_STATE_FILE
    ?? join(process.env.PUBLIC ?? "C:\\Users\\Public", "CodexBilingualOverlay", "state.json");
}

export function createFileModeStore(stateFile = defaultStateFile()) {
  let fallback = "hover";
  return {
    read() {
      try {
        const parsed = JSON.parse(readFileSync(stateFile, "utf8"));
        if (MODES.has(parsed?.mode)) fallback = parsed.mode;
      } catch {}
      return fallback;
    },
    write(mode) {
      if (!MODES.has(mode)) return;
      fallback = mode;
      try {
        mkdirSync(dirname(stateFile), { recursive: true });
        writeFileSync(stateFile, `${JSON.stringify({ mode })}\n`, "utf8");
      } catch {}
    },
  };
}
