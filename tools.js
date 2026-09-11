// tools.js —— dsh-novel-forge 的「会话工具」子插件入口（harness 内全量工作形态）。
// 作用：向宿主注册 novel_forge_* 工具集。用户只需在 harness 会话/工作区里说出创作
//       意图（“我有个点子想写小说”“继续写下去”“导出全书”…），模型即检测关键词并
//       在会话内全量调用：建项目→点子→**故事路线引导（强制）**→设定→人物→大纲→逐章写作
//       →精修→审校→导出，结果与正文预览直接回到会话。无需打开任何浏览器；内嵌应用仅
//       作为无头创作引擎（其网页界面为可选的图形化编辑入口，不作为使用前提）。
//
// 【强制引导约定（本插件的调用逻辑核心）】
//   无论用户输入多少内容——哪怕只有一句点子、一段话——都必须先给出「故事路线 + 大纲思路」
//   候选（novel_forge_route_plan），逐条完整展示给用户请其选择（可自定义、也可授权 AI 选定），
//   用 novel_forge_choose_route 写入选定路线后，才允许生成大纲。
//   未选定路线时：novel_forge_develop_project(stage=outline) 与 novel_forge_chain(mode=full)
//   一律返回 NEED_ROUTE 拒绝执行（只有用户明确要求“跳过引导”才能用 allowUnrouted=true）。
//   大纲提示词会自动注入选定路线（引擎 {{routeText}}），从而保证全书方向统一、不散乱。
//
// 依赖：tools（宿主工具服务）与 novelForge（本包 index.js 提供的生命周期服务）。
// 零第三方依赖：仅用 node fetch 调用本机引擎服务。

export const name = 'novel-forge-tools';
export const inject = ['tools', 'novelForge'];

// ---------------- 小工具 ----------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(base, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  if (!res.ok) {
    const msg = (json && (json.error || (json.detail && json.detail.error))) || (`HTTP ${res.status}: ${text}`.slice(0, 300));
    return { ok: false, status: res.status, json, error: String(msg).slice(0, 2000) };
  }
  return { ok: true, json, text };
}

async function withService(ctx) {
  const nf = ctx.novelForge;
  if (!nf) return { error: 'novelForge 服务未注册' };
  if (nf.status !== 'running') {
    try { await nf.start(); } catch (e) { return { error: 'NovelForge 启动失败：' + (e && e.message || e) }; }
  }
  if (!nf.url) return { error: 'NovelForge 未就绪（无地址）' };
  return { url: nf.url };
}

/** 执行一次生成动作并应用（gen + apply）。needRowId 时为大纲行 id。 */
async function runGen(ctx, action, args = {}, opts = {}) {
  const svc = await withService(ctx);
  if (svc.error) return { ok: false, error: svc.error };
  const g = await http(svc.url, 'POST', '/api/gen', { projectId: opts.projectId, action, args, stream: false });
  if (!g.ok) {
    const code = g.status === 409 ? 'NEED_CONFIRM' : 'GEN_FAILED';
    return { ok: false, code, error: g.error, projectId: opts.projectId, action };
  }
  const entry = g.json.result;
  const a = await http(svc.url, 'POST', '/api/apply', {
    projectId: opts.projectId,
    resultId: entry.id,
    rowId: opts.rowId || undefined,
  });
  if (!a.ok) return { ok: false, code: 'APPLY_FAILED', error: a.error };
  return { ok: true, applied: a.json.applied || '已应用', entryKind: entry.kind, action };
}

async function readProject(ctx, projectId) {
  const svc = await withService(ctx);
  if (svc.error) return null;
  const r = await http(svc.url, 'GET', '/api/projects/' + encodeURIComponent(projectId));
  return r.ok ? r.json.project : null;
}

function projectBrief(p) {
  const rows = p.rows || [];
  const routes = routeState(p);
  return {
    id: p.id,
    name: p.name,
    stage: (p.idea && p.idea.title && p.idea.premise ? '已立项' : '灵感阶段'),
    title: (p.idea || {}).title || '',
    characters: (p.characters || []).length,
    chapters: rows.length,
    written: rows.filter((r) => r.ch && r.ch.content).length,
    route: routes.selected
      ? '已选定：' + (routes.selected.name || '未命名') + (routes.selected.mode === 'delegate' ? '（用户授权 AI 选定）' : routes.selected.mode === 'custom' ? '（用户自定义）' : '')
      : (routes.candidates.length ? '有 ' + routes.candidates.length + ' 条候选，尚未选定（禁止生成大纲）' : '未产出路线候选（生成大纲前必须先做）'),
    url: null,
  };
}

function outlineView(rows, withPlan) {
  return (rows || []).map((r) => ({
    no: r.no,
    vol: r.vol,
    title: r.title || '',
    status: r.ch && r.ch.content ? '已写' + (r.ch.words || 0) + '字' : '待写',
    ...(withPlan ? { goal: r.goal || '', pov: r.pov || '' } : {}),
  }));
}

// ---------------- 故事路线（大纲思路）强制引导 ----------------
// 约定：任何点子（哪怕只有一段话）在生成大纲之前，必须先产出「故事路线 + 大纲思路」候选，
//       由用户选定（或明确授权 AI 选定）后才允许生成大纲/正文，避免大纲散乱。

function routeState(p) {
  const r = (p && p.routes) || {};
  return {
    candidates: Array.isArray(r.candidates) ? r.candidates : [],
    selected: r.selected || null,
  };
}

/** 单条路线的会话视图（完整内容，供模型原样展示给用户）。 */
function routeView(r) {
  if (!r) return null;
  return {
    name: r.name || '',
    recommended: !!r.recommended,
    approach: r.approach || '',
    structure: (Array.isArray(r.structure) ? r.structure : []).map((s) => ({
      phase: s.phase || '', span: s.span || '', goal: s.goal || '', turn: s.turn || '',
    })),
    coreConflict: r.coreConflict || '',
    ending: r.ending || '',
    tone: r.tone || '',
    hooks: Array.isArray(r.hooks) ? r.hooks : [],
    risk: r.risk || '',
    custom: r.custom || '',
    mode: r.mode || '',
    chosenAt: r.chosenAt || '',
  };
}

function routeListView(routes) {
  return (routes.candidates || []).map((c, i) => Object.assign({ index: i }, routeView(c)));
}

/** 未选定路线时的统一拒绝载荷（调用方据此引导用户做选择）。 */
function routeGate(p) {
  const st = routeState(p);
  if (st.selected) return null;
  const n = st.candidates.length;
  return {
    code: 'NEED_ROUTE',
    error: '尚未选定故事路线：生成大纲前必须先给出「故事路线 + 大纲思路」候选并请用户选定（否则大纲会散乱、前后失焦）。',
    routeCandidates: n,
    next: n
      ? '已有 ' + n + ' 条候选：请把它们完整展示给用户，请其选编号；随后调用 novel_forge_choose_route（index / custom / delegate）。'
      : '先调用 novel_forge_route_plan 产出候选（哪怕用户只给了一段话也要做）→ 展示给用户 → novel_forge_choose_route 写入选定路线。',
    override: '仅当用户明确要求“跳过路线引导、直接出大纲”时，才可用 allowUnrouted=true 重试（返回会标注未经路线引导）。',
  };
}

