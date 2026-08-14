import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";

import { startOverlayProcess } from "./overlay-process.mjs";
import {
  exactGlossaryTranslation,
  extractEnglishSegments,
  formatChineseTranslation,
  formatLocalizedTitle,
  shouldTranslate,
} from "./text-rules.mjs";
import { translateStructuredText } from "./full-text.mjs";

const PRELOAD_KINDS = new Set(["normal", "title", "full"]);
const STALE_TRANSLATION = Symbol("stale-translation");

export class OverlayController extends EventEmitter {
  constructor(options = {}) {
    super();
    this.spawnOverlay = options.spawnOverlay ?? startOverlayProcess;
    this.translate = options.translate ?? (async (text) => exactGlossaryTranslation(text));
    this.child = null;
    this.lines = null;
    this.mode = "off";
    this.overlayState = "stopped";
    this.modelState = "not-installed";
    this.translatedBlocks = 0;
    this.totalBlocks = 0;
    this.lastError = null;
    this.requestVersion = 0;
    this.preloadRevision = null;
  }

  getStatus() {
    return {
      mode: this.mode,
      overlayState: this.overlayState,
      modelState: this.modelState,
      translatedBlocks: this.translatedBlocks,
      totalBlocks: this.totalBlocks,
      lastError: this.lastError,
    };
  }

  async setMode(mode) {
    if (!new Set(["off", "hover", "preload"]).has(mode)) {
      throw new Error(`Unsupported bilingual mode: ${String(mode)}`);
    }
    this.requestVersion += 1;
    if (mode === "off") {
      this.mode = "off";
      if (this.child) {
        this.#write("MODE|off\nEXIT\n");
        this.#closeLines();
        this.child.kill();
        this.child = null;
      }
      this.overlayState = "stopped";
      this.lastError = null;
      return this.getStatus();
    }

    if (!this.child) this.#startOverlay();
    this.mode = mode;
    this.#write(`MODE|${mode}\n`);
    this.lastError = null;
    return this.getStatus();
  }

