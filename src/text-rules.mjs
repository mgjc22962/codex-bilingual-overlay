const GLOSSARY = new Map([
  ["Featured", "精选"],
  ["Productivity", "效率工具"],
  ["Creativity", "创意"],
  ["Developer Tools", "开发者工具"],
  ["Business & Operations", "商业与运营"],
  ["Data & Analytics", "数据与分析"],
  ["Communication", "沟通"],
  ["Spreadsheets", "电子表格"],
  ["Presentations", "演示文稿"],
  ["Documents", "文档"],
  ["Control Windows apps from ChatGPT", "通过 ChatGPT 控制 Windows 应用"],
  ["Control Chrome with ChatGPT", "通过 ChatGPT 控制 Chrome"],
  ["Create and edit spreadsheet files", "创建和编辑电子表格文件"],
  ["Create and edit presentations", "创建和编辑演示文稿"],
  ["Read and manage Gmail", "读取和管理 Gmail"],
  ["Work across Drive, Docs, Sheets, and Slides", "跨 Drive、Docs、Sheets 和 Slides 工作"],
  ["Manage Google Calendar events and schedules", "管理 Google Calendar 事件和日程"],
  ["Plan and build products", "规划和构建产品"],
  ["Turn Codex into your ClickUp command center.", "将 Codex 接入你的 ClickUp 指挥中心"],
  ["Interactive", "交互"],
  ["Read", "读取"],
  ["Write", "写入"],
  ["Skill", "技能"],
  ["Initialize", "初始化"],
]);

const TITLE_GLOSSARY = new Map([
  ["Computer Use", "电脑控制"],
  ["Computer Use Skill", "电脑控制技能"],
  ["Google Calendar", "谷歌日历"],
  ["Google Drive", "谷歌云端硬盘"],
  ["Chrome", "谷歌浏览器"],
  ["GitHub", "代码托管平台"],
  ["Canva", "在线设计工具"],
  ["Notion", "笔记与协作工具"],
  ["ClickUp", "项目管理工具"],
  ["Gmail", "谷歌邮箱"],
  ["Figma", "界面设计工具"],
  ["Slack", "团队沟通工具"],
  ["Teams", "团队协作工具"],
  ["Adobe", "创意设计工具"],
  ["Data Analytics", "数据分析"],
  ["OpenAI Developers", "OpenAI 开发者工具"],
  ["Presentations", "演示文稿"],
  ["Spreadsheets", "电子表格"],
  ["Documents", "文档"],
  ["Template Creator", "模板创建工具"],
  ["Superpowers", "高级工作流工具"],
  ["HyperFrames by HeyGen", "视频动画工具"],
  ["Default templates", "默认模板"],
  ["Build Web Apps", "网站应用开发"],
  ["Product Design", "产品设计"],
  ["Linear", "产品研发管理工具"],
  ["Monday.com", "项目管理工具"],
  ["Airtable", "在线数据库"],
  ["AllTrails", "户外路线工具"],
  ["Gamma", "AI 演示文稿工具"],
  ["Outlook Calendar", "Outlook 日历"],
  ["Outlook Email", "Outlook 邮箱"],
  ["Atlassian Rovo", "企业知识助手"],
  ["SharePoint", "企业内容协作平台"],
  ["Box", "云端内容管理工具"],
  ["Zoom", "视频会议工具"],
  ["HubSpot", "客户关系管理平台"],
  ["Asana", "项目管理工具"],
  ["Vercel", "网站部署平台"],
  ["Supabase", "后端开发平台"],
  ["Granola", "会议笔记工具"],
]);

const FUNCTIONAL_TITLE_RULES = [
  [/\b(?:calendar|events?|schedules?)\b/i, "日历工具"],
  [/\b(?:projects?|tasks?|workflows?)\b/i, "项目管理工具"],
  [/\b(?:presentations?|slides?)\b/i, "演示文稿工具"],
  [/\b(?:spreadsheets?|sheets?)\b/i, "电子表格工具"],
  [/\b(?:design|creative|graphics?)\b/i, "设计工具"],
  [/\b(?:e-?mail|gmail|outlook)\b/i, "邮件工具"],
  [/\b(?:browser|web pages?)\b/i, "浏览器工具"],
  [/\b(?:data|analytics?|reports?)\b/i, "数据分析工具"],
  [/\b(?:code|developer|api)\b/i, "开发工具"],
  [/\b(?:documents?|files?|drive)\b/i, "文档与文件工具"],
  [/\b(?:communication|chat|messages?)\b/i, "沟通工具"],
];

