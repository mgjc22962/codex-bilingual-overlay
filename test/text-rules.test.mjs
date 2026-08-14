import test from "node:test";
import assert from "node:assert/strict";

import {
  exactGlossaryTranslation,
  formatChineseTranslation,
  formatLocalizedTitle,
  localizeTitle,
  maskProtectedText,
  restoreProtectedText,
  shouldTranslate,
} from "../src/text-rules.mjs";

test("extracts only English words and sentences from a Chinese conversation block", async () => {
  const { extractEnglishSegments } = await import("../src/text-rules.mjs");
  assert.deepEqual(
    extractEnglishSegments("这是中文对话，里面有 Computer Use，也有 This is a complete English sentence. 其余仍是中文。"),
    ["Computer Use", "This is a complete English sentence."],
  );
});

test("localizes marketplace titles with common Simplified Chinese wording", () => {
  const expected = {
    "Computer Use": "电脑控制",
    "Google Calendar": "谷歌日历",
    "Google Drive": "谷歌云端硬盘",
    Chrome: "谷歌浏览器",
    GitHub: "代码托管平台",
    Canva: "在线设计工具",
    Notion: "笔记与协作工具",
    ClickUp: "项目管理工具",
  };

  for (const [english, chinese] of Object.entries(expected)) {
    assert.equal(localizeTitle(english), chinese);
  }
});

test("uses a conservative functional label for unknown titles", () => {
  assert.equal(localizeTitle("Acme", "Manage team projects and tasks"), "项目管理工具");
  assert.equal(localizeTitle("Acme", "A new connected service"), null);
  assert.deepEqual(formatLocalizedTitle("Computer Use"), {
    text: "（电脑控制）",
    layout: "inline",
  });
});

test("translates the complete category menu with fixed terminology", () => {
  const expected = {
    Featured: "精选",
    Productivity: "效率工具",
    Creativity: "创意",
    "Developer Tools": "开发者工具",
    "Business & Operations": "商业与运营",
    "Data & Analytics": "数据与分析",
    Communication: "沟通",
  };

  for (const [english, chinese] of Object.entries(expected)) {
    assert.equal(exactGlossaryTranslation(english), chinese);
  }
});

test("uses stable marketplace wording for titles and common descriptions", () => {
  const expected = {
    Spreadsheets: "电子表格",
    Presentations: "演示文稿",
    Documents: "文档",
    "Control Windows apps from ChatGPT": "通过 ChatGPT 控制 Windows 应用",
    "Control Chrome with ChatGPT": "通过 ChatGPT 控制 Chrome",
    "Create and edit spreadsheet files": "创建和编辑电子表格文件",
    "Create and edit presentations": "创建和编辑演示文稿",
    "Read and manage Gmail": "读取和管理 Gmail",
    "Work across Drive, Docs, Sheets, and Slides": "跨 Drive、Docs、Sheets 和 Slides 工作",
    "Manage Google Calendar events and schedules": "管理 Google Calendar 事件和日程",
    "Plan and build products": "规划和构建产品",
    "Turn Codex into your ClickUp command center.": "将 Codex 接入你的 ClickUp 指挥中心",
  };
  for (const [english, chinese] of Object.entries(expected)) {
    assert.equal(exactGlossaryTranslation(english), chinese);
  }
});

test("skips pure brands, paths, URLs and code identifiers", () => {
  for (const text of [
    "GitHub",
    "Canva",
    "Google Calendar",
    "Computer Use",
    "SKILL.md",
    "https://example.com/docs",
    "C:\\Users\\demo\\plugin.json",
    "show_bilingual_controls()",
    "set_bilingual_mode({ mode: \"hover\" })",
    "{\"mode\":\"preload\",\"requestTimeoutMs\":20000}",
    "requestTimeoutMs",
    "model_state",
    "26.805.11740",
  ]) {
    assert.equal(shouldTranslate(text), false, text);
  }
});

test("accepts English descriptions even when they contain protected terms", () => {
  assert.equal(shouldTranslate("Create presentations with GitHub and the OpenAI API"), true);
  assert.equal(shouldTranslate("Control Windows apps from ChatGPT"), true);
});

test("rejects predominantly Chinese text but keeps a real embedded English sentence", () => {
  assert.equal(shouldTranslate("这是一段中文对话"), false);
  assert.equal(shouldTranslate("这是很长的一段中文说明，修复后 Codex 和 Computer Use 都能正常运行，但整段内容仍然主要是中文。"), false);
  assert.equal(shouldTranslate("说明：This complete English sentence should still be translated when hovered."), true);
});

test("masks and restores brands and technical tokens without changing them", () => {
  const source = "Use GitHub API from SKILL.md at C:\\tools\\plugin.json";
  const { masked, tokens } = maskProtectedText(source);

  assert.doesNotMatch(masked, /GitHub|API|SKILL\.md|C:\\tools/);
  assert.equal(
    restoreProtectedText(`使用 ${masked}`, tokens),
    `使用 ${source}`,
  );
});

test("formats Chinese with full-width parentheses and chooses a long-block layout", () => {
  assert.deepEqual(formatChineseTranslation("简短翻译"), {
    text: "（简短翻译）",
    layout: "inline",
  });
  assert.deepEqual(formatChineseTranslation("这是一个用于验证长段落显示行为的中文翻译。".repeat(5)), {
    text: `（${"这是一个用于验证长段落显示行为的中文翻译。".repeat(5)}）`,
    layout: "below",
  });
});
