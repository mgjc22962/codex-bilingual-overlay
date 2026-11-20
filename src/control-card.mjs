import { App } from "@modelcontextprotocol/ext-apps";
import { MODE_LABELS } from "./protocol.mjs";

const app = new App({ name: "codex-bilingual-overlay", version: "0.1.2" });
const status = document.getElementById("status");
const buttons = [...document.querySelectorAll("[data-mode]")];
let currentMode;
let clicked = false;

function setDisabled(disabled) {
  for (const button of buttons) button.disabled = disabled;
}

function render(mode) {
  currentMode = mode;
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  }
  status.textContent = `当前：${MODE_LABELS[mode]}`;
}

async function callModeTool(name, args) {
  const result = await app.callServerTool({ name, arguments: args });
  if (result.isError) {
    const error = result.content.find((item) => item.type === "text");
    throw new Error(error?.text ?? "翻译工具调用失败");
  }
  const mode = result.structuredContent?.mode;
  if (!Object.hasOwn(MODE_LABELS, mode)) throw new Error("没有收到有效的翻译模式");
  return mode;
}

app.ontoolresult = (result) => {
  const mode = result.structuredContent?.mode;
  if (!clicked && !result.isError && Object.hasOwn(MODE_LABELS, mode)) render(mode);
};

for (const button of buttons) {
  button.addEventListener("click", async () => {
    clicked = true;
    setDisabled(true);
    status.textContent = "正在切换…";
    try {
      render(await callModeTool("set_bilingual_mode", { mode: button.dataset.mode }));
    } catch (error) {
      status.textContent = `切换失败：${error.message}`;
    } finally {
      setDisabled(false);
    }
  });
}

async function connect() {
  try {
    await app.connect();
  } catch {
    status.textContent = "连接 Codex 失败，请重新打开控制卡。";
    return;
  }
  try {
    render(await callModeTool("get_bilingual_status", {}));
  } catch {
    if (!currentMode) status.textContent = "暂时无法读取当前模式。";
  }
  setDisabled(false);
}

void connect();
