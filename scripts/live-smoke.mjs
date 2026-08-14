import { createBilingualRuntime } from "../src/runtime.mjs";

const mode = process.argv[2] ?? "preload";
const durationMs = Number(process.argv[3] ?? 8_000);
const runtime = createBilingualRuntime();
let events = 0;
runtime.controller.on("translation", () => { events += 1; });

try {
  await runtime.controller.setMode(mode);
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  const status = {
    ...runtime.controller.getStatus(),
    ...runtime.translation.getStatus(),
    translationEvents: events,
  };
  process.stdout.write(`${JSON.stringify(status)}\n`);
} finally {
  await runtime.close();
}
