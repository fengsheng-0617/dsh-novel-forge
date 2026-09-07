# dsh-novel-forge —— DeepSeek Harness 全能 AI 创作工具（能力化封装）

> 把「织文 NovelForge」升级为 **DeepSeek Harness 全能创作壳（multi-capability studio）**：
> 在一个会话里完成 **小说创作 / 文本仿写·续写·改写 / 安理会决议仿写 / 学术套磁邮件**，并支持**多语言写作**。

把引擎做成 Harness **组合包插件**，工作形态：
**在 harness 会话/工作区里完成全部创作** —— 模型检测意图后直接调用工具（小说用 `novel_forge_*`，
内容/公文/邮件用 `novel_forge_cap_*`），结果与正文预览全部回到会话。**无需打开任何浏览器**；
内嵌网页应用仅作为可选的可视化界面（工具与网页共用同一份数据，互相同步）。

> **Languages / 语言** — README: [中文](#中文) · [English](#english)　·　更新记录：[CHANGELOG](CHANGELOG.md)

---

## 中文

### 提供的「能力」（capabilities）

引擎带能力注册表 `capabilities.js`，项目创建时指定 `cap`，不同能力走统一的生成/应用引擎：

| 能力 `cap` | 名称 | 说明 | 生成动作 |
|---|---|---|---|
| `novel` | 小说创作 | 点子→设定→人物→大纲→逐章写作→审校→导出（默认） | `idea/bible/characters/outline/chapter/audit_*` |
| `content` | 文本内容 | 上传原文 → 分析 → 仿写 / 续写 / 改写 | `content_analyze / content_imitate / content_continue / content_rewrite` |
| `doc` | 公文体例 | 联合国安理会决议仿写 | `doc_resolution` |
| `email` | 学术沟通 | 学术套磁邮件编辑 | `email_cold` |

**多语言**：项目可设 `language`（zh/en/fr/ru/es/pt 或任意语言），引擎在写作指令中注入目标语言要求；
前端 UI 含语言选择器（顶栏），支持中/英/法/俄/西/葡（未翻译语言回退中文）。

### 安装（三选一）

在 `dsh` CLI 可用时（源码 checkout 内为 `pnpm dsh`）：

```sh
# 1) 直接装本地目录（推荐调试）
dsh plugin add F:\typing\novel-forge-plugin

# 2) 打包为 tarball 分发（无需构建权限）
pnpm pack   # 得到 dsh-novel-forge-0.3.0.tgz
dsh plugin add ./dsh-novel-forge-0.3.0.tgz

# 3) 或作为 --patch overlay 直接试用（不开 profile）
dsh --patch F:\typing\novel-forge-plugin\cordis.patch.yml --patch-argv
```

> 若出现 pnpm ≥10 对 git 依赖构建脚本的授权要求：本包无任何构建脚本，直接分发源码即可。

### 提供的服务

| 成员 | 说明 |
|---|---|
| `ctx.novelForge.url` | 就绪后的访问地址（如 http://127.0.0.1:54321） |
| `ctx.novelForge.status` | `running` / `stopped` |
| `ctx.novelForge.start()` | 手动启动（自动选空闲端口，等待健康检查通过） |
| `ctx.novelForge.stop()` | 停止子进程 |
| `ctx.novelForge.describe()` | 应用信息与最近日志 |
| `ctx.novelForge.capabilities()` | 能力清单（novel/content/doc/email 及动作） |

### 小说会话工具（novel_forge_*，共 12 个）

宿主 Agent 检测到小说创作意图时自动调用；**全部工作在会话内完成，无需打开浏览器**。

| 工具 | 用途 |
|---|---|
| `novel_forge_status` | 引擎状态 + 项目清单（通常第一步） |
| `novel_forge_new_project` | 新建作品（返回 projectId） |
| `novel_forge_seed_idea` | 把用户点子写入创意卡 |
| `novel_forge_ideate` | AI 头脑风暴候选点子（选后 seed） |
| `novel_forge_develop_project` | 推进阶段：flesh/world/characters/outline/audit（覆盖需确认） |
| `novel_forge_read_project` | 读进度/大纲/角色/**章节正文**，供会话内审读与决策 |
| `novel_forge_write_chapter` | 写第 N 章正文并自动归档记忆（返回正文预览；已写章需确认） |
| `novel_forge_edit_chapter` | 已写章精修：rewrite 重写 / polish 润色 / continue 续写 / summarize 归档 |
| `novel_forge_extend_outline` | 大纲追加 N 章（续写长篇时自动扩章） |
| `novel_forge_chain` | 无人值守：full=补齐到全本 / write=写完剩余章节 |
| `novel_forge_export` | md/manuscript/txt/json 导出，**全文直接返回会话**（可截断） |
| `novel_forge_remove_project` | 删除项目（需用户确认） |

### 能力会话工具（capability_*，新增）

处理小说之外的文本工作。全部在会话内完成。

| 工具 | 用途 |
|---|---|
| `novel_forge_capabilities` | 列出可用能力与动作 |
| `novel_forge_cap_create` | 新建能力项目（cap=content/doc/email，可带 language） |
| `novel_forge_cap_set_source` | 写入源文本/草稿/议题与参数 |
| `novel_forge_cap_analyze` | 分析源文本（题材/文风/结构/人物/主题） |
| `novel_forge_cap_run` | 执行 imitate/continue/rewrite/doc/email，返回预览 |
| `novel_forge_cap_read` | 读项目概览 / 源文本 / 输出列表（可指定 index 看完整） |

工具结果均带 `ok/code/error` 语义（`NEED_CONFIRM` 等），模型据此向用户确认，不会静默覆盖已有创作。

### 可配置项（cordis.patch.yml → config）

- `port`：固定端口；`0` = 自动挑选空闲端口（默认）
- `host`：默认 `127.0.0.1`（数据/密钥仅本机；如需局域网访问改为 `0.0.0.0` 并自行担责）
- `autoStart`：宿主启动后自动拉起（默认 `true`）
- `startTimeoutMs`：健康检查超时（默认 20000）
- `dataDir`：数据目录（相对 `app/` 或绝对路径；缺省 `app/data`，与宿主隔离、随包持久化）

### 环境要求与注意事项

- 需要宿主机器存在可用的 **Node ≥ 18.17**（插件用当前 `node` 可执行文件拉起无头引擎子进程）。
- 使用形态：**harness 会话即主界面**；`ctx.novelForge.url` 指向的网页界面仅是可选的可视化编辑器，
  与工具共用同一数据，随时可打开对照，但**不是使用前提**。
- 首次启动会自动创建内置示例《雾港来信》与 12 家模型厂商预设（含离线模拟引擎，无需 Key 即可体验全流程）。
- 模型 API Key 以明文保存在 `app/data/settings.json`（个人本地使用；请勿部署到不受信环境）。

### 自测

```sh
node scripts/test-standalone.mjs   # launchNovelForge 全生命周期
node scripts/test-apply.mjs        # apply() 入口（服务注册/启停）
node scripts/engine-mirror.mjs verify   # 引擎镜像零漂移校验
```

---

## English

### Capabilities

The engine ships a capability registry (`capabilities.js`). A project carries a `cap` field and all
capabilities share the same generation/apply engine:

| `cap` | Name | Purpose | Actions |
|---|---|---|---|
| `novel` | Novel writing | idea→bible→characters→outline→writing→review→export (default) | `idea/bible/characters/outline/chapter/audit_*` |
| `content` | Text content | paste source → analyze → imitate / continue / rewrite | `content_analyze / content_imitate / content_continue / content_rewrite` |
| `doc` | Formal document | UN Security Council resolution imitation | `doc_resolution` |
| `email` | Academic comms | Academic cold-email editing | `email_cold` |

**Multilingual**: set project `language` (zh/en/fr/ru/es/pt or any); the engine injects the target-language
requirement into writing instructions. The web UI has a language switcher (top bar) supporting
Chinese/English/French/Russian/Spanish/Portuguese (untranslated languages fall back to Chinese).

### Install

```sh
dsh plugin add F:\typing\novel-forge-plugin   # local dir (debug)
# or
pnpm pack && dsh plugin add ./dsh-novel-forge-0.3.0.tgz
# or
dsh --patch F:\typing\novel-forge-plugin\cordis.patch.yml --patch-argv
```

### Service

Exposes `ctx.novelForge.url/.status/.start()/.stop()/.describe()` plus `ctx.novelForge.capabilities()`.

### Session tools

- **Novel**: `novel_forge_*` (12 tools, same as before).
- **Capability**: `novel_forge_capabilities`, `novel_forge_cap_create`, `novel_forge_cap_set_source`,
  `novel_forge_cap_analyze`, `novel_forge_cap_run`, `novel_forge_cap_read`.

All results carry `ok/code/error` semantics so the model confirms destructive actions with the user.

### Config

`port`, `host`, `autoStart`, `startTimeoutMs`, `dataDir` (see `cordis.patch.yml`).

### Requirements

Needs **Node ≥ 18.17** on the host. API keys are stored in plaintext in `app/data/settings.json` —
use only on trusted machine.

### Self-test

```sh
node scripts/test-standalone.mjs
node scripts/test-apply.mjs
node scripts/engine-mirror.mjs verify
```
