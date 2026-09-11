# dsh-novel-forge —— DeepSeek Harness all-in-one AI creation toolkit (capability-wrapped)

> **🌐 Languages** — [简体中文](README.md) · English · [Français](README.fr.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md)
> Updates: see [CHANGELOG](CHANGELOG.md)

> Turning "织文 NovelForge" into a **DeepSeek Harness all-in-one creation shell (multi-capability studio)**:
> all within one session you get **novel writing / text imitation · continuation · rewriting / UN Security Council
> resolution imitation / academic cold emails**, with **multilingual writing** support.

The engine is packaged as a Harness **bundle plugin**, and works like this:
**all creation happens inside the harness session/workspace** —— the model detects intent and calls the tools directly
(novels via `novel_forge_*`, content/formal-document/email via `novel_forge_cap_*`), and the results plus full-text
previews all come back into the session. **No browser is ever required**; the embedded web app is only an optional
visual interface (the tools and the web app share the same data and stay in sync with each other).

---

> **🌐 Languages**
> [简体中文](README.md) · English · [Français](README.fr.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português](README.pt.md)
> Updates: see [CHANGELOG](CHANGELOG.md)

---

## Capabilities

The engine ships a capability registry `capabilities.js`. A project declares its `cap` at creation time, and every
capability goes through the same unified generation/apply engine:

| Capability `cap` | Name | Purpose | Generation actions |
|---|---|---|---|
| `novel` | Novel writing | idea→**story-route guidance**→bible→characters→outline→writing→review→export (default) | `idea/route/bible/characters/outline/chapter/audit_*` |
| `content` | Text content | upload source → analyze → imitate / continue / rewrite | `content_analyze / content_imitate / content_continue / content_rewrite` |
| `doc` | Formal document | UN Security Council resolution imitation | `doc_resolution` |
| `email` | Academic communication | Academic cold-email editing | `email_cold` |

**Multilingual**: a project can set its `language` (zh/en/fr/ru/es/pt or any language); the engine injects the target
language requirement into the writing instructions. The web UI includes a language switcher (top bar) supporting
Chinese/English/French/Russian/Spanish/Portuguese (untranslated languages fall back to Chinese).

## Install (choose one of three)

Run when the `dsh` CLI is available (inside a source checkout this is `pnpm dsh`):

```sh
# 1) Install the local directory directly (recommended for debugging)
dsh plugin add F:\typing\novel-forge-plugin

# 2) Pack it into a tarball for distribution (no build permission needed)
pnpm pack   # produces dsh-novel-forge-0.3.1.tgz
dsh plugin add ./dsh-novel-forge-0.3.1.tgz

# 3) Or try it directly as a --patch overlay (without opening a profile)
dsh --patch F:\typing\novel-forge-plugin\cordis.patch.yml --patch-argv
```

> If pnpm ≥10 asks to approve build scripts for git dependencies: this package has no build scripts at all, so you can
> distribute the source directly.

## Provided services