  #startOverlay() {
    const child = this.spawnOverlay();
    this.child = child;
    this.overlayState = "running";
    child.stderr?.setEncoding?.("utf8");
    child.stderr?.on?.("data", (chunk) => {
      const message = String(chunk).trim();
      if (message) this.lastError = message;
    });
    child.on?.("error", (error) => {
      this.#closeLines();
      this.lastError = error.message;
      this.overlayState = "failed";
      this.child = null;
    });
    child.on?.("exit", (code) => {
      this.#closeLines();
      if (this.child === child) this.child = null;
      if (this.mode !== "off" && code !== 0) {
        this.overlayState = "failed";
        this.lastError = `Overlay exited with code ${code}`;
      } else {
        this.overlayState = "stopped";
      }
    });
    if (child.stdout) {
      this.lines = createInterface({ input: child.stdout });
      this.lines.on("line", (line) => { void this.#handleLine(line); });
    }
  }

  async #handleLine(line) {
    if (line === "CLEAR") {
      this.requestVersion += 1;
      this.#write("HIDE|hover\nHIDE|hover-card-title\nHIDE|hover-card-description\n");
      return;
    }
    const parts = line.split("|");
    if (parts[0] === "PRELOAD_RESET" && parts.length >= 2) {
      this.preloadRevision = parts[1];
      this.#write("RESET\n");
      return;
    }
    if (parts[0] === "PRELOAD" && parts.length >= 8) {
      const typed = parts.length >= 10 && PRELOAD_KINDS.has(parts[3]);
      const revision = parts[1];
      const kind = typed ? parts[3] : "normal";
      const sourceIndex = typed ? 4 : 3;
      const contextIndex = typed ? 5 : null;
      const coordinatesIndex = typed ? 6 : 4;
      const key = `preload-${revision}-${parts[2]}`;
      const source = Buffer.from(parts[sourceIndex], "base64").toString("utf8").trim();
      const context = contextIndex == null
        ? ""
        : Buffer.from(parts[contextIndex], "base64").toString("utf8").trim();
      const candidate = {
        source,
        context,
        key,
        coordinates: parts.slice(coordinatesIndex, coordinatesIndex + 4),
        isCurrent: () => this.mode === "preload" && this.preloadRevision === revision,
      };
      if (kind === "title") await this.#localizeTitleAndShow(candidate);
      else if (kind === "full") await this.#translateFullTextAndShow(candidate);
      else await this.#translateAndShow(candidate);
      return;
    }
    if (parts[0] === "HOVER_FULL" && parts.length >= 6) {
      this.#write("HIDE|hover-card-title\nHIDE|hover-card-description\n");
      const source = Buffer.from(parts[1], "base64").toString("utf8").trim();
      const version = ++this.requestVersion;
      await this.#translateFullTextAndShow({
        source,
        key: "hover",
        coordinates: parts.slice(2, 6),
        isCurrent: () => version === this.requestVersion && this.mode === "hover",
      });
      return;
    }
    if (parts[0] === "HOVER_CARD" && parts.length >= 11) {
      const version = ++this.requestVersion;
      const title = Buffer.from(parts[1], "base64").toString("utf8").trim();
      const description = Buffer.from(parts[2], "base64").toString("utf8").trim();
      const isCurrent = () => version === this.requestVersion && this.mode === "hover";
      this.#write("HIDE|hover\n");
      await this.#localizeTitleAndShow({
        source: title,
        context: description,
        key: "hover-card-title",
        coordinates: parts.slice(3, 7),
        isCurrent,
      });
      await this.#translateAndShow({
        source: description,
        key: "hover-card-description",
        coordinates: parts.slice(7, 11),
        isCurrent,
      });
      return;
    }
    if (parts[0] !== "HOVER" || parts.length < 6) return;

    this.#write("HIDE|hover-card-title\nHIDE|hover-card-description\n");
    const source = Buffer.from(parts[1], "base64").toString("utf8").trim();
    const version = ++this.requestVersion;
    const candidate = {
      source,
      key: "hover",
      coordinates: parts.slice(2, 6),
      isCurrent: () => version === this.requestVersion && this.mode === "hover",
    };
    if (formatLocalizedTitle(source)) await this.#localizeTitleAndShow({ ...candidate, context: "" });
    else await this.#translateAndShow(candidate);
  }

  async #translateAndShow({ source, key, coordinates, isCurrent }) {
    const containsChinese = /\p{Script=Han}/u.test(source);
    const translationSource = containsChinese
      ? extractEnglishSegments(source).join("\n\n")
      : source;
    if (!translationSource || (!containsChinese && !shouldTranslate(translationSource))) {
      if (key === "hover") this.#write("HIDE|hover\n");
      return;
    }
    this.totalBlocks += 1;
    try {
      const translated = exactGlossaryTranslation(translationSource) ?? await this.translate(translationSource);
      if (!translated || !isCurrent()) return;
      const formatted = formatChineseTranslation(translated);
      const layout = translationSource.length > 24 ? "below" : formatted.layout;
      this.#showTranslation({ source, key, coordinates, text: formatted.text, layout });
    } catch (error) {
      this.lastError = error?.message || String(error);
      if (key === "hover") this.#write("HIDE|hover\n");
    }
  }

  async #localizeTitleAndShow({ source, context, key, coordinates, isCurrent }) {
    const formatted = formatLocalizedTitle(source, context);
    if (!formatted || !isCurrent()) return;
    this.totalBlocks += 1;
    this.#showTranslation({
      source,
      key,
      coordinates,
      text: formatted.text,
      layout: formatted.layout,
    });
  }

  async #translateFullTextAndShow({ source, key, coordinates, isCurrent }) {
    if (/\p{Script=Han}/u.test(source) || !shouldTranslate(source)) {
      this.#write(`HIDE|${key}\n`);
      return;
    }
    this.totalBlocks += 1;
    try {
      const translated = await translateStructuredText(source, async (chunk) => {
        if (!isCurrent()) throw STALE_TRANSLATION;
        const result = exactGlossaryTranslation(chunk) ?? await this.translate(chunk);
        if (!isCurrent()) throw STALE_TRANSLATION;
        return result;
      });
      if (!translated || !isCurrent()) return;
      this.#showTranslation({
        source,
        key,
        coordinates,
        text: `完整中文翻译\n\n${translated}`,
        layout: "panel",
      });
    } catch (error) {
      if (error === STALE_TRANSLATION) return;
      this.lastError = error?.message || String(error);
      this.#write(`HIDE|${key}\n`);
    }
  }

  #showTranslation({ source, key, coordinates, text, layout }) {
    const encoded = Buffer.from(text, "utf8").toString("base64");
    this.#write(`SHOW|${key}|${encoded}|${coordinates.join("|")}|${layout}\n`);
    this.translatedBlocks += 1;
    this.lastError = null;
    this.emit("translation", { source, translated: text, key, layout });
  }

  #write(command) {
    if (this.child?.stdin?.writable) this.child.stdin.write(command);
  }

  #closeLines() {
    if (!this.lines) return;
    this.lines.close();
    this.lines = null;
  }
}
