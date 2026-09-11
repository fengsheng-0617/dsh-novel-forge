# Changelog

> **🌐 语言 / Languages**
> 简体中文 | [English](CHANGELOG.en.md) · [Français](CHANGELOG.fr.md) · [Русский](CHANGELOG.ru.md) · [Español](CHANGELOG.es.md) · [Português](CHANGELOG.pt.md)

本文件记录「dsh-novel-forge」（DeepSeek Harness 全能创作壳）每一版的显著变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.1] - 2026-09-11

### Added
- **故事路线强制引导（调用逻辑修正）**：无论用户给多少内容——哪怕只有一句话、一段话——都必须先产出
  2~5 条「故事路线 + 大纲思路」候选，逐条展示给用户选择，选定后写入项目，再生成大纲。
  - 新工具 `novel_forge_route_plan`：产出候选（大纲思路 / 阶段路线 / 主线冲突升级 / 结局走向 / 贯穿伏笔 / 取舍风险 / AI 推荐），
    支持直接传 `paragraph`（用户原话）并在立项书过薄时自动先深化；返回 `mustChoose=true` 与"必须展示给用户"的指令。
  - 新工具 `novel_forge_choose_route`：按 `index`（用户选编号）/`custom`（用户自定义路线）/`delegate`（用户明确授权 AI 选定）写入选定路线；
    缺少选择时返回 `NEED_CHOICE`，不允许替用户拍板。
- **引擎路线环节**（独立版为真源，已镜像）：新模板 `t_route_plan` + 新动作 `route_plan`（stage=idea）、项目 `routes` 文档
  （候选 + 选定）、`{{routeText}}` 变量注入 `t_outline_generate` / `t_outline_extend`。
- **底稿与列表**：`manuscript` 导出新增「故事路线与大纲思路」区块；项目列表带路线状态；点子页新增路线候选卡片（选定/采用 AI 推荐/换一批）。

- **会话自产候选（保证引导质量）**：引擎只配了离线模拟引擎（或引擎调用失败）时，`novel_forge_route_plan` 改为返回
  `mode:'session'` + 字段规范，由会话模型自己产出 2~5 条路线候选（避免"（模拟）"占位文本），再经
  `novel_forge_choose_route(routes=[…], index/custom/delegate)` 入库；`source` 参数可强制 `engine` / `session` / `auto`。
- **防止替用户拍板**：`novel_forge_choose_route` 在无选择时返回 `NEED_CHOICE`；`delegate=true` 必须附用户授权原话
  （`note`），否则返回 `NEED_AUTHORIZATION`。

### Changed
- **门禁（硬性）**：未选定路线时 `novel_forge_develop_project(stage=outline)` 与 `novel_forge_chain(mode=full)` 直接返回
  `NEED_ROUTE` 拒绝执行（仅当用户明确要求"跳过引导"才可传 `allowUnrouted=true`，并在结果中标注未经引导）。
- 其余阶段（flesh/world/characters）仍可推进，但会附带"路线尚未选定"的提醒；`novel_forge_read_project` 新增 `routes` 视图。
- 无人值守流水线 `full` 现在会先补一步 `route_plan`，大纲以 AI 推荐路线为纲（人在场时仍应先人工选定）。
- 会话工具总数 18 → 20（14 个 `novel_forge_*` + 6 个 `novel_forge_cap_*`）；模板 24 → 25；引擎动作 18 → 19。
- 插件版本 0.3.0 → 0.3.1（同步引擎 0.4.1）。

### Fixed
- 修正"用户只给一段话就直接生成大纲、无人把关"的调用逻辑缺陷：路线选择成为大纲的强制前置条件，且大纲提示词始终携带选定路线，避免大纲散乱。

### Verify
- 插件自测全绿：standalone 10/10 · apply 9/9 · tools 46/46（含 `NEED_ROUTE` 门禁、`NEED_AUTHORIZATION`、以及"一段话/模拟引擎走通引导"用例）。
- 引擎侧：`test-route.js` 17/17 · `test-gen.js` 43/43 · `test-api.js` 26/26 · `test-pipeline.js` 21/21 · `acceptance.js` 20/20 · 渲染 9/9 · 交互 11/11。
- 引擎镜像 `engine-mirror verify`：源/插件 32 vs 32 零漂移。

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

[0.3.1]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.1
[0.3.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/fengsheng-0617/dsh-novel-forge/releases/tag/v0.2.0
