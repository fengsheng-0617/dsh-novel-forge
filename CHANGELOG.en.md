# Changelog

> **🌐 Languages**
> [简体中文](CHANGELOG.md) · English · [Français](CHANGELOG.fr.md) · [Русский](CHANGELOG.ru.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt.md)

This changelog records notable changes to dsh-novel-forge (DeepSeek Harness all-in-one creation shell), following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [0.3.1] - 2026-09-11

### Added
- **Mandatory story-route guidance (calling-logic fix)**: whatever the user provides — even a single sentence or one
  paragraph — the model must first produce 2–5 "story route + outline approach" options, show every option to the
  user, record the choice, and only then generate the outline.
  - New tool `novel_forge_route_plan`: produces the options (outline approach / stage-by-stage route / escalating core
    conflict / ending direction / running foreshadowing / trade-offs / AI recommendation). Accepts the user's raw
    `paragraph` and auto-deepens a thin premise first; returns `mustChoose=true` plus an explicit "show these to the user" instruction.
  - New tool `novel_forge_choose_route`: records the choice via `index` (user picked a number), `custom` (user's own route),
    or `delegate` (user explicitly authorized the AI to choose). Without a choice it returns `NEED_CHOICE` — the model may not decide for the user.
- **Engine-side route stage** (standalone repo is the single source, mirrored into the plugin): new template `t_route_plan`,
  new action `route_plan` (stage=idea), project-level `routes` document (candidates + selected), and the `{{routeText}}`
  variable injected into `t_outline_generate` / `t_outline_extend`.
- **Manuscript & listings**: the `manuscript` export gained a "story route and outline approach" section; the project list
  reports route status; the idea page gained a route-candidate card (select / adopt AI recommendation / regenerate).

- **Session-authored options (keeps guidance meaningful)**: when the engine only has the offline mock provider (or the
  engine call fails), `novel_forge_route_plan` returns `mode:'session'` plus a field spec so the **session model authors**
  the 2–5 route options itself (no "(mock)" placeholders); they are stored via
  `novel_forge_choose_route(routes=[…], index/custom/delegate)`. The `source` parameter can force `engine` / `session` / `auto`.
- **No deciding for the user**: `novel_forge_choose_route` returns `NEED_CHOICE` without a choice, and `delegate=true`
  requires the user's own authorization wording in `note` (otherwise `NEED_AUTHORIZATION`).

### Changed
- **Hard gate**: without a selected route, `novel_forge_develop_project(stage=outline)` and `novel_forge_chain(mode=full)`
  return `NEED_ROUTE` and refuse to run (only an explicit user request to skip guidance may pass `allowUnrouted=true`,
  and the result is flagged as unguided).
- Other stages (flesh/world/characters) still run, but carry a "route not selected yet" reminder; `novel_forge_read_project`
  gained a `routes` view.
- The unattended `full` pipeline now inserts a `route_plan` step first and outlines against the AI-recommended route
  (with a human present, the choice should still be made manually).
- Total session tools 18 → 20 (14 `novel_forge_*` + 6 `novel_forge_cap_*`); templates 24 → 25; engine actions 18 → 19.
- Plugin version 0.3.0 → 0.3.1 (in sync with engine 0.4.1).

### Fixed
- Fixed the calling-logic defect where a one-paragraph idea went straight to a generated outline with nobody in the loop:
  route selection is now a mandatory precondition for the outline, and the outline prompt always carries the selected
  route, so the outline no longer drifts.

### Verify
- Plugin self-tests all green: standalone 10/10 · apply 9/9 · tools 46/46 (including the `NEED_ROUTE` gate,
  `NEED_AUTHORIZATION`, and a "one paragraph / mock engine reaches the guided flow" case).
- Engine side: `test-route.js` 17/17 · `test-gen.js` 43/43 · `test-api.js` 26/26 · `test-pipeline.js` 21/21 ·
  `acceptance.js` 20/20 · render 9/9 routes · interaction 11/11.
- Engine mirror `engine-mirror verify`: source/plugin 32 vs 32, zero drift.

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

[0.3.1]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.1
[0.3.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.2.0