/** 校验/裁剪模型自产或用户手写的路线候选（引擎不可用时的兜底通道）。 */
function normalizeRoutesInput(list) {
  return (Array.isArray(list) ? list : []).slice(0, 6).map((r) => ({
    name: String((r && (r.name || r.title)) || '未命名路线').slice(0, 60),
    approach: String((r && (r.approach || r.idea || r.summary)) || '').slice(0, 2400),
    structure: (Array.isArray(r && r.structure) ? r.structure : []).slice(0, 8).map((s) => ({
      phase: String((s && (s.phase || s.title)) || '').slice(0, 60),
      span: String((s && s.span) || '').slice(0, 60),
      goal: String((s && s.goal) || '').slice(0, 600),
      turn: String((s && (s.turn || s.hook)) || '').slice(0, 600),
    })).filter((s) => s.phase || s.goal),
    coreConflict: String((r && r.coreConflict) || '').slice(0, 1200),
    ending: String((r && r.ending) || '').slice(0, 900),
    tone: String((r && r.tone) || '').slice(0, 400),
    hooks: (Array.isArray(r && r.hooks) ? r.hooks : []).slice(0, 8).map((h) => String(h).slice(0, 300)).filter(Boolean),
    risk: String((r && r.risk) || '').slice(0, 900),
    recommended: !!(r && r.recommended),
  })).filter((r) => r.name || r.approach);
}

/** 写入点子卡（保留未知字段，避免覆盖已有数据）。 */
async function putIdea(cx, projectId, patch) {
  const p = await readProject(cx, projectId);
  if (!p) return { ok: false, error: '项目不存在：' + projectId };
  const old = p.idea || {};
  const value = Object.assign({}, old, {
    genres: Array.isArray(patch.genres) && patch.genres.length ? patch.genres.slice(0, 3) : (old.genres || []),
    targetWords: Math.max(0, Number(patch.targetWords) || old.targetWords || 100000),
  }, patch);
  const svc = await withService(cx);
  if (svc.error) return { ok: false, error: svc.error };
  const r = await http(svc.url, 'PUT', `/api/projects/${encodeURIComponent(projectId)}/doc`, { pointer: 'idea', value });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, idea: r.json.project && r.json.project.idea };
}

/** 写入故事路线文档（候选池 + 选定项）。 */
async function putRoutes(cx, projectId, value) {
  const svc = await withService(cx);
  if (svc.error) return { ok: false, error: svc.error };
  const r = await http(svc.url, 'PUT', `/api/projects/${encodeURIComponent(projectId)}/doc`, { pointer: 'routes', value });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, routes: (r.json.project && r.json.project.routes) || value };
}

/** 当前项目实际会用到的引擎厂商（判断是否只是离线模拟引擎，决定路线候选由谁产出）。 */
async function engineProviderInfo(cx, projectId) {
  const svc = await withService(cx);
  if (svc.error) return { kind: '', id: '', error: svc.error };
  const s = await http(svc.url, 'GET', '/api/settings');
  const p = await readProject(cx, projectId);
  const globalDefault = (s.ok && s.json.settings && s.json.settings.defaults && s.json.settings.defaults.providerId) || '';
  const projDefault = (p && p.settings && p.settings.providerId) || '';
  const id = projDefault || globalDefault;
  const list = (s.ok && s.json.settings && s.json.settings.providers) || [];
  const prov = list.find((x) => x.id === id) || null;
  const enabledReal = list.filter((x) => x.enabled !== false && x.kind && x.kind !== 'mock');
  return {
    id,
    kind: prov ? (prov.kind || 'openai') : '',
    realProvidersEnabled: enabledReal.map((x) => x.id),
  };
}

/** 会话模型自产路线候选的字段说明（引擎不可用/模拟引擎时使用，保证引导质量）。 */
function routeAuthoringBrief() {
  return {
    fields: {
      name: '路线名（14字内，点明结构与卖点）',
      approach: '大纲思路（180~280字）：整体结构（几幕/几卷）、主线副线咬合方式、节奏与信息释放、视角策略',
      structure: '阶段路线数组 3~5 项：[{phase: 阶段/卷名, span: 覆盖区间如「第1~8章」, goal: 该阶段要完成什么, turn: 阶段末转折或钩子}]',
      coreConflict: '主线冲突与升级路径（80~150字）：冲突如何一次比一次代价更高',
      ending: '结局走向与情绪落点（60~120字）',
      tone: '基调与视角方案（40字内）',
      hooks: '贯穿全书的伏笔/悬念引擎 2~4 条',
      risk: '取舍与风险（60~120字）：放弃了什么、适合什么读者、写作难点',
      recommended: '布尔值；恰好一条为 true，并在其 risk 末尾写明推荐理由',
    },
    rules: [
      '路线之间必须在结构与结局走向上真正分岔（禁止换皮同一条）',
      '必须给出 3~5 个阶段，span 用章节区间表示，便于直接生成分卷大纲',
      '禁止"主角历经磨难最终成长"之类空话，每条都要可写、可检验',
    ],
  };
}

// ---------------- 能力工作台 helpers（content/doc/email） ----------------

function capBrief(p) {
  const ws = p.workspace || {};
  const src = (ws.source && ws.source[0]) || {};
  return {
    id: p.id, name: p.name, cap: p.cap || 'text',
    language: p.language || '',
    sourceTitle: src.title || '',
    sourceChars: (src.text || '').length,
    outputs: (ws.outputs || []).length,
  };
}

/** 读取非 novel 能力项目的源文本/参数/输出（并补全默认外壳）。 */
function readCap(cx, projectId) {
  return readProject(cx, projectId).then((p) => {
    if (!p) return null;
    p.workspace = p.workspace || { kind: p.cap || 'text', source: [{ id: 's_', title: '', text: '', lang: '', meta: {} }], params: {}, outputs: [] };
    if (!p.workspace.source || !p.workspace.source.length) p.workspace.source = [{ id: 's_', title: '', text: '', lang: '', meta: {} }];
    if (!Array.isArray(p.workspace.outputs)) p.workspace.outputs = [];
    return p;
  });
}

async function capGen(ctx, action, args, projectId) {
  const svc = await withService(ctx);
  if (svc.error) return { ok: false, error: svc.error };
  const g = await http(svc.url, 'POST', '/api/gen', { projectId, action, args, stream: false });
  if (!g.ok) {
    const code = g.status === 409 ? 'NEED_CONFIRM' : 'GEN_FAILED';
    return { ok: false, code, error: g.error, projectId, action };
  }
  const entry = g.json.result;
  const a = await http(svc.url, 'POST', '/api/apply', { projectId, resultId: entry.id });
  if (!a.ok) return { ok: false, code: 'APPLY_FAILED', error: a.error };
  return { ok: true, applied: a.json.applied || '已应用', entryKind: entry.kind, action, entry };
}

function outputView(latest) {
  return (latest || []).map((o, i) => ({
    n: i + 1, cap: o.cap, action: o.action, label: o.label, chars: (o.content || '').length,
    preview: (o.content || '').slice(0, 220) + ((o.content || '').length > 220 ? '…' : ''),
    full: o.content,
  }));
}

const CAP_ACTIONS = {
  analyze: 'content_analyze', imitate: 'content_imitate', continue: 'content_continue',
  rewrite: 'content_rewrite', doc: 'doc_resolution', email: 'email_cold',
};

