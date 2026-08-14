# Codex Bilingual Overlay / Codex 中英双语增强器

一个面向 Windows 版 Codex 的开源中英双语覆盖层。它保留 Codex 中的英文原文，并通过独立、点击穿透的窗口在旁边或下方显示简体中文翻译。

An open-source bilingual overlay for Codex on Windows. It preserves the original English UI and displays Simplified Chinese translations in a separate, click-through window.

## 功能

- 三种模式：关闭、悬停翻译、页面预翻译。
- 插件与 Skill 名称采用常见中文叫法，如 `Computer Use（电脑控制）`、`Google Calendar（谷歌日历）`。
- 插件卡片标题和说明分别翻译，悬停时可同时显示。
- 所有符合结构特征的 Skill 详情页均使用一块完整中文面板，保留段落、标题和项目符号顺序，不依赖插件名称白名单。
- 以中文为主的对话只提取其中的英文片段，不重复“翻译”整段中文。
- 品牌、代码、参数键、路径、URL、JSON 和版本号受到保护。
- 模式保存在本机；重新打开控制卡不会自动跳回默认模式。

## 安装或恢复

要求：Windows 10/11、Codex 桌面版、Node.js 20 或更高版本、可用的 Python 3（优先使用 Codex 自带运行时）。首次安装离线模型需要网络，约占 214 MB。

从 GitHub 下载 ZIP 并解压，或执行：

```powershell
git clone https://github.com/mgjc22962/codex-bilingual-overlay.git
cd codex-bilingual-overlay
node .\scripts\install-plugin.mjs
```

安装脚本会：

1. 将插件复制到 `%USERPROFILE%\plugins\codex-bilingual-overlay`；
2. 安装 Node.js 依赖；
3. 在 `%PUBLIC%\CodexBilingualOverlay` 创建隔离的 Python 环境并安装离线英译中模型；
4. 写入个人插件市场条目，并尝试调用 Codex CLI 安装插件。

若 Codex CLI 不可用，脚本仍会完成文件和个人市场配置。随后重启 Codex，在“插件 → 个人”中安装“中英双语增强器”。打开一个新任务，输入“打开中英双语增强器控制卡”。

如果以后卸载了 Codex 或本插件，只需重新下载本仓库并再次运行同一个安装命令。详细步骤见 [安装与恢复指南](docs/INSTALL.zh-CN.md)。

## 使用

控制卡提供：

- `关闭`：停止覆盖层并清除译文；
- `悬停翻译`：鼠标指向英文后显示译文；Skill 正文悬停时显示完整中文面板；
- `页面预翻译`：持续显示当前页面的短译文，并在 Skill 详情页显示完整中文面板。

MCP 接口：

- `show_bilingual_controls()`
- `set_bilingual_mode({ mode: "off" | "hover" | "preload" })`
- `get_bilingual_status()`

## 安全设计

- 不修改或注入 Codex，不写入 WindowsApps，不要求管理员权限。
- 覆盖窗口使用点击穿透和不可激活样式，不拦截鼠标、焦点或滚轮。
- MCP 服务、翻译进程和覆盖层分开运行；任何翻译组件故障时只隐藏译文。
- 不读取或改写插件调用参数、返回值和账户数据。
- Codex 大版本改变可访问性结构后可能需要适配；更新前可先切换到“关闭”。

架构说明见 [ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 开发与验证

```powershell
npm ci
npm test
```

稳定性测试默认运行两小时，每 10 秒切换模式：

```powershell
node .\scripts\soak-run.mjs 7200000 10000
```

## 许可

本项目使用 [MIT License](LICENSE)，允许任何人免费使用、复制、修改、合并、发布、分发、再许可和销售本项目副本，但必须保留原版权和许可声明。离线翻译模型与第三方依赖使用各自的许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

Copyright (c) 2026 mgjc22962
