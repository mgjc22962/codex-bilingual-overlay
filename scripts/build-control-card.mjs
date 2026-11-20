import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const template = await readFile(new URL("../src/control-card.html", import.meta.url), "utf8");
const { outputFiles: [script] } = await build({
  entryPoints: [fileURLToPath(new URL("../src/control-card.mjs", import.meta.url))],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  minify: true,
  legalComments: "eof",
  write: false,
});

const scriptText = script.text.replace(/<\/script/gi, "<\\/script");
const html = template.replace("<!-- CONTROL_CARD_SCRIPT -->", () => `<script>${scriptText}</script>`);
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
await writeFile(new URL("../dist/control-card.html", import.meta.url), html, "utf8");
