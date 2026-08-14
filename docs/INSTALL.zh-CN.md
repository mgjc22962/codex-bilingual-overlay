# 安装、恢复与卸载

## 首次安装

1. 下载 GitHub Release 的源码压缩包并解压，或克隆仓库。
2. 在仓库目录运行：

   ```powershell
   node .\scripts\install-plugin.mjs
   ```

3. 重启 Codex。
4. 如果插件没有自动显示为已安装，在“插件 → 个人”中选择“中英双语增强器”并安装。
5. 新建任务，输入“打开中英双语增强器控制卡”。

安装脚本会保留个人市场中其他插件条目，不会修改 Codex 程序文件。

## Codex 或插件被卸载后的恢复

重新下载本仓库，再次执行安装命令即可。若 `%PUBLIC%\CodexBilingualOverlay` 仍存在，运行时脚本会复用已经安装的模型；若不存在，则重新下载。

## 仅修复离线运行时

```powershell
node .\scripts\install-runtime.mjs
```

## 卸载

1. 在控制卡选择“关闭”。
2. 从 Codex 插件页卸载“中英双语增强器”。
3. 如需释放空间，可在 Codex 完全退出后删除：
   - `%USERPROFILE%\plugins\codex-bilingual-overlay`
   - `%PUBLIC%\CodexBilingualOverlay`

删除运行时会释放约 214 MB，但下次安装需要重新下载模型。不要删除 `.codex` 下其他插件的缓存。

## 更新后的兼容性

本项目不注入 Codex，因此普通更新通常不会伤害 Codex。若大版本更新改变插件页或 Skill 详情页的 UI Automation 结构，翻译覆盖率可能下降；此时切换到“关闭”即可完全恢复 Codex 原始显示，再等待兼容更新。

