import { createBilingualRuntime } from "../src/runtime.mjs";

const durationMs = Number(process.argv[2] ?? 7_200_000);
const intervalMs = Number(process.argv[3] ?? 10_000);
if (!Number.isFinite(durationMs) || durationMs < 1_000) throw new Error("durationMs must be at least 1000");
if (!Number.isFinite(intervalMs) || intervalMs < 250) throw new Error("intervalMs must be at least 250");

const runtime = createBilingualRuntime();
const startedAt = Date.now();
const modes = ["preload", "hover", "off"];
let modeChanges = 0;
let translationEvents = 0;
let maxRss = 0;
let failure = null;
runtime.controller.on("translation", () => { translationEvents += 1; });

try {
  while (Date.now() - startedAt < durationMs) {
    const mode = modes[modeChanges % modes.length];
    await runtime.controller.setMode(mode);
    modeChanges += 1;
    const status = runtime.controller.getStatus();
    if (status.overlayState === "failed") throw new Error(status.lastError || "overlay failed");
    maxRss = Math.max(maxRss, process.memoryUsage().rss);
    const remaining = durationMs - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }
} catch (error) {
  failure = error?.message || String(error);
  throw error;
} finally {
  await runtime.close();
  const status = {
    elapsedMs: Date.now() - startedAt,
    modeChanges,
    translationEvents,
    maxNodeRssMB: Math.round(maxRss / 1024 / 1024 * 10) / 10,
    failure,
    finalOverlayState: runtime.controller.getStatus().overlayState,
    finalModelState: runtime.translation.getStatus().modelState,
  };
  process.stdout.write(`${JSON.stringify(status)}\n`);
}