// ---------------- 工具定义 ----------------
const defs = [
  {
    name: 'novel_forge_status',
    description:
      'NovelForge（AI 小说创作工坊）状态查询：当前服务地址、是否就绪、已有项目清单（含每个项目的故事路线选定状态）。' +
      '当用户想写小说/长文创作时，可先调用本工具确认服务可用并选择/创建项目；' +
      '若项目显示路线未选定，先走 novel_forge_route_plan → 用户选择 → novel_forge_choose_route。',
    parameters: { type: 'object', properties: {} },
    async execute(args, cx) {
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const r = await http(svc.url, 'GET', '/api/projects');
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, url: svc.url, projects: r.json.projects.map((x) => ({ id: x.id, name: x.name, demo: !!x.demo, written: x.counts && x.counts.written, chapters: x.counts && x.counts.chapters, route: x.route && x.route.selected ? '已选定：' + x.route.selected : '未选定（生成大纲前必须做路线引导）' })) };
    },
  },
  {
    name: 'novel_forge_new_project',
    description: '在 NovelForge 中新建一部作品（项目），返回其 id 供后续工具使用。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '作品暂定名/项目名（必填，如《雾中来信》）' },
        desc: { type: 'string', description: '一句话简介（可选）' },
      },
      required: ['title'],
    },
    async execute(args, cx) {
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const r = await http(svc.url, 'POST', '/api/projects', { name: String(args.title || '').trim() || '未命名新书', desc: String(args.desc || '').trim() });
      if (!r.ok) return { ok: false, error: r.error };
      const p = r.json.project;
      return { ok: true, projectId: p.id, project: projectBrief(p), next: '强制流程：novel_forge_seed_idea 写入点子（哪怕只有一段话）→ novel_forge_route_plan 产出故事路线/大纲思路候选 → 请用户选定 → novel_forge_choose_route → 再 develop（flesh/world/characters/outline）' };
    },
  },
  {
    name: 'novel_forge_seed_idea',
    description:
      '把用户的小说点子写入指定项目的创意卡（可随后 develop 深化）。' +
      '用户说出点子时优先用本工具保存原话要点，再决定是否让 AI 深化。' +
      '【强制】写完后必须接着做故事路线引导：调用 novel_forge_route_plan 产出 2~5 条「故事路线 + 大纲思路」候选并请用户选定——' +
      '哪怕用户只给了一句话或一段话也要给选项，不许直接跳到设定/大纲。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id（来自 new_project / projects / status）' },
        title: { type: 'string', description: '暂定书名' },
        genres: { type: 'array', items: { type: 'string' }, description: '类型标签，如 ["悬疑","奇幻"]' },
        logline: { type: 'string', description: '一句话故事（主角+目标+阻碍）' },
        premise: { type: 'string', description: '故事背景/设定描述（尽量保留用户原话）' },
        tone: { type: 'string', description: '基调或补充（可选）' },
        targetWords: { type: 'integer', description: '目标总字数（可选，默认 10 万）' },
      },
      required: ['projectId'],
    },
    async execute(args, cx) {
      const p = await readProject(cx.ctx, args.projectId);
      if (!p) return { ok: false, error: '项目不存在：' + args.projectId };
      const old = p.idea || {};
      const value = Object.assign({}, old, {
        title: args.title ?? old.title ?? '',
        genres: Array.isArray(args.genres) ? args.genres.slice(0, 3) : (old.genres || []),
        targetWords: Math.max(0, Number(args.targetWords) || old.targetWords || 100000),
        logline: args.logline ?? old.logline ?? '',
        premise: args.premise ?? old.premise ?? '',
        tone: args.tone ?? old.tone ?? '',
      });
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const r = await http(svc.url, 'PUT', `/api/projects/${encodeURIComponent(args.projectId)}/doc`, { pointer: 'idea', value });
      if (!r.ok) return { ok: false, error: r.error };
      const st = routeState(r.json.project || p);
      return {
        ok: true,
        projectId: args.projectId,
        saved: { title: value.title, genres: value.genres, targetWords: value.targetWords },
        routeSelected: st.selected ? st.selected.name : null,
        next: st.selected
          ? '路线已选定（' + st.selected.name + '）：可继续 novel_forge_develop_project（flesh/world/characters/outline）'
          : '【下一步必做】novel_forge_route_plan：产出故事路线与大纲思路候选，逐条展示给用户请其选定，再用 novel_forge_choose_route 写入（未选定前无法生成大纲）。',
      };
    },
  },
  {
    name: 'novel_forge_ideate',
    description:
      '让 AI 为创作方向头脑风暴出一批小说点子候选（默认 8 个，含 书名/类型/一句话钩子/概念）。' +
      '不直接写入项目；用户选定后用 novel_forge_seed_idea 采纳。当用户还没有成型点子时使用。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '可选：已有项目 id（点子会挂到其点子池）' },
        genreHint: { type: 'string', description: '题材/方向提示，如 “悬疑+赛博朋克” 或 “校园成长”' },
        instruction: { type: 'string', description: '额外要求（可选）' },
        count: { type: 'integer', description: '候选数量，默认 8' },
      },
    },
    async execute(args, cx) {
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const g = await http(svc.url, 'POST', '/api/gen', {
        projectId: args.projectId || null,
        action: 'idea_brainstorm',
        args: { count: Math.min(10, Math.max(3, Number(args.count) || 8)) },
        stream: false,
      });
      if (!g.ok) return { ok: false, error: g.error };
      // 仅预览候选（不 apply，候选由用户选）
      const candidates = (g.json.result.payload || []).map((c, i) => ({ index: i, title: c.title, genre: c.genre, logline: c.logline, concept: c.concept }));
      let applied = false;
      let projectId = args.projectId;
      if (args.projectId) {
        const a = await http(svc.url, 'POST', '/api/apply', { projectId: args.projectId, resultId: g.json.result.id });
        applied = a.ok;
      }
      return {
        ok: true,
        candidates,
        note: '请向用户展示候选并请其选择；用户选定后用 novel_forge_seed_idea 写入，随后**必须**做故事路线引导：novel_forge_route_plan → 用户选定 → novel_forge_choose_route',
        ...(args.projectId ? { projectId, candidatesSavedToPool: applied } : {}),
      };
    },
  },
  {
    name: 'novel_forge_route_plan',
    description:
      '【强制引导环节 · 生成大纲前必做】为用户点子产出 2~5 条互不相同的「故事路线 + 大纲思路」候选：' +
      '每条含 大纲思路（整体结构/节奏/视角）、阶段路线（3~5 个阶段，含章节区间与阶段末转折）、主线冲突升级路径、结局走向、' +
      '贯穿伏笔、取舍与风险，并标出 AI 推荐项。' +
      '规则（硬性）：① 哪怕用户只给了一段话、一个点子，也必须先调用本工具再谈大纲；' +
      '② 调用后必须把候选**逐条完整**展示给用户（路线名/思路/阶段/冲突/结局/风险/推荐），请其选择编号或提出自己的路线，不得替用户拍板；' +
      '③ 未选定路线时 novel_forge_develop_project(stage=outline) 与 novel_forge_chain(mode=full) 会被拒绝（NEED_ROUTE）。' +
      '返回的 routes 数组要原样转述给用户；用户选好后调用 novel_forge_choose_route。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id（不存在时先用 novel_forge_new_project 建项目）' },
        paragraph: { type: 'string', description: '用户给的点子原话/段落（可选；会先写入创意卡，尽量保留原话）' },
        count: { type: 'integer', description: '候选数量，默认 3（2~5）' },
        instruction: { type: 'string', description: '额外要求（可选，如“要冷硬派／双主角／别写穿越”）' },
        autoFlesh: { type: 'boolean', description: '立项书还太薄时是否先自动深化（默认 true，保证路线有抓手）' },
        source: { type: 'string', enum: ['auto', 'engine', 'session'], description: '候选由谁产出：auto=引擎有真实模型则用引擎，否则由你自己产出（默认）；engine=强制引擎；session=强制你自己产出' },
      },
      required: ['projectId'],
    },
    async execute(args, cx) {
      const projectId = String(args.projectId || '');
      let p = await readProject(cx.ctx, projectId);
      if (!p) return { ok: false, error: '项目不存在：' + projectId };

      // ① 用户哪怕只给了一段话，也先落进创意卡（保留原话，不丢失）
      let seeded = false;
      if (args.paragraph && String(args.paragraph).trim()) {
        const para = String(args.paragraph).trim();
        const old = p.idea || {};
        const w = await putIdea(cx.ctx, projectId, {
          title: old.title || '',
          premise: old.premise ? old.premise : para,
          logline: old.logline || '',
          extra: old.premise ? [old.extra, para].filter(Boolean).join('\n') : (old.extra || ''),
        });
        if (!w.ok) return { ok: false, code: 'SEED_FAILED', error: w.error };
        seeded = true;
        p = await readProject(cx.ctx, projectId);
      }

      // ② 立项书过薄 → 先深化，路线才有抓手
      const idea = p.idea || {};
      const thin = !(idea.premise && idea.logline);
      let fleshed = false;
      if (args.autoFlesh !== false && thin) {
        const f = await runGen(cx.ctx, 'idea_flesh', {}, { projectId });
        if (f.ok) { fleshed = true; p = await readProject(cx.ctx, projectId); }
      }

      // ③ 判断候选来源：引擎只有离线模拟引擎时，改由会话模型自己产出（否则路线只是占位符，等于没引导）
      const wantSource = String(args.source || 'auto');
      let useEngine = wantSource === 'engine';
      let providerInfo = null;
      if (wantSource !== 'session') {
        providerInfo = await engineProviderInfo(cx.ctx, projectId);
        if (wantSource === 'auto') useEngine = providerInfo.kind !== 'mock';
      }
      if (!useEngine) {
        const ideaNow = p.idea || {};
        return {
          ok: true,
          mode: 'session',
          projectId,
          seededParagraph: seeded,
          fleshed,
          provider: providerInfo ? { id: providerInfo.id, kind: providerInfo.kind, realProvidersEnabled: providerInfo.realProvidersEnabled } : null,
          why: wantSource === 'session'
            ? '已指定由会话模型产出路线候选。'
            : '引擎当前用的是离线模拟引擎（未配置真实模型），引擎产出只是占位文本，因此改由你自己产出路线候选。'
              + (providerInfo && providerInfo.realProvidersEnabled && providerInfo.realProvidersEnabled.length
                ? '（提示：引擎里已启用这些真实厂商 ' + providerInfo.realProvidersEnabled.join('/') + '，可在设置里把默认厂商切过去，下次即可由引擎生成。）'
                : '（可在设置中接入真实模型厂商后，路线候选改由引擎生成。）'),
          authoring: routeAuthoringBrief(),
          projectBrief: projectBrief(p),
          ideaNow: { title: ideaNow.title || '', genres: ideaNow.genres || [], logline: ideaNow.logline || '', premise: ideaNow.premise || '' },
          mustChoose: true,
          blockedUntil: '用户选定路线前：不得生成大纲、不得写正文、不得启动 novel_forge_chain(mode=full)',
          instruction: '【必须】你现在就要产出 ' + Math.min(5, Math.max(2, Number(args.count) || 3)) + ' 条互不相同的「故事路线 + 大纲思路」候选：' +
            '按 authoring.fields 的字段写好每条路线（name/approach/structure/coreConflict/ending/tone/hooks/risk/recommended），' +
            '逐条完整展示给用户（不要只给路线名），并请用户回复编号、提出自己的路线、或明确说"你来定"。' +
            '收到答复后调用 novel_forge_choose_route：把 routes=[这批候选] 一起传入，并带 index（用户选的编号）/ custom（用户自己的路线）/ delegate（用户明确授权你选定）。',
          next: 'novel_forge_choose_route（带上 routes 数组 + index/custom/delegate）',
        };
      }

      // ④ 引擎生成路线候选并入库（只入候选池，不替用户选定）
      const g = await runGen(cx.ctx, 'route_plan', {
        count: Math.min(5, Math.max(2, Number(args.count) || 3)),
        instruction: args.instruction ? String(args.instruction) : undefined,
      }, { projectId });
      if (!g.ok) {
        return {
          ok: false, code: g.code || 'GEN_FAILED', error: g.error, projectId,
          fallback: '引擎生成失败：请你自己按 authoring 的字段产出 2~5 条互不相同的路线候选，逐条完整展示给用户请其选择，' +
            '然后调用 novel_forge_choose_route 时用 routes 参数传入这批候选 + index（或 custom / delegate）。',
          authoring: routeAuthoringBrief(),
          mustChoose: true,
        };
      }
      const after = await readProject(cx.ctx, projectId);
      const st = routeState(after);
      return {
        ok: true,
        mode: 'engine',
        projectId,
        seededParagraph: seeded,
        fleshed,
        routes: routeListView(st),
        candidatesSaved: st.candidates.length,
        mustChoose: true,
        blockedUntil: '用户选定路线前：不得生成大纲、不得写正文、不得启动 novel_forge_chain(mode=full)',
        askUser: '【必须】把上面每条路线完整展示给用户（路线名 / 大纲思路 / 阶段路线 / 主线冲突 / 结局走向 / 风险与取舍 / AI 推荐），' +
          '请用户回复编号（或提出自己的路线、或明确说“你来定”），收到答复后再调用 novel_forge_choose_route。',
        next: 'novel_forge_choose_route（index=用户选的编号 / custom=用户自己的路线 / delegate=用户明确授权 AI 选定）',
      };
    },
  },
  {
    name: 'novel_forge_choose_route',
    description:
      '把「用户选定的故事路线」写入项目（候选池 + 选定项），解锁大纲生成。三选一：' +
      'index=用户从候选里选的编号；custom=用户自己口述的路线（原话尽量保留）；delegate=用户明确授权 AI 选定（如“你来定/随便挑一条”）。' +
      '可同时传 routes 数组把你自己产出的候选入库（引擎不可用或引擎只有离线模拟引擎时的正规通道）。' +
      '调用前必须先让用户真的做过选择：delegate 必须同时给出 note（用户授权原话），否则返回 NEED_AUTHORIZATION；不得替用户拍板。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id' },
        index: { type: 'integer', description: '用户选定的候选编号（0 起，见 novel_forge_route_plan 返回的 index）' },
        custom: { type: 'string', description: '用户自己描述的故事路线/大纲思路原话' },
        delegate: { type: 'boolean', description: '用户明确授权 AI 选定（仅在用户说“你来定”时使用，需同时给 note）' },
        routes: { type: 'array', items: { type: 'object' }, description: '可选：候选数组（会话模型自产时必传，字段同 route_plan 的 authoring.fields）' },
        note: { type: 'string', description: 'delegate 时必填：用户授权的原话；其它情况可填用户补充的路线偏好' },
      },
      required: ['projectId'],
    },
    async execute(args, cx) {
      const projectId = String(args.projectId || '');
      const p = await readProject(cx.ctx, projectId);
      if (!p) return { ok: false, error: '项目不存在：' + projectId };
      const st = routeState(p);
      let candidates = st.candidates;
      if (Array.isArray(args.routes) && args.routes.length) {
        const incoming = normalizeRoutesInput(args.routes);
        if (incoming.length) candidates = incoming;
      }
      let selected = null;
      if (args.index != null && args.index !== '') {
        const i = Number(args.index);
        const c = candidates[i];
        if (!c) return { ok: false, code: 'INDEX_OUT_OF_RANGE', error: `找不到第 ${args.index} 条候选（共 ${candidates.length} 条）`, candidates: routeListView({ candidates }) };
        selected = Object.assign({}, c, { mode: 'user' });
      } else if (args.custom && String(args.custom).trim()) {
        selected = { name: String(args.name || '用户自定义路线').slice(0, 60), approach: String(args.custom).trim().slice(0, 2400), custom: String(args.custom).trim().slice(0, 2400), structure: [], hooks: [], mode: 'custom' };
      } else if (args.delegate) {
        if (!args.note || !String(args.note).trim()) {
          return {
            ok: false, code: 'NEED_AUTHORIZATION',
            error: 'delegate=true 需要 note 填用户授权原话（例如“你来定”“随便挑一条”）。用户没有明确授权时，请先把路线候选展示给用户并等其选择（index / custom）。',
            candidates: routeListView({ candidates }),
          };
        }
        const c = candidates.find((x) => x.recommended) || candidates[0];
        if (!c) return { ok: false, code: 'NEED_ROUTE_PLAN', error: '还没有任何路线候选：请先调用 novel_forge_route_plan（或在本工具用 routes 参数传入候选）' };
        selected = Object.assign({}, c, { mode: 'delegate' });
      } else {
        return {
          ok: false, code: 'NEED_CHOICE',
          error: '缺少选择：请传 index（用户选的编号）、custom（用户自己的路线）或 delegate（用户明确授权 AI 选定）之一；用户没有表态时不得替他决定。',
          candidates: routeListView({ candidates }),
        };
      }
      if (args.note) selected.note = String(args.note).slice(0, 600);
      if (!selected.recommended && selected.mode === 'delegate') selected.recommended = true;
      const chosenAt = new Date().toISOString();
      selected.chosenAt = chosenAt;
      const w = await putRoutes(cx.ctx, projectId, { candidates, selected, updatedAt: chosenAt });
      if (!w.ok) return { ok: false, code: 'SAVE_FAILED', error: w.error };
      return {
        ok: true,
        projectId,
        selected: routeView(selected),
        candidates: candidates.length,
        next: 'novel_forge_develop_project(stage=outline)：大纲会严格按这条路线生成（路线已注入大纲提示词，不会跑偏）',
        note: selected.mode === 'delegate' ? '已记录：路线由 AI 依据用户授权选定；用户可在随后的对话中改选（重新调用本工具即可）。' : '路线已选定；若要改选，重新调用本工具或再跑一次 novel_forge_route_plan。',
      };
    },
  },
  {
    name: 'novel_forge_develop_project',
    description:
      '推进指定项目的创作阶段并应用结果：flesh=深化立项书；world=世界观设定集；' +
      'characters=人物群像；outline=全书卷章大纲；audit=全文一致性审查。' +
      '阶段会依序补齐（如先 outline 会自动先生成缺失的 bible/characters）。' +
      '【强制】outline 阶段要求项目已选定故事路线：未选定会返回 NEED_ROUTE，正确顺序是 ' +
      'novel_forge_route_plan（产出路线/大纲思路候选）→ 让用户选择 → novel_forge_choose_route → 再调用本工具；' +
      '大纲生成时会自动注入已选路线，保证全书不散乱。' +
      '若目标阶段已有内容且 overwrite=false，会返回 NEED_CONFIRM，请先征得用户同意（overwrite=true）再重试。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id' },
        stage: { type: 'string', enum: ['flesh', 'world', 'characters', 'outline', 'audit'], description: '要推进的阶段' },
        count: { type: 'integer', description: 'characters 阶段的人物数量（默认 10）' },
        instruction: { type: 'string', description: '附加要求（可选，会传入 AI 提示词）' },
        overwrite: { type: 'boolean', description: '目标阶段已有内容时是否覆盖（默认 false，覆盖有风险需用户确认）' },
        allowUnrouted: { type: 'boolean', description: '仅当用户明确要求“跳过路线引导、直接出大纲”时才可传 true（会标注未经路线引导）' },
      },
      required: ['projectId', 'stage'],
    },
    async execute(args, cx) {
      const projectId = String(args.projectId);
      const stage = String(args.stage || '');
      const map = { flesh: 'idea_flesh', world: 'bible_generate', characters: 'characters_generate', outline: 'outline_generate', audit: 'audit_book' };
      const action = map[stage];
      if (!action) return { ok: false, error: '未知 stage：' + stage + '（可用 flesh/world/characters/outline/audit）' };
      const project = await readProject(cx.ctx, projectId);
      if (!project) return { ok: false, error: '项目不存在：' + projectId };
      // 【强制门禁】大纲阶段必须先选定故事路线（除非用户明确要求跳过）
      let guidanceHint = '';
      const gate = routeGate(project);
      if (stage === 'outline' && gate && !args.allowUnrouted) return Object.assign({ ok: false, projectId, stage }, gate);
      if (stage !== 'outline' && gate) {
        // 其余阶段放行，但提示路线引导尚未完成（大纲阶段会被拦下）
        guidanceHint = gate.routeCandidates
          ? '提醒：本项目尚未选定故事路线，已有 ' + gate.routeCandidates + ' 条候选待用户选择 → 调用 novel_forge_choose_route。'
          : '提醒：本项目尚未产出故事路线候选，请尽早调用 novel_forge_route_plan 并请用户选定（大纲阶段会强制要求）。';
      }
      const unguided = stage === 'outline' && gate && args.allowUnrouted;
      // 依序补缺：flesh 前置为 seed 的创意；world/characters/outline 若空会自动生成链在 outline 阶段缺省? 保持显式：
      const argsBase = { instruction: args.instruction ? String(args.instruction) : undefined };
      if (action === 'characters_generate') argsBase.count = Math.min(18, Math.max(4, Number(args.count) || 10));
      const g = await runGen(cx.ctx, action, { ...argsBase, ...(args.overwrite ? { force: true } : {}) }, { projectId });
      if (!g.ok) return g;
      const after = await readProject(cx.ctx, projectId);
      const routeNow = routeState(after);
      return {
        ok: true,
        applied: g.applied,
        project: projectBrief(after),
        ...(stage === 'outline' ? {
          route: routeNow.selected ? { name: routeNow.selected.name, mode: routeNow.selected.mode } : null,
          routeGuided: !!(routeNow.selected && routeNow.selected.mode !== 'auto'),
          ...(unguided ? { warning: '本次大纲未经用户选定路线（allowUnrouted=true）：建议补做路线引导，或先用 novel_forge_route_plan → novel_forge_choose_route 后重新生成大纲。' } : {}),
        } : {}),
        ...(guidanceHint ? { guidance: guidanceHint } : {}),
        detail: stage === 'world' ? { sections: (after.bible.sections || []).length, rules: (after.bible.rules || []).length }
          : stage === 'characters' ? { characters: (after.characters || []).length }
          : stage === 'outline' ? { chapters: (after.rows || []).length, volumes: (after.volumes || []).length }
          : stage === 'audit' ? { issues: ((after.audits || {}).items || []).length }
          : { title: after.idea && after.idea.title },
        next: stage === 'flesh' ? 'novel_forge_route_plan（故事路线/大纲思路候选）→ 用户选择 → novel_forge_choose_route → 再跑 world/characters/outline'
          : stage === 'outline' ? 'novel_forge_read_project(section=outline) 复核大纲是否贴合路线，再 novel_forge_write_chapter 开写'
          : '继续下一阶段或 novel_forge_read_project 查看',
      };
    },
  },
  {
    name: 'novel_forge_read_project',
    description:
      '读取项目当前状态/内容：summary=进度概览；outline=章节清单与已写状态；idea=创意卡；' +
      'routes=故事路线候选与已选定路线（生成大纲前必须确认这里已选定）；' +
      'characters=人物名册；chapter=某一章正文（配合 chapterNo，最多返回前 10000 字，供会话内审读/接续）。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id' },
        section: { type: 'string', enum: ['summary', 'outline', 'idea', 'routes', 'characters', 'chapter'], description: '默认 summary' },
        chapterNo: { type: 'integer', description: 'section=chapter 时指定章号' },
      },
      required: ['projectId'],
    },
    async execute(args, cx) {
      const p = await readProject(cx.ctx, args.projectId);
      if (!p) return { ok: false, error: '项目不存在：' + args.projectId };
      const s = args.section || 'summary';
      if (s === 'outline') return { ok: true, chapters: outlineView(p.rows, true) };
      if (s === 'idea') return { ok: true, idea: { title: p.idea.title, genres: p.idea.genres, logline: p.idea.logline, premise: p.idea.premise, hook: p.idea.hook, conflict: p.idea.conflict, pov: p.idea.pov, tone: p.idea.tone } };
      if (s === 'routes') {
        const st = routeState(p);
        return {
          ok: true,
          selected: routeView(st.selected),
          candidates: routeListView(st),
          ready: !!st.selected,
          note: st.selected
            ? '路线已选定：可生成大纲（大纲会自动遵循该路线）'
            : '尚未选定路线：请展示候选并请用户选择，再用 novel_forge_choose_route 写入；未选定前 novel_forge_develop_project(stage=outline) 会被拒绝。',
        };
      }
      if (s === 'characters') return { ok: true, characters: (p.characters || []).map((c) => ({ name: c.name, role: c.role, oneLine: c.oneLine })) };
      if (s === 'chapter') {
        const no = Number(args.chapterNo);
        const row = (p.rows || []).find((r) => r.no === no);
        if (!row) return { ok: false, error: '找不到第 ' + no + ' 章（大纲共 ' + (p.rows || []).length + ' 章）' };
        const content = (row.ch && row.ch.content) || '';
        if (!content) return { ok: true, chapterNo: no, title: row.title, written: false };
        const limit = 10000;
        return {
          ok: true,
          chapterNo: no,
          title: row.title,
          written: true,
          words: row.ch.words || 0,
          content: content.slice(0, limit) + (content.length > limit ? '\n…（正文较长已截断，共 ' + content.length + ' 字）' : ''),
        };
      }
      return { ok: true, project: projectBrief(p) };
    },
  },
  {
    name: 'novel_forge_write_chapter',
    description:
      '撰写指定项目第 N 章的正文并自动归档记忆（摘要+事实+伏笔）。先有 outline 阶段的大纲行。' +
      '写作会遵循项目世界观铁律、文风与连续性档案。写完后模型应继续调用它写完后续章节，或询问用户下一步。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id' },
        chapterNo: { type: 'integer', description: '第几章（按大纲章号）' },
        instruction: { type: 'string', description: '本章额外指令（可选）：视角/情绪/剧情侧重' },
      },
      required: ['projectId', 'chapterNo'],
    },
    async execute(args, cx) {
      const projectId = String(args.projectId);
      const no = Number(args.chapterNo);
      const p = await readProject(cx.ctx, projectId);
      if (!p) return { ok: false, error: '项目不存在：' + projectId };
      const row = (p.rows || []).find((r) => r.no === no);
      if (!row) return { ok: false, error: '找不到第 ' + no + ' 章（大纲共 ' + (p.rows || []).length + ' 章）' };
      if (row.ch && row.ch.content) {
        return { ok: false, code: 'NEED_CONFIRM', error: `第 ${no} 章已有正文（${row.ch.words || 0} 字）；重写将覆盖原文，请先征得用户同意并提供 instruction 后重试` };
      }
      const w = await runGen(cx.ctx, 'chapter_write', { rowId: row.id, instruction: args.instruction ? String(args.instruction) : undefined }, { projectId, rowId: row.id });
      if (!w.ok) return w;
      const sum = await runGen(cx.ctx, 'chapter_summary', { rowId: row.id }, { projectId, rowId: row.id });
      const after = await readProject(cx.ctx, projectId);
      const wrote = (after.rows || []).find((r) => r.no === no);
      const content = (wrote && wrote.ch && wrote.ch.content) || '';
      return {
        ok: true,
        chapterNo: no,
        title: row.title,
        words: (wrote && wrote.ch && wrote.ch.words) || 0,
        summarySaved: sum.ok,
        preview: content.slice(0, 280) + (content.length > 280 ? '…' : ''),
        next: '继续 novel_forge_write_chapter 写第 ' + (no + 1) + ' 章，或 novel_forge_read_project 查看进度',
      };
    },
  },
  {
    name: 'novel_forge_chain',
    description:
      '无人值守流水线：full=从当前缺口自动补齐 点子→立项→设定→人物→**故事路线**→大纲→逐章连载；' +
      'write=把大纲剩余章节全部自动写完。可长时间运行，会按 timeoutSec 轮询直到完成/出错/超时。' +
      '【强制】mode=full 同样要求已选定故事路线（未选定返回 NEED_ROUTE）：先 novel_forge_route_plan → 用户选择 → novel_forge_choose_route。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id' },
        mode: { type: 'string', enum: ['full', 'write'], description: '默认 full' },
        timeoutSec: { type: 'integer', description: '最长等待秒数（默认 600）' },
        allowUnrouted: { type: 'boolean', description: '仅当用户明确要求“跳过路线引导、直接全自动”时才可传 true' },
      },
      required: ['projectId'],
    },
    async execute(args, cx) {
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const mode = args.mode === 'write' ? 'write' : 'full';
      const projectId = String(args.projectId);
      if (mode === 'full' && !args.allowUnrouted) {
        const p0 = await readProject(cx.ctx, projectId);
        if (!p0) return { ok: false, error: '项目不存在：' + projectId };
        const gate = routeGate(p0);
        if (gate) return Object.assign({ ok: false, projectId, mode }, gate);
      }
      const deadline = Date.now() + (Math.min(1800, Math.max(10, Number(args.timeoutSec) || 600)) * 1000);
      const s = await http(svc.url, 'POST', '/api/pipeline/start', { projectId, mode });
      if (!s.ok) return { ok: false, error: s.error };
      let last = null;
      while (Date.now() < deadline) {
        const st = await http(svc.url, 'GET', '/api/pipeline/status');
        const pl = st.ok ? st.json.pipeline : null;
        if (pl) {
          if (pl.status === 'idle') { if (pl.last) { last = pl.last; if (['done', 'error', 'stopped'].includes(pl.last.status)) break; } }
          else if (['done', 'error', 'stopped'].includes(pl.status)) { last = pl; break; }
          last = pl.status === 'idle' ? last : pl;
        }
        await sleep(2000);
      }
      const after = await readProject(cx.ctx, args.projectId);
      return {
        ok: last && ['done', 'error', 'stopped'].includes(last.status) && last.status !== 'error',
        result: last ? { status: last.status, label: last.label, done: last.done } : { status: 'timeout' },
        ...(last && last.status === 'error' ? { error: last.error } : {}),
        project: projectBrief(after),
        timedOut: !last || !['done', 'error', 'stopped'].includes(last.status),
      };
    },
  },
  {
    name: 'novel_forge_edit_chapter',
    description:
      '对指定项目已写章节做会话内精修：rewrite=按指令整体重写（覆盖原文，可撤销）；polish=保持剧情润色文字；' +
      'continue=从文末续写（保留原文）；summarize=生成/更新该章记忆（摘要+事实+伏笔）。返回改动后的正文预览。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id' },
        chapterNo: { type: 'integer', description: '章号' },
        mode: { type: 'string', enum: ['rewrite', 'polish', 'continue', 'summarize'], description: '精修方式' },
        instruction: { type: 'string', description: 'rewrite/polish/continue 时的指令（如：改用林照影视角 / 删减节奏拖沓段）' },
      },
      required: ['projectId', 'chapterNo', 'mode'],
    },
    async execute(args, cx) {
      const projectId = String(args.projectId);
      const no = Number(args.chapterNo);
      const mode = String(args.mode || '');
      const p = await readProject(cx.ctx, projectId);
      if (!p) return { ok: false, error: '项目不存在：' + projectId };
      const row = (p.rows || []).find((r) => r.no === no);
      if (!row) return { ok: false, error: '找不到第 ' + no + ' 章（大纲共 ' + (p.rows || []).length + ' 章）' };
      if (mode !== 'continue' && mode !== 'summarize' && !(row.ch && row.ch.content)) {
        return { ok: false, error: '该章尚无正文；rewrite/polish 需要先有正文（可用 novel_forge_write_chapter 撰写）' };
      }
      const actionMap = { rewrite: 'chapter_rewrite', polish: 'chapter_polish', continue: 'chapter_continue', summarize: 'chapter_summary' };
      const action = actionMap[mode];
      if (!action) return { ok: false, error: '未知 mode：' + mode };
      const r = await runGen(cx.ctx, action, { rowId: row.id, instruction: args.instruction ? String(args.instruction) : undefined }, { projectId, rowId: row.id });
      if (!r.ok) return r;
      const after = await readProject(cx.ctx, projectId);
      const wrote = (after.rows || []).find((x) => x.no === no);
      const content = (wrote && wrote.ch && wrote.ch.content) || '';
      return {
        ok: true,
        mode,
        applied: r.applied,
        chapterNo: no,
        words: (wrote && wrote.ch && wrote.ch.words) || 0,
        summarySaved: mode === 'summarize' ? true : undefined,
        preview: content.slice(0, 280) + (content.length > 280 ? '…' : ''),
      };
    },
  },
  {
    name: 'novel_forge_extend_outline',
    description:
      '在当前大纲末尾追加 N 章（保留已有章节与正文；新卷自动规划），返回追加后的章号范围。' +
      '用于用户说“继续写下去/多写几章”而大纲已经用完时。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id' },
        count: { type: 'integer', description: '追加章数（1-40，默认 5）' },
        instruction: { type: 'string', description: '后续剧情方向要求（可选）' },
      },
      required: ['projectId'],
    },
    async execute(args, cx) {
      const projectId = String(args.projectId);
      const p = await readProject(cx.ctx, projectId);
      if (!p) return { ok: false, error: '项目不存在：' + projectId };
      const r = await runGen(cx.ctx, 'outline_extend', { count: Math.min(40, Math.max(1, Number(args.count) || 5)), instruction: args.instruction ? String(args.instruction) : undefined }, { projectId });
      if (!r.ok) return r;
      const after = await readProject(cx.ctx, projectId);
      return { ok: true, applied: r.applied, chapters: (after.rows || []).length, next: 'novel_forge_write_chapter 续写新章' };
    },
  },
  {
    name: 'novel_forge_export',
    description:
      '导出项目文本并在会话内直接返回：md=成书 Markdown；manuscript=含设定/人物/大纲/记忆的创作底稿；' +
      'txt=纯正文；json=项目完整备份。全文若超过 limitChars 会被截断并告知总长度；如需浏览更多内容请缩小范围或改用分段查看。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id' },
        fmt: { type: 'string', enum: ['md', 'manuscript', 'txt', 'json'], description: '默认 md' },
        limitChars: { type: 'integer', description: '返回内容上限（默认 24000；json 建议小一些）' },
      },
      required: ['projectId'],
    },
    async execute(args, cx) {
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const fmt = ['md', 'manuscript', 'txt', 'json'].includes(args.fmt) ? args.fmt : 'md';
      const limit = Math.max(500, Math.min(400000, Number(args.limitChars) || 24000));
      const r = await http(svc.url, 'GET', `/api/projects/${encodeURIComponent(args.projectId)}/export?fmt=${fmt}`);
      if (!r.ok) return { ok: false, error: r.error };
      const full = r.text;
      return {
        ok: true,
        fmt,
        totalChars: full.length,
        truncated: full.length > limit,
        content: full.slice(0, limit) + (full.length > limit ? '\n…（已截断，剩余 ' + (full.length - limit) + ' 字）' : ''),
      };
    },
  },
  {
    name: 'novel_forge_remove_project',
    description: '删除指定项目（连同其中全部书稿数据，不可恢复；用于清理测试/废弃项目）。删除前必须向用户确认。',
    parameters: {
      type: 'object',
      properties: { projectId: { type: 'string', description: '项目 id' } },
      required: ['projectId'],
    },
    async execute(args, cx) {
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const r = await http(svc.url, 'DELETE', '/api/projects/' + encodeURIComponent(args.projectId));
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, removed: args.projectId };
    },
  },
];

