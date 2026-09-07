# Changelog

> **🌐 Languages**
> [简体中文](CHANGELOG.md) · English · [Français](CHANGELOG.fr.md) · [Русский](CHANGELOG.ru.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt.md)

This changelog records notable changes to dsh-novel-forge (DeepSeek Harness all-in-one creation shell), following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-09-07

### Added
- **Capability-driven upgrade**: the plugin is repositioned as an "all-in-one creation shell", hosting the embedded NovelForge as a capability and adding the content / doc / email capability categories, all invoked through a unified generate/apply engine.
- **New capability session tools (6)**: `novel_forge_capabilities`, `novel_forge_cap_create`, `novel_forge_cap_set_source`, `novel_forge_cap_analyze`, `novel_forge_cap_run`, `novel_forge_cap_read`.
- **Service extension**: `ctx.novelForge.capabilities()` returns the capability catalog (novel/content/doc/email and actions).
- **Engine capability-framework mirror**: `app/server/capabilities.js` registry, the project `cap` field, `/api/capabilities`, `/api/projects/:id/workspace`.
- **Localization**: frontend i18n (`app/public/js/i18n.js`, full zh/en + fr/ru/es/pt falling back to Chinese), top-bar language selector; the project `language` field supports writing in any target language.
- **Web capability workbench**: `app/public/js/views/capStudio.js`.

### Changed
- Total session tools from 12 → 18 (12 `novel_forge_*` novel tools + 6 `novel_forge_cap_*` capability tools).
- Total engine actions (novel stages + capability actions); templates 18 → 24.
- Frontend UI copy fully wired into `t()` (zh base; uncovered keys fall back to Chinese).
- Plugin version 0.2.0 → 0.3.0 (in sync with engine 0.4.0).

### Fixed
- Updated plugin self-test assertions to match the new capability counts (24 template sets / 18 tools).
- Corrected 3 ESM bracket-balance errors introduced by the capability-tool mirror (the `bible/audit/outline` views under app).

### Verify
- Plugin self-tests all green: standalone 8/8 · apply 9/9 · tools 26/26.
- Engine mirror `engine-mirror verify`: source/plugin 32 vs 32, zero drift.

## [0.2.0] - 2026-09-06

### Added
- First concrete pluginization (DSH bundle): embedded engine mirror + `novelForge` lifecycle service + 12 `novel_forge_*` session tools.
- Fixed two critical runtime issues under the Electron host: non-node `process.execPath` and the host logger lacking `.log`.
- `resolveNode()` handles desktop(Electron)/CLI host differences; `cordis.patch.yml` configuration layer (service rows + tool rows).
- Mount self-check `check-mount.bat` → `mount-check-report.txt`.

### Fixed
- (no prior defects recorded; this is the first trackable release).

[0.3.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.2.0
