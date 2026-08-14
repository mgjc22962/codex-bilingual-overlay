const MODES = new Set(["off", "hover", "preload"]);
const MODE_LABELS = { off: "关闭", hover: "悬停翻译", preload: "页面预翻译" };
const CONTROL_RESOURCE_URI = "ui://codex-bilingual-overlay/controls-v1.html";

function toolResult(status, message) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { ...status },
  };
}

export function createProtocol(options = {}) {
  const onModeChange = options.onModeChange ?? (async () => {});
  const getRuntimeStatus = options.getRuntimeStatus ?? (() => ({}));
  const modeStore = options.modeStore ?? { read: () => "hover", write: () => {} };
  const savedMode = modeStore.read();
  const initialMode = MODES.has(savedMode) ? savedMode : "hover";
  const status = {
    mode: initialMode,
    overlayState: "stopped",
    modelState: "not-installed",
    translatedBlocks: 0,
    totalBlocks: 0,
    lastError: null,
  };
  let controlsOpened = false;

  const listTools = () => [
    {
      name: "show_bilingual_controls",
      description: "显示中英双语增强器控制卡。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      _meta: { ui: { resourceUri: CONTROL_RESOURCE_URI } },
    },
    {
      name: "set_bilingual_mode",
      description: "切换关闭、悬停翻译或页面预翻译模式。",
      inputSchema: {
        type: "object",
        properties: { mode: { type: "string", enum: [...MODES] } },
        required: ["mode"],
        additionalProperties: false,
      },
    },
    {
      name: "get_bilingual_status",
      description: "读取覆盖层、离线模型和翻译进度状态。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ];

  const getStatus = () => ({ ...status, ...getRuntimeStatus() });

  const callTool = async (name, args = {}) => {
    if (name === "show_bilingual_controls") {
      if (!controlsOpened) {
        controlsOpened = true;
        const current = getStatus();
        const desiredMode = MODES.has(modeStore.read()) ? modeStore.read() : initialMode;
        if (current.mode !== desiredMode) {
          try {
            const runtimeStatus = await onModeChange(desiredMode);
            if (runtimeStatus && typeof runtimeStatus === "object") Object.assign(status, runtimeStatus);
            status.mode = desiredMode;
            status.lastError = null;
          } catch (error) {
            status.lastError = error?.message || String(error);
          }
        }
      }
      const current = getStatus();
      return {
        ...toolResult(current, `中英双语增强器：当前模式为 ${MODE_LABELS[current.mode] ?? current.mode}。`),
        _meta: { ui: { resourceUri: CONTROL_RESOURCE_URI } },
      };
    }

    if (name === "set_bilingual_mode") {
      if (!MODES.has(args.mode)) {
        throw new Error(`Unsupported bilingual mode: ${String(args.mode)}`);
      }
      try {
        const runtimeStatus = await onModeChange(args.mode);
        if (runtimeStatus && typeof runtimeStatus === "object") Object.assign(status, runtimeStatus);
        status.mode = args.mode;
        modeStore.write(args.mode);
        status.lastError = null;
      } catch (error) {
        status.lastError = error?.message || String(error);
        throw error;
      }
      return toolResult(getStatus(), `中英双语增强器已切换为 ${args.mode}。`);
    }

    if (name === "get_bilingual_status") {
      const current = getStatus();
      return toolResult(current, `中英双语增强器状态：${current.mode}。`);
    }

    throw new Error(`Unknown bilingual tool: ${name}`);
  };

  return { callTool, getStatus, listTools };
}

export { CONTROL_RESOURCE_URI };
