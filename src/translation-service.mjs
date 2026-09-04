import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { maskProtectedText, restoreProtectedText } from "./text-rules.mjs";

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = resolve(SOURCE_DIR, "..");

function startDefaultWorker() {
  const publicRoot = process.env.BILINGUAL_RUNTIME_DIR
    ?? (process.platform === "win32"
      ? resolve(process.env.PUBLIC ?? "C:\\Users\\Public", "CodexBilingualOverlay")
      : resolve(PLUGIN_DIR, "runtime"));
  const python = resolve(publicRoot, "python", "Scripts", "python.exe");
  const script = resolve(PLUGIN_DIR, "scripts", "translate_worker.py");
  const model = resolve(publicRoot, "model", "translate-en_zh-1_9");
  return spawn(python, ["-u", script, "--model", model], {
    cwd: PLUGIN_DIR,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
    },
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

export class TranslationService {
  constructor(options = {}) {
    this.spawnWorker = options.spawnWorker ?? startDefaultWorker;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 20_000;
    this.maxCacheEntries = options.maxCacheEntries ?? 2_000;
    this.worker = null;
    this.nextId = 1;
    this.pending = new Map();
    this.cache = new Map();
    this.readyWaiters = [];
    this.workerStartupError = null;
    this.modelState = "installed";
    this.lastError = null;
  }

  getStatus() {
    return {
      modelState: this.modelState,
      cacheEntries: this.cache.size,
      lastError: this.lastError,
    };
  }

  async translate(source) {
    const text = String(source ?? "").trim();
    if (!text) return "";
    if (this.cache.has(text)) return this.cache.get(text);

    const worker = this.#ensureWorker();
    const { masked, tokens } = maskProtectedText(text);
    const id = this.nextId++;

    const result = await new Promise((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const error = new Error(`Offline translation timed out after ${this.requestTimeoutMs} ms`);
        this.lastError = error.message;
        rejectPromise(error);
      }, this.requestTimeoutMs);
      timer.unref?.();
      this.pending.set(id, {
        resolve: resolvePromise,
        reject: rejectPromise,
        timer,
        tokens,
      });
      worker.stdin.write(`${JSON.stringify({ id, text: masked })}\n`, (error) => {
        if (error) this.#rejectOne(id, error);
      });
    });

    this.#cache(text, result);
    return result;
  }

  async warmUp() {
    if (this.modelState === "ready" && this.worker) return;
    this.#ensureWorker();
    if (this.modelState === "ready") return;
    await new Promise((resolvePromise, rejectPromise) => {
      this.readyWaiters.push({ resolve: resolvePromise, reject: rejectPromise });
    });
  }

  close() {
    const worker = this.worker;
    this.worker = null;
    if (worker) worker.kill();
    const error = new Error("Offline translation worker closed");
    this.#rejectAll(error);
    this.#rejectReady(error);
    this.modelState = "stopped";
  }

  #ensureWorker() {
    if (this.worker) return this.worker;
    const worker = this.spawnWorker();
    this.worker = worker;
    this.modelState = "loading";
    this.lastError = null;
    this.workerStartupError = null;

    if (worker.stdout) {
      createInterface({ input: worker.stdout }).on("line", (line) => this.#handleLine(line));
    }
    worker.stderr?.setEncoding?.("utf8");
    worker.stderr?.on?.("data", (chunk) => {
      const message = String(chunk).trim();
      if (message) {
        this.workerStartupError = message;
        this.lastError = message;
      }
    });
    worker.on?.("error", (error) => this.#failWorker(error));
    worker.on?.("exit", (code) => {
      if (this.worker !== worker) return;
      const detail = this.workerStartupError;
      const message = detail
        ? `${detail} (offline translation worker exited with code ${code})`
        : `Offline translation worker exited with code ${code}`;
      this.#failWorker(new Error(message));
    });
    return worker;
  }

  #handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.type === "ready") {
      this.modelState = "ready";
      this.lastError = null;
      this.workerStartupError = null;
      this.#resolveReady();
      return;
    }
    if (!Number.isInteger(message.id)) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.error) {
      const error = new Error(String(message.error));
      this.lastError = error.message;
      pending.reject(error);
      return;
    }
    const translated = restoreProtectedText(String(message.translated ?? ""), pending.tokens);
    this.modelState = "ready";
    this.lastError = null;
    pending.resolve(translated);
  }

  #rejectOne(id, error) {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    this.lastError = error.message;
    pending.reject(error);
  }

  #rejectAll(error) {
    for (const [id] of this.pending) this.#rejectOne(id, error);
  }

  #failWorker(error) {
    this.worker = null;
    this.modelState = "failed";
    this.lastError = error.message;
    this.#rejectAll(error);
    this.#rejectReady(error);
  }

  #resolveReady() {
    const waiters = this.readyWaiters.splice(0);
    for (const waiter of waiters) waiter.resolve();
  }

  #rejectReady(error) {
    const waiters = this.readyWaiters.splice(0);
    for (const waiter of waiters) waiter.reject(error);
  }

  #cache(source, translated) {
    this.cache.set(source, translated);
    if (this.cache.size <= this.maxCacheEntries) return;
    this.cache.delete(this.cache.keys().next().value);
  }
}

export { startDefaultWorker };
