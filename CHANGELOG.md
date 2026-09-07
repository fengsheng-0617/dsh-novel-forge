# Changelog

本文件记录「dsh-novel-forge」（DeepSeek Harness 全能创作壳）每一版的显著变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.0] - 2026-09-07

### Added
- **能力化升级**：插件定位升级为「全能创作壳」，把嵌入式 NovelForge 作为一个能力托管，并新增 content / doc / email 三类能力，均通过统一生成/应用引擎调用。
- **新能力会话工具（6 个）**：`novel_forge_capabilities`、`novel_forge_cap_create`、`novel_forge_cap_set_source`、`novel_forge_cap_analyze`、`novel_forge_cap_run`、`novel_forge_cap_read`。
- **服务扩展**：`ctx.novelForge.capabilities()` 返回能力清单（novel/content/doc/email 及动作）。
- **引擎能力框架镜像**：`app/server/capabilities.js` 注册表、项目 `cap` 字段、`/api/capabilities`、`/api/projects/:id/workspace`。
- **多语言**：前端 i18n（`app/public/js/i18n.js`，中/英全量 + 法/俄/西/葡回退中文），顶栏语言选择器；项目 `language` 字段支持任意目标语言写作。
- **网页能力工作台**：`app/public/js/views/capStudio.js`。

### Changed
- 会话工具总数由 12 → 18（12 个 `novel_forge_*` 小说工具 + 6 个 `novel_forge_cap_*` 能力工具）。
- 引擎动作总数（novel 各阶段 + 能力动作）；模板 18 → 24。
- 前端 UI 文案全面接入 `t()`（zh 基座，未覆盖键回退中文）。
- 插件版本 0.2.0 → 0.3.0（同步引擎 0.4.0）。

### Fixed
- 更新插件自测断言以适配新能力数量（模板 24 套 / 工具 18 个）。
- 修正 3 处由能力工具镜像引入的 ESM 括号平衡错误（app 内 `bible/audit/outline` 视图）。

### Verify
- 插件自测全绿：standalone 8/8 · apply 9/9 · tools 26/26。
- 引擎镜像 `engine-mirror verify`：源/插件 32 vs 32 零漂移。

## [0.2.0] - 2026-09-06

### Added
- 首次成形的插件化（DSH 组合包）：内嵌引擎镜像 + `novelForge` 生命周期服务 + 12 个 `novel_forge_*` 会话工具。
- 修复 Electron 宿主下 `process.execPath` 非 node、宿主 logger 无 `.log` 两个关键运行时问题。
- `resolveNode()` 处理桌面(Electron)/CLI 宿主差异；`cordis.patch.yml` 配置层（服务行 + 工具行）。
- 挂载自检 `check-mount.bat` → `mount-check-report.txt`。

### Fixed
- （首版无既有缺陷记录；此版本为可追溯起始点。）

[0.3.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.2.0