// ---------------- 能力工作台工具（content_doc_email） ----------------

const capDefs = [
  {
    name: 'novel_forge_capabilities',
    description:
      '列出 NovelForge 引擎当前可用的「能力」：小说创作(novel)、内容仿写/续写/改写(content)、' +
      '公文·安理会决议仿写(doc)、学术套磁邮件(email)，以及每个能力提供的生成动作。' +
      '当用户想做小说之外的长文创作（仿写/续写/改写/公文/邮件）时，先用本工具确认能力并创建对应项目。',
    parameters: { type: 'object', properties: {} },
    async execute(args, cx) {
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const r = await http(svc.url, 'GET', '/api/capabilities');
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, capabilities: r.json.capabilities.map((c) => ({ id: c.id, name: c.name, label: c.label, kind: c.kind, actions: c.actions.map((a) => a.key) })) };
    },
  },
  {
    name: 'novel_forge_cap_create',
    description:
      '在一个「能力工作台」下新建项目：cap 取 content(内容仿写/续写/改写)、doc(安理会决议)、email(套磁邮件)。' +
      '返回项目 id 供后续 cap_set_source / cap_analyze / cap_run 使用。小说创作请用 novel_forge_new_project。',
    parameters: {
      type: 'object',
      properties: {
        cap: { type: 'string', enum: ['content', 'doc', 'email'], description: '能力 id' },
        title: { type: 'string', description: '项目名/标题' },
        desc: { type: 'string', description: '一句话说明（可选）' },
        language: { type: 'string', description: '输出语言，如 zh/en/fr/ru/es/pt（可选）' },
      },
      required: ['cap', 'title'],
    },
    async execute(args, cx) {
      const cap = String(args.cap || '');
      const allowed = ['content', 'doc', 'email'];
      if (!allowed.includes(cap)) return { ok: false, error: '未知能力：' + cap + '（可用 content/doc/email）' };
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const r = await http(svc.url, 'POST', '/api/projects', { name: String(args.title || '').trim(), desc: String(args.desc || '').trim(), cap });
      if (!r.ok) return { ok: false, error: r.error };
      const p = r.json.project;
      if (args.language) {
        await http(svc.url, 'PUT', '/api/projects/' + encodeURIComponent(p.id) + '/workspace', { language: String(args.language) });
      }
      return { ok: true, projectId: p.id, project: capBrief(p), next: '用 novel_forge_cap_set_source 写入源文本，再 novel_forge_cap_analyze / novel_forge_cap_run' };
    },
  },
  {
    name: 'novel_forge_cap_set_source',
    description:
      '向能力项目写入「源文本/草稿/任务」与参数（source 为文本，params 为对象，如 doc.topic、email.recipient）。' +
      'content 能力通常先把用户上传/粘贴的原文写入 source，再分析/仿写/续写/改写。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '能力项目 id' },
        text: { type: 'string', description: '源文本/原文/草稿内容' },
        title: { type: 'string', description: '源文本标题（可选）' },
        lang: { type: 'string', description: '源文本语言（可选）' },
        params: { type: 'object', description: '能力专属参数（可选，如 {"topic":"…","recipient":"…"}）' },
      },
      required: ['projectId', 'text'],
    },
    async execute(args, cx) {
      const p = await readCap(cx, args.projectId);
      if (!p) return { ok: false, error: '项目不存在：' + args.projectId };
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const body = {
        source: [{ id: (p.workspace.source[0] && p.workspace.source[0].id) || 's_', title: String(args.title || ''), text: String(args.text || ''), lang: String(args.lang || ''), meta: (p.workspace.source[0] && p.workspace.source[0].meta) || {} }],
      };
      if (args.params) body.params = args.params;
      const r = await http(svc.url, 'PUT', '/api/projects/' + encodeURIComponent(args.projectId) + '/workspace', body);
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, projectId: args.projectId, sourceChars: String(args.text || '').length, next: 'novel_forge_cap_analyze 分析，或 novel_forge_cap_run 直接仿写/续写/改写' };
    },
  },
  {
    name: 'novel_forge_cap_analyze',
    description:
      '分析能力项目的源文本，返回题材/文风/结构/人物/主题/语言的结构化判定（JSON），写入项目。' +
      '用于「阅读上传内容」并提炼可供仿写/续写/改写的锚点。自动追加在源文本 meta 上。',
    parameters: {
      type: 'object',
      properties: { projectId: { type: 'string', description: '能力项目 id' } },
      required: ['projectId'],
    },
    async execute(args, cx) {
      const p = await readCap(cx, args.projectId);
      if (!p) return { ok: false, error: '项目不存在：' + args.projectId };
      const r = await capGen(cx, CAP_ACTIONS.analyze, {}, args.projectId);
      if (!r.ok) return r;
      const pm = (p.workspace.source[0] && p.workspace.source[0].meta && p.workspace.source[0].meta.analysis) || {};
      return { ok: true, analysis: pm, applied: r.applied, next: 'novel_forge_cap_run（mode=imitate/continue/rewrite）' };
    },
  },
  {
    name: 'novel_forge_cap_run',
    description:
      '在能力项目上执行一个生成动作并返回全文预览：mode=imitate 仿写 / continue 续写 / rewrite 改写 / doc 安理会决议 / email 套磁邮件。' +
      'instruction 为额外指令；输出追加到项目 outputs 列表（续写会同时更新源文本）。结果有字数上限，可再用 novel_forge_cap_read 读完整版。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '能力项目 id' },
        mode: { type: 'string', enum: ['imitate', 'continue', 'rewrite', 'doc', 'email'], description: '生成动作' },
        instruction: { type: 'string', description: '额外指令（如：/ 改得更正式 / 换第一人称 / 主题改为… / 论文方向为…）' },
      },
      required: ['projectId', 'mode'],
    },
    async execute(args, cx) {
      const mode = String(args.mode || '');
      const action = CAP_ACTIONS[mode];
      if (!action) return { ok: false, error: '未知 mode：' + mode + '（可用 imitate/continue/rewrite/doc/email）' };
      const p = await readCap(cx, args.projectId);
      if (!p) return { ok: false, error: '项目不存在：' + args.projectId };
      const r = await capGen(cx, action, { instruction: args.instruction ? String(args.instruction) : undefined }, args.projectId);
      if (!r.ok) return r;
      // 读回 outputs 最新一条
      const after = await readCap(cx, args.projectId);
      const outs = (after && after.workspace && after.workspace.outputs) || [];
      const last = outs[outs.length - 1];
      const content = (last && last.content) || '';
      return {
        ok: true, mode, applied: r.applied, action, projectId: args.projectId,
        outputIndex: outs.length, chars: content.length,
        preview: content.slice(0, 400) + (content.length > 400 ? '\n…（已截断，请用 novel_forge_cap_read 读完整版）' : ''),
      };
    },
  },
  {
    name: 'novel_forge_cap_read',
    description:
      '读取能力项目状态：brief 概览 / source 源文本与分析 / outputs 输出列表（可指定 index 看完整内容）。' +
      '用于会话内审读结果做下一步决策。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '能力项目 id' },
        section: { type: 'string', enum: ['brief', 'source', 'outputs'], description: '默认 brief' },
        index: { type: 'integer', description: 'section=outputs 时指定第几条（1-based）' },
        limitChars: { type: 'integer', description: '单条返回上限（默认 12000）' },
      },
      required: ['projectId'],
    },
    async execute(args, cx) {
      const p = await readCap(cx, args.projectId);
      if (!p) return { ok: false, error: '项目不存在：' + args.projectId };
      const s = args.section || 'brief';
      const ws = p.workspace;
      if (s === 'source') {
        const src = ws.source[0] || {};
        return { ok: true, title: src.title, chars: (src.text || '').length, text: src.text, lang: src.lang, analysis: src.meta && src.meta.analysis };
      }
      if (s === 'outputs') {
        const outs = ws.outputs || [];
        const limit = Math.max(800, Math.min(40000, Number(args.limitChars) || 12000));
        if (args.index) {
          const o = outs[Number(args.index) - 1];
          if (!o) return { ok: false, error: '找不到第 ' + args.index + ' 条输出（共 ' + outs.length + ' 条）' };
          const content = o.content || '';
          return { ok: true, n: Number(args.index), cap: o.cap, action: o.action, label: o.label, chars: content.length, truncated: content.length > limit, content: content.slice(0, limit) + (content.length > limit ? '\n…（已截断）' : '') };
        }
        return { ok: true, outputs: outputView(outs.slice(-50)) };
      }
      return { ok: true, project: capBrief(p) };
    },
  },
];

