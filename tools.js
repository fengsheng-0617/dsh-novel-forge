// tools.js —— dsh-novel-forge 的「会话工具」子插件入口（harness 内全量工作形态）。
// 作用：向宿主注册 novel_forge_* 工具集。用户只需在 harness 会话/工作区里说出创作
//       意图（“我有个点子想写小说”“继续写下去”“导出全书”…），模型即检测关键词并
//       在会话内全量调用：建项目→点子→设定→人物→大纲→逐章写作→精修→审校→导出，
//       结果与正文预览直接回到会话。无需打开任何浏览器；内嵌应用仅作为无头创作引擎
//       （其网页界面为可选的图形化编辑入口，不作为使用前提）。
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
  return {
    id: p.id,
    name: p.name,
    stage: (p.idea && p.idea.title && p.idea.premise ? '已立项' : '灵感阶段'),
    title: (p.idea || {}).title || '',
    characters: (p.characters || []).length,
    chapters: rows.length,
    written: rows.filter((r) => r.ch && r.ch.content).length,
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

// ---------------- 工具定义 ----------------
const defs = [
  {
    name: 'novel_forge_status',
    description:
      'NovelForge（AI 小说创作工坊）状态查询：当前服务地址、是否就绪、已有项目清单。' +
      '当用户想写小说/长文创作时，可先调用本工具确认服务可用并选择/创建项目。',
    parameters: { type: 'object', properties: {} },
    async execute(args, cx) {
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const r = await http(svc.url, 'GET', '/api/projects');
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, url: svc.url, projects: r.json.projects.map((x) => ({ id: x.id, name: x.name, demo: !!x.demo, written: x.counts && x.counts.written, chapters: x.counts && x.counts.chapters })) };
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
      return { ok: true, projectId: p.id, project: projectBrief(p), next: '可用 novel_forge_ideate 头脑风暴，或 novel_forge_seed_idea 直接写入点子后再 novel_forge_develop_project' };
    },
  },
  {
    name: 'novel_forge_seed_idea',
    description:
      '把用户的小说点子写入指定项目的创意卡（可随后 develop 深化）。' +
      '用户说出点子时优先用本工具保存原话要点，再决定是否让 AI 深化。',
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
      const value = {
        title: args.title ?? old.title ?? '',
        genres: Array.isArray(args.genres) ? args.genres.slice(0, 3) : (old.genres || []),
        targetWords: Math.max(0, Number(args.targetWords) || old.targetWords || 100000),
        logline: args.logline ?? old.logline ?? '',
        premise: args.premise ?? old.premise ?? '',
        hook: old.hook || '', conflict: old.conflict || '', pov: old.pov || '', tone: args.tone ?? old.tone ?? '',
        audience: old.audience || '', extra: old.extra || '', candidates: old.candidates || [],
      };
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const r = await http(svc.url, 'PUT', `/api/projects/${encodeURIComponent(args.projectId)}/doc`, { pointer: 'idea', value });
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, projectId: args.projectId, saved: { title: value.title, genres: value.genres, targetWords: value.targetWords }, next: 'novel_forge_develop_project（stage=flesh）继续深化' };
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
        note: '请向用户展示候选并请其选择；用户选定后调用 novel_forge_seed_idea 写入',
        ...(args.projectId ? { projectId, candidatesSavedToPool: applied } : {}),
      };
    },
  },
  {
    name: 'novel_forge_develop_project',
    description:
      '推进指定项目的创作阶段并应用结果：flesh=深化立项书；world=世界观设定集；' +
      'characters=人物群像；outline=全书卷章大纲；audit=全文一致性审查。' +
      '阶段会依序补齐（如先 outline 会自动先生成缺失的 bible/characters）。' +
      '若目标阶段已有内容且 overwrite=false，会返回 NEED_CONFIRM，请先征得用户同意（overwrite=true）再重试。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id' },
        stage: { type: 'string', enum: ['flesh', 'world', 'characters', 'outline', 'audit'], description: '要推进的阶段' },
        count: { type: 'integer', description: 'characters 阶段的人物数量（默认 10）' },
        instruction: { type: 'string', description: '附加要求（可选，会传入 AI 提示词）' },
        overwrite: { type: 'boolean', description: '目标阶段已有内容时是否覆盖（默认 false，覆盖有风险需用户确认）' },
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
      // 依序补缺：flesh 前置为 seed 的创意；world/characters/outline 若空会自动生成链在 outline 阶段缺省? 保持显式：
      const argsBase = { instruction: args.instruction ? String(args.instruction) : undefined };
      if (action === 'characters_generate') argsBase.count = Math.min(18, Math.max(4, Number(args.count) || 10));
      const g = await runGen(cx.ctx, action, { ...argsBase, ...(args.overwrite ? { force: true } : {}) }, { projectId });
      if (!g.ok) return g;
      const after = await readProject(cx.ctx, projectId);
      return {
        ok: true,
        applied: g.applied,
        project: projectBrief(after),
        detail: stage === 'world' ? { sections: (after.bible.sections || []).length, rules: (after.bible.rules || []).length }
          : stage === 'characters' ? { characters: (after.characters || []).length }
          : stage === 'outline' ? { chapters: (after.rows || []).length }
          : stage === 'audit' ? { issues: ((after.audits || {}).items || []).length }
          : { title: after.idea && after.idea.title },
        next: stage === 'flesh' ? 'novel_forge_develop_project stage=world → characters → outline' : '继续下一阶段或 novel_forge_read_project 查看',
      };
    },
  },
  {
    name: 'novel_forge_read_project',
    description:
      '读取项目当前状态/内容：summary=进度概览；outline=章节清单与已写状态；idea=创意卡；' +
      'characters=人物名册；chapter=某一章正文（配合 chapterNo，最多返回前 10000 字，供会话内审读/接续）。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id' },
        section: { type: 'string', enum: ['summary', 'outline', 'idea', 'characters', 'chapter'], description: '默认 summary' },
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
      '无人值守流水线：full=从当前缺口自动补齐 点子→设定→人物→大纲→逐章连载（用户给了完整点子后最省事）；' +
      'write=把大纲剩余章节全部自动写完。可长时间运行，会按 timeoutSec 轮询直到完成/出错/超时。',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 id' },
        mode: { type: 'string', enum: ['full', 'write'], description: '默认 full' },
        timeoutSec: { type: 'integer', description: '最长等待秒数（默认 600）' },
      },
      required: ['projectId'],
    },
    async execute(args, cx) {
      const svc = await withService(cx.ctx);
      if (svc.error) return { ok: false, error: svc.error };
      const mode = args.mode === 'write' ? 'write' : 'full';
      const deadline = Date.now() + (Math.min(1800, Math.max(10, Number(args.timeoutSec) || 600)) * 1000);
      const s = await http(svc.url, 'POST', '/api/pipeline/start', { projectId: String(args.projectId), mode });
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
  for (const base of defs) {
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
  log.info(`已注册 ${unregs.length}/${defs.length} 个 novel_forge_* 工具`);
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

export { defs as __defs };
