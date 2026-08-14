export const CONTROL_CARD_HTML = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>中英双语增强器</title>
  <style>
    :root { color-scheme: light dark; font-family: "Segoe UI", "Microsoft YaHei UI", sans-serif; }
    body { margin: 0; padding: 16px; background: transparent; color: CanvasText; }
    .card { border: 1px solid color-mix(in srgb, CanvasText 16%, transparent); border-radius: 14px; padding: 16px; background: color-mix(in srgb, Canvas 94%, transparent); }
    h1 { font-size: 17px; margin: 0 0 6px; }
    p { font-size: 13px; opacity: .74; margin: 0 0 14px; }
    .modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    button { min-height: 38px; border-radius: 9px; border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); background: Canvas; color: CanvasText; cursor: pointer; }
    button[aria-pressed="true"] { background: #2563eb; color: white; border-color: #2563eb; }
    button:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; }
    #status { margin-top: 12px; font-size: 12px; opacity: .78; }
  </style>
</head>
<body>
  <main class="card" aria-label="中英双语增强器控制">
    <h1>中英双语增强器</h1>
    <p>保留英文原文，在旁边或下方显示简体中文翻译。</p>
    <div class="modes" role="group" aria-label="翻译模式">
      <button data-mode="off" aria-pressed="false">关闭</button>
      <button data-mode="hover" aria-pressed="true">悬停翻译</button>
      <button data-mode="preload" aria-pressed="false">页面预翻译</button>
    </div>
    <div id="status" role="status">当前：悬停翻译</div>
  </main>
  <script>
    const labels = { off: "关闭", hover: "悬停翻译", preload: "页面预翻译" };
    const statusNode = document.getElementById("status");

    function renderStatus(value) {
      const mode = value?.mode || "hover";
      document.querySelectorAll("[data-mode]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
      });
      statusNode.textContent = "当前：" + (labels[mode] || mode);
    }

    async function setMode(mode) {
      const bridge = window.openai;
      if (!bridge?.callTool) {
        statusNode.textContent = "当前宿主未提供插件 UI 调用桥。";
        return;
      }
      statusNode.textContent = "正在切换…";
      try {
        const result = await bridge.callTool("set_bilingual_mode", { mode });
        renderStatus(result?.structuredContent || result);
      } catch (error) {
        statusNode.textContent = "切换失败：" + (error?.message || String(error));
      }
    }

    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => setMode(button.dataset.mode));
    });
    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      if (event.data?.method === "ui/notifications/tool-result") {
        renderStatus(event.data.params?.structuredContent);
      }
    }, { passive: true });
    renderStatus(window.openai?.toolOutput?.structuredContent || window.openai?.toolOutput);
  </script>
</body>
</html>`;