// ---------------- 插件入口 ----------------
export function apply(ctx, config = {}) {
  const tools = ctx && ctx.tools;
  const log = (typeof ctx.logger === 'function') ? safeLogger(ctx.logger(name)) : console;
  if (!tools || typeof tools.register !== 'function') {
    log.warn('宿主未提供 tools 服务，novel_forge_* 工具未注册');
    return;
  }
  const context = { ctx };
  const unregs = [];
  const all = [...defs, ...capDefs];
  for (const base of all) {
    const def = {
      name: base.name,
      description: base.description,
      parameters: base.parameters,
      execute: async (args = {}, callCtx) => {
        try {
          const out = await base.execute(args, { ctx, context: callCtx });
          return out && typeof out === 'object' ? out : { ok: true, result: out };
        } catch (e) {
          return { ok: false, code: 'TOOL_ERROR', error: String((e && e.message) || e).slice(0, 1500) };
        }
      },
    };
    try {
      const un = tools.register(def);
      if (typeof un === 'function') unregs.push(un);
    } catch (e) {
      log.error('工具注册失败：' + base.name + ' — ' + (e && e.message || e));
    }
  }
  log.info(`已注册 ${unregs.length}/${all.length} 个 novel_forge_* 工具`);
  const cleanup = () => { for (const un of unregs) { try { un(); } catch { /* ignore */ } } };
  if (typeof ctx.effect === 'function') ctx.effect(cleanup);
  else if (typeof ctx.on === 'function') ctx.on('dispose', cleanup);
}

function safeLogger(scoped) {
  const call = (m, fallbacks, args) => {
    for (const k of [m, ...fallbacks]) {
      if (scoped && typeof scoped[k] === 'function') { try { return scoped[k](...args); } catch { /* continue */ } }
    }
    try { (m === 'error' ? console.error : m === 'warn' ? console.warn : console.log)('[novel-forge-tools]', ...args); } catch { /* ignore */ }
  };
  return { log: (...a) => call('log', ['info'], a), info: (...a) => call('info', ['log'], a), warn: (...a) => call('warn', [], a), error: (...a) => call('error', [], a) };
}

export { defs as __defs, capDefs as __capDefs };