const BRANDS = [
  "Adobe",
  "AllTrails",
  "Canva",
  "ChatGPT",
  "Chrome",
  "ClickUp",
  "Codex",
  "Computer Use",
  "Data Analytics",
  "Gamma",
  "GitHub",
  "Gmail",
  "Google Calendar",
  "Google Drive",
  "HeyGen",
  "HyperFrames",
  "Linear",
  "Notion",
  "OpenAI",
  "Outlook Email",
  "Superpowers",
  "Template Creator",
];

const escapedBrands = BRANDS
  .sort((a, b) => b.length - a.length)
  .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

const PROTECTED_PATTERN = new RegExp(
  [
    "https?:\\/\\/[^\\s)]+",
    "[A-Za-z]:\\\\[^\\r\\n]+",
    "\\b[A-Za-z_][A-Za-z0-9_]*\\([^\\r\\n)]*\\)",
    "\"[A-Za-z_][A-Za-z0-9_-]*\"\\s*:",
    "\\b[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z0-9_-]+)+\\b",
    "\\b[A-Za-z_][A-Za-z0-9_]*\\(\\)",
    "\\b(?:[a-z]+[A-Z][A-Za-z0-9]*|[A-Za-z]+_[A-Za-z0-9_]+)\\b",
    "\\bv?\\d+(?:\\.\\d+){1,}(?:[-+][A-Za-z0-9.-]+)?\\b",
    "\\b[A-Z][A-Z0-9_-]{1,}\\b",
    `\\b(?:${escapedBrands.join("|")})\\b`,
  ].join("|"),
  "g",
);

export function exactGlossaryTranslation(text) {
  return GLOSSARY.get(String(text).trim()) ?? null;
}

export function localizeTitle(title, description = "") {
  const normalizedTitle = String(title ?? "").trim();
  if (!normalizedTitle) return null;
  const exact = TITLE_GLOSSARY.get(normalizedTitle);
  if (exact) return exact;
  const context = String(description ?? "").trim();
  for (const [pattern, label] of FUNCTIONAL_TITLE_RULES) {
    if (pattern.test(context)) return label;
  }
  return null;
}

export function formatLocalizedTitle(title, description = "") {
  const localized = localizeTitle(title, description);
  if (!localized) return null;
  return { text: `（${localized}）`, layout: "inline" };
}

export function maskProtectedText(text) {
  const tokens = [];
  const masked = String(text).replace(PROTECTED_PATTERN, (value) => {
    const index = tokens.push(value) - 1;
    return `__BILINGUAL_TOKEN_${index}__`;
  });
  return { masked, tokens };
}

export function restoreProtectedText(text, tokens) {
  return tokens.reduce(
    (value, token, index) => value.replaceAll(`__BILINGUAL_TOKEN_${index}__`, token),
    String(text),
  );
}

export function extractEnglishSegments(text) {
  const value = String(text ?? "").trim();
  if (!value) return [];
  if (!/\p{Script=Han}/u.test(value)) return [value];
  const seen = new Set();
  return value
    .split(/[\p{Script=Han}\u3000-\u303f\uff00-\uffef]+/u)
    .map((segment) => segment.trim())
    .filter((segment) => /[A-Za-z]{2}/u.test(segment))
    .filter((segment) => {
      if (seen.has(segment)) return false;
      seen.add(segment);
      return true;
    });
}

export function shouldTranslate(text) {
  const value = String(text ?? "").trim();
  if (!value) return false;
  const hanCount = (value.match(/\p{Script=Han}/gu) ?? []).length;
  if (hanCount > 0) {
    const rawEnglishWords = value.match(/[A-Za-z]{2,}/g) ?? [];
    const latinLetterCount = (value.match(/[A-Za-z]/g) ?? []).length;
    if (rawEnglishWords.length < 4 || latinLetterCount < hanCount * 1.5) return false;
  }
  if (exactGlossaryTranslation(value)) return true;
  if (/^`{1,3}[\s\S]*`{1,3}$/.test(value)) return false;
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*\([\s\S]*\)$/.test(value)) return false;
  if (/^[{[]/.test(value)) {
    try {
      JSON.parse(value);
      return false;
    } catch {
      // Continue for normal prose that happens to begin with punctuation.
    }
  }

  const { masked } = maskProtectedText(value);
  const withoutTokens = masked.replace(/__BILINGUAL_TOKEN_\d+__/g, " ");
  const englishWords = withoutTokens.match(/[A-Za-z]{2,}/g) ?? [];
  return englishWords.length > 0;
}

export function formatChineseTranslation(chinese) {
  const value = String(chinese).trim().replace(/^（|）$/g, "");
  return {
    text: `（${value}）`,
    layout: value.length > 70 ? "below" : "inline",
  };
}
