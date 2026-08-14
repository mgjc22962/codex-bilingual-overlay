# Third-Party Notices

本仓库的源码使用 MIT License。以下组件由安装脚本或 npm 单独获取，并继续受各自许可证约束：

- `@modelcontextprotocol/sdk`、`@modelcontextprotocol/ext-apps`、`zod`：以各自 npm 包所附许可证为准。
- CTranslate2：MIT License。
- SentencePiece：Apache License 2.0。
- Argos English-Chinese model 1.9：由 OPUS-MT 模型打包而来，模型 README 标明原始模型使用 CC BY 4.0；作者信息为 Jörg Tiedemann 和 Santhosh Thottingal。

公开仓库和发布压缩包不重新分发 Python 环境或翻译模型。`scripts/install-runtime.mjs` 在用户明确运行安装时从上游下载它们。

