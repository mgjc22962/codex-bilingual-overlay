import { createInterface } from "node:readline";

import { startControlWindowProcess } from "./overlay-process.mjs";

export function createControlWindow(setMode) {
  let active;

  function send(session, line) {
    const input = session.child.stdin;
    if (input.writable) input.write(`${line}\n`);
  }

  async function handleMode(session, mode) {
    try {
      const currentMode = await setMode(mode);
      update(currentMode);
    } catch (error) {
      const text = Buffer.from(error.message, "utf8").toString("base64");
      send(session, `ERROR|${text}`);
    }
  }

  function start() {
    const child = startControlWindowProcess();
    const lines = createInterface({ input: child.stdout });
    const session = { child };
    active = session;
    session.ready = new Promise((resolve, reject) => {
      let stderr = "";
      const timer = setTimeout(() => {
        reject(new Error("Windows control window did not become visible"));
        child.kill();
      }, 10_000);
      function closed(error) {
        clearTimeout(timer);
        lines.close();
        if (active === session) active = undefined;
        reject(error);
      }

      child.stdin.on("error", () => {});
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-2000); });
      child.once("error", closed);
      child.once("close", (code) => {
        closed(new Error(stderr.trim() || `Windows control window exited (${code ?? "signal"})`));
      });
      lines.on("line", (line) => {
        if (line === "READY") {
          clearTimeout(timer);
          resolve();
        } else if (active === session && line.startsWith("MODE|")) {
          void handleMode(session, line.slice(5));
        }
      });
    });
    return session;
  }

  async function show(mode) {
    const session = active ?? start();
    session.mode = mode;
    await session.ready;
    if (active !== session || !session.child.stdin.writable) {
      throw new Error("Windows control window closed before it could open");
    }
    send(session, `SHOW|${session.mode}`);
  }

  function update(mode) {
    if (!active) return;
    active.mode = mode;
    send(active, `MODE|${mode}`);
  }

  function close() {
    const session = active;
    active = undefined;
    session?.child.stdin.end();
  }

  return { show, update, close };
}
