# Public Release Design

## Goal

Package the verified local plugin as a reproducible public GitHub repository without changing the currently running Codex installation.

## Distribution

The repository contains source, tests, an MIT license, CI, and a Windows recovery installer. Large Python and model artifacts are intentionally excluded. The installer recreates them under `%PUBLIC%\CodexBilingualOverlay` from pinned dependencies and the upstream Argos model.

## Safety

Publication is prepared in a separate directory. The live plugin source, active cache and runtime remain untouched. Cleanup is restricted to an empty superseded cache and a verified temporary work snapshot, and occurs only after remote publication succeeds.

## Verification

Before publication: install npm dependencies, run the complete test suite, validate the plugin manifest, perform an isolated installer test, scan tracked files for secrets and personal paths, and create a local commit and release archive. Public repository creation and push require the user's single final approval.
