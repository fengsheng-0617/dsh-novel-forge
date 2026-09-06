# dsh-novel-forge —— DeepSeek Harness 插件化封装

把「织文 NovelForge」（AI 小说创作工坊）打包成 DeepSeek Harness **组合包插件**，工作形态：
**在 harness 会话/工作区里完成全部创作** —— 新建工作区后直接说出"我有个点子，想写一部小说"，
模型即检测意图并调用 `novel_forge_*` 工具：点子 → 设定 → 人物 → 大纲 → 逐章写作 → 精修/审校/导出，
结果与正文预览全部回到会话。**无需打开任何浏览器**；内嵌网页应用仅作为可选的可视化编辑界面
（工具与网页共用同一份书稿数据，互相同步）。

```
novel-forge-plugin/
├─ package.json        # dsh.bundle manifest（name/main/dsh.bundle.patch/exports）
├─ cordis.patch.yml    # 配置层：novel-forge 服务行 + novel-forge-tools 工具行
├─ index.js            # 插件入口：无头引擎子进程生命周期 + novelForge 服务
├─ tools.js            # 12 个 novel_forge_* 会话工具（harness 内全量创作）
├─ app/                # 内嵌的 NovelForge 引擎本体（server + public，零 npm 依赖）
│  └─ data/            # 首次运行时生成：项目库与设置（含你的 API Key，仅存本机）
└─ README.md
```

## 安装（三选一）

在 `dsh` CLI 可用时（源码 checkout 内为 `pnpm dsh`）：

```sh
# 1) 直接装本地目录（推荐调试）
dsh plugin add F:\typing\novel-forge-plugin

# 2) 打包为 tarball 分发（无需构建权限）
pnpm pack   # 得到 dsh-novel-forge-0.1.0.tgz
dsh plugin add ./dsh-novel-forge-0.1.0.tgz

# 3) 或作为 --patch overlay 直接试用（不开 profile）
dsh --patch F:\typing\novel-forge-plugin\cordis.patch.yml --patch-argv
#   并让 loader 能找到本包：将其放入 node 解析路径或先 npm link
```

> 若出现 pnpm ≥10 对 git 依赖构建脚本的授权要求：本包无任何构建脚本，直接分发
> 源码即可，不涉及该授权。

## 提供的服务

| 成员 | 说明 |
|---|---|
| `ctx.novelForge.url` | 就绪后的访问地址（如 http://127.0.0.1:54321） |
| `ctx.novelForge.status` | `running` / `stopped` |
| `ctx.novelForge.start()` | 手动启动（自动选空闲端口，等待健康检查通过） |
| `ctx.novelForge.stop()` | 停止子进程 |
| `ctx.novelForge.describe()` | 应用信息与最近日志 |

## 会话工具（novel_forge_*，v0.2+，共 12 个）

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

工具结果均带 `ok/code/error` 语义（`NEED_CONFIRM` 等），模型据此向用户确认，不会静默覆盖已有创作。
生成的章节会返回正文预览、导出内容直接可读，用户全程停留在 harness 会话内。

## 可配置项（cordis.patch.yml → config）

- `port`：固定端口；`0` = 自动挑选空闲端口（默认）
- `host`：默认 `127.0.0.1`（数据/密钥仅本机；如需局域网访问改为 `0.0.0.0` 并自行担责）
- `autoStart`：宿主启动后自动拉起（默认 `true`）
- `startTimeoutMs`：健康检查超时（默认 20000）
- `dataDir`：数据目录（相对 `app/` 或绝对路径；缺省 `app/data`，与宿主隔离、随包持久化）

## 环境要求与注意事项

- 需要宿主机器存在可用的 **Node ≥ 18.17**（插件用当前 `node` 可执行文件拉起无头引擎子进程）。
- 使用形态：**harness 会话即主界面**（novel_forge_* 工具）；`ctx.novelForge.url` 指向的网页界面
  仅是可选的可视化编辑器，与工具共用同一数据，随时可打开对照，但**不是使用前提**。
- 首次启动会自动创建内置示例《雾港来信》与 12 家模型厂商预设（含离线模拟引擎，无需 Key 即可体验全流程）。
- 模型 API Key 以明文保存在 `app/data/settings.json`（个人本地使用；请勿部署到不受信环境）。

## 自测

```sh
node scripts/test-standalone.mjs
```

该测试不依赖 Cordis，用最小 ctx 桩直接调用 `launchNovelForge()`：
启动 → 轮询 /api/health → 断言示例项目存在 → 停止子进程。
