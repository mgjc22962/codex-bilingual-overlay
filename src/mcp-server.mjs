import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getUiCapability,
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

import { CONTROL_CARD_HTML } from "./control-card.mjs";
import { CONTROL_RESOURCE_URI } from "./protocol.mjs";

export function createMcpServer(protocol, { controlWindow } = {}) {
  const server = new McpServer({
    name: "codex-bilingual-overlay",
    version: "0.1.1",
  });

  registerAppResource(
    server,
    "中英双语增强器控制卡",
    CONTROL_RESOURCE_URI,
    { description: "切换本地双语覆盖层模式。" },
    async () => ({
      contents: [{
        uri: CONTROL_RESOURCE_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: CONTROL_CARD_HTML,
        _meta: { ui: { prefersBorder: true } },
      }],
    }),
  );

  registerAppTool(
    server,
    "show_bilingual_controls",
    {
      title: "显示中英双语增强器",
      description: "显示中英双语增强器控制卡。",
      inputSchema: {},
      _meta: { ui: { resourceUri: CONTROL_RESOURCE_URI } },
    },
    async () => {
      const result = await protocol.callTool("show_bilingual_controls", {});
      const ui = getUiCapability(server.server.getClientCapabilities());
      if (!controlWindow || ui?.mimeTypes?.includes(RESOURCE_MIME_TYPE)) return result;

      const { structuredContent } = result;
      try {
        await controlWindow.show(structuredContent.mode);
        return {
          structuredContent,
          content: [{ type: "text", text: `控制卡已在 Windows 桌面打开。 ${result.content[0].text}` }],
        };
      } catch (error) {
        return {
          isError: true,
          structuredContent,
          content: [{
            type: "text",
            text: `无法打开 Windows 控制卡：${error.message}。仍可直接用翻译模式指令切换。`,
          }],
        };
      }
    },
  );

  server.registerTool(
    "set_bilingual_mode",
    {
      title: "切换双语翻译模式",
      description: "切换关闭、悬停翻译或页面预翻译模式。",
      inputSchema: { mode: z.enum(["off", "hover", "preload"]) },
    },
    async ({ mode }) => {
      const result = await protocol.callTool("set_bilingual_mode", { mode });
      controlWindow?.update(result.structuredContent.mode);
      return result;
    },
  );

  server.registerTool(
    "get_bilingual_status",
    {
      title: "读取双语增强器状态",
      description: "读取覆盖层、离线模型和翻译进度状态。",
      inputSchema: {},
    },
    async () => protocol.callTool("get_bilingual_status", {}),
  );

  return server;
}
