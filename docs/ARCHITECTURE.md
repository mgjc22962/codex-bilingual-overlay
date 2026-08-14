# Architecture and Safety Boundaries

The plugin has three isolated processes:

1. MCP server: exposes the control card and mode/status tools.
2. Translation worker: runs the local CTranslate2 model.
3. Windows overlay host: reads visible text through UI Automation and draws click-through labels or panels.

The overlay never modifies the Codex DOM or executable. It uses `WS_EX_TRANSPARENT`, `WS_EX_NOACTIVATE`, transparent hit testing, and no-activate positioning. A failure in translation or rendering closes or hides only the overlay; it does not change plugin invocation payloads.

Skill full-text translation is selected by generic structural signals in the visible accessibility tree, not by a `Computer Use` whitelist. Dense English prose in a bounded Skill context becomes one ordered translation job and one Chinese panel. Mostly Chinese chat uses segment extraction so only embedded English is translated.