| Member | Description |
|---|---|
| `ctx.novelForge.url` | The access URL once ready (e.g. http://127.0.0.1:54321) |
| `ctx.novelForge.status` | `running` / `stopped` |
| `ctx.novelForge.start()` | Start manually (picks a free port automatically and waits for the health check to pass) |
| `ctx.novelForge.stop()` | Stop the child process |
| `ctx.novelForge.describe()` | App information and recent logs |
| `ctx.novelForge.capabilities()` | List of capabilities (novel/content/doc/email and their actions) |

## Novel session tools (novel_forge_*, 14 in total)

The host Agent calls these automatically when it detects novel-writing intent; **all work happens inside the session,
no browser needed**.

> **⚠ Mandatory guidance (this plugin's calling logic)**: whatever the user gives — even a single sentence or one
> paragraph — the model must first produce **2–5 "story route + outline approach" options**
> (`novel_forge_route_plan`), show every option to the user, ask them to choose (by number / their own custom route /
> explicitly delegating), and record the choice with `novel_forge_choose_route`.
> **Until a route is chosen, `novel_forge_develop_project(stage=outline)` and `novel_forge_chain(mode=full)` return
> `NEED_ROUTE` and refuse to run** (only an explicit user request to skip guidance may pass `allowUnrouted=true`).
> The chosen route is injected into the outline prompt (`{{routeText}}`), so the whole book stays on one course
> instead of drifting.
>
> Two details: ① with no choice at all, `novel_forge_choose_route` returns `NEED_CHOICE`, and `delegate` requires the
> user's own authorization wording in `note` (otherwise `NEED_AUTHORIZATION`) — the model may not decide for the user.
> ② When the engine runs only the **offline mock provider**, the options are authored by the **session model instead**
> (`mode:'session'`, with a field spec), so you never get "(mock)" placeholder text; pass your authored options through
> `choose_route.routes` to store them.
>
> Recommended order: `status → new_project → seed_idea → `**`route_plan → (user chooses) → choose_route`**` → develop(flesh/world/characters/outline) → write_chapter → audit → export`

| Tool | Purpose |
|---|---|
| `novel_forge_status` | Engine status + list of projects (including each project's route status; usually the first step) |
| `novel_forge_new_project` | Create a new work (returns the projectId) |
| `novel_forge_seed_idea` | Write the user's idea into an idea card (a single paragraph is accepted as-is) |
| `novel_forge_ideate` | AI brainstorming of candidate ideas (seed after choosing one) |
| `novel_forge_route_plan` | **Mandatory guidance**: produce 2–5 "story route + outline approach" options (approach / stage-by-stage route / escalating conflict / ending / risks + AI recommendation); falls back to session-authored options when the engine only has the mock provider |
| `novel_forge_choose_route` | Record the chosen route: `index` (user's pick) / `custom` (user's own route) / `delegate` (requires the user's authorization wording in `note`); can store session-authored candidates via `routes` |
| `novel_forge_develop_project` | Advance a stage: flesh/world/characters/outline/audit (outline requires a chosen route first; overwriting requires confirmation) |
| `novel_forge_read_project` | Read progress/outline/characters/**story route**/chapter full text for in-session review and decisions |
| `novel_forge_write_chapter` | Write the Nth chapter's full text and archive it to memory automatically (returns a full-text preview; already-written chapters require confirmation) |
| `novel_forge_edit_chapter` | Refine a written chapter: rewrite / polish / continue / summarize-archive |
| `novel_forge_extend_outline` | Append N chapters to the outline (auto-extends when continuing a long work, staying on the chosen route) |
| `novel_forge_chain` | Unattended: full=fill in to a complete book (needs a chosen route) / write=finish the remaining chapters |
| `novel_forge_export` | Export as md/manuscript/txt/json, **full text returned directly into the session** (may be truncated; the draft includes the story route) |
| `novel_forge_remove_project` | Delete a project (requires user confirmation) |

## Capability session tools (capability_*, newly added)

Handle text work other than novels. Everything is done inside the session.

| Tool | Purpose |
|---|---|
| `novel_forge_capabilities` | List the available capabilities and actions |
| `novel_forge_cap_create` | Create a capability project (cap=content/doc/email, may take a language) |
| `novel_forge_cap_set_source` | Write the source text/draft/topic and parameters |
| `novel_forge_cap_analyze` | Analyze the source text (genre/style/structure/characters/theme) |
| `novel_forge_cap_run` | Run imitate/continue/rewrite/doc/email and return a preview |
| `novel_forge_cap_read` | Read the project overview / source text / output list (pass an index to see the full item) |

All tool results carry `ok/code/error` semantics (`NEED_CONFIRM`, `NEED_ROUTE`, `NEED_CHOICE`, `NEED_AUTHORIZATION` etc.),
so the model confirms with the user rather than silently overwriting existing work or deciding for them.

## Configurable options (cordis.patch.yml → config)

- `port`: fixed port; `0` = pick a free port automatically (default)
- `host`: default `127.0.0.1` (data/keys stay on this machine only; set `0.0.0.0` for LAN access at your own risk)
- `autoStart`: start automatically when the host starts (default `true`)
- `startTimeoutMs`: health-check timeout (default 20000)
- `dataDir`: data directory (relative to `app/` or an absolute path; defaults to `app/data`, isolated from the host
  and persisted with the package)

## Requirements and notes

- The host machine needs **Node ≥ 18.17** available (the plugin uses the current `node` executable to launch the
  headless engine child process).
- Usage model: **the harness session is the main interface**; the web interface at `ctx.novelForge.url` is only an
  optional visual editor that shares the same data as the tools and can be opened anytime for reference, but it is
  **not a prerequisite**.
- The first start automatically creates the built-in example 《雾港来信》(Fog Harbor Letter) and presets for 12 model
  vendors (including an offline simulation engine, so you can try the full flow without any Key).
- Model API keys are stored in plaintext in `app/data/settings.json` (for personal/local use; do not deploy to an
  untrusted environment).

## Self-test

```sh
node scripts/test-standalone.mjs   # full launchNovelForge lifecycle (route template/action registration included)
node scripts/test-apply.mjs        # apply() entry (service register/start-stop)
node scripts/test-tools.mjs        # end-to-end tool suite (incl. the "no route ⇒ outline refused" gate)
node scripts/engine-mirror.mjs verify   # engine-mirror zero-drift check
```
