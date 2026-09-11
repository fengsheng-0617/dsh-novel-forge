// test-tools.mjs —— novel_forge_* 会话工具集端到端自测（模拟引擎）
// 流程：独立拉起内嵌实例(临时数据) → apply(tools) 注册 → 按“写小说”路径依次调用各工具。
import { launchNovelForge } from '../index.js';
import { apply, __defs, __capDefs } from '../tools.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('  FAIL ' + n + (x ? ' :: ' + String(x).slice(0, 300) : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const regs = [];
const ctx = {
  novelForge: null, // 下面填充
  tools: { register: (def) => { regs.push(def); return () => { const i = regs.indexOf(def); if (i >= 0) regs.splice(i, 1); }; } },
  logger: () => ({ log: () => {}, info: () => {}, warn: () => {}, error: () => {} }),
  effect: () => {},
};

const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-nf-tools-'));
let h = null;
try {
  h = await launchNovelForge({ port: 0, dataDir: tmpData, startTimeoutMs: 20000 });
  ctx.novelForge = { status: 'running', url: h.url, start: async () => h, stop: async () => h.stop() };
  apply(ctx, {});
  t('20 个工具已注册（14 novel + 6 capability）', regs.length === __defs.length + __capDefs.length && regs.length === 20, 'regs=' + regs.length);
  const byName = (n) => regs.find((d) => d.name === n);
  const call = async (name, args) => {
    const def = byName(name);
    if (!def) return { ok: false, error: '工具未注册' };
    const r = await def.execute(args || {}, { ctx });
    return r;
  };

  console.log('== 1 状态与建项目 ==');
  let r = await call('novel_forge_status');
  t('status ok', r.ok === true && Array.isArray(r.projects), JSON.stringify(r).slice(0, 140));
  r = await call('novel_forge_new_project', { title: '《工具链测试》', desc: 'e2e' });
  t('new_project 返回 id', r.ok === true && r.projectId, JSON.stringify(r).slice(0, 120));
  const pid = r.projectId;

  console.log('== 2 种子点子 → 头脑风暴 ==');
  r = await call('novel_forge_seed_idea', { projectId: pid, title: '《工具链测试》', genres: ['奇幻', '悬疑'], premise: '守夜人发现每年冬至都会多出一页日历，上面写着一个还没发生的名字。', logline: '守夜人追查幽灵日历，却发现下一个名字是自己。' });
  t('seed_idea ok', r.ok === true && r.saved && r.saved.title.includes('工具链'), JSON.stringify(r).slice(0, 140));
  r = await call('novel_forge_ideate', { projectId: pid, genreHint: '奇幻悬疑', count: 6 });
  t('ideate 返回候选并入库点子池', r.ok === true && Array.isArray(r.candidates) && r.candidates.length >= 3 && r.candidatesSavedToPool === true, JSON.stringify(r).slice(0, 200));

  console.log('== 2.5 故事路线强制引导（只给一段话也必须给路线与大纲思路） ==');
  r = await call('novel_forge_develop_project', { projectId: pid, stage: 'outline' });
  t('未选定路线 → 生成大纲被拒（NEED_ROUTE）', r.ok === false && r.code === 'NEED_ROUTE' && typeof r.next === 'string', JSON.stringify(r).slice(0, 220));
  r = await call('novel_forge_chain', { projectId: pid, mode: 'full', timeoutSec: 60 });
  t('未选定路线 → chain full 同样被拒', r.ok === false && r.code === 'NEED_ROUTE', JSON.stringify(r).slice(0, 180));
  r = await call('novel_forge_route_plan', { projectId: pid, count: 3, instruction: '冷冽写实、双线推进', source: 'engine' });
  t('route_plan（engine 通道）产出多条路线候选', r.ok === true && r.mode === 'engine' && Array.isArray(r.routes) && r.routes.length >= 2 && r.mustChoose === true, JSON.stringify(r).slice(0, 260));
  t('候选含思路/阶段路线/结局/风险（可直接展示给用户）',
    !!(r.routes[0].approach && r.routes[0].structure.length >= 1 && r.routes[0].ending && r.routes[0].risk && r.routes[0].coreConflict),
    JSON.stringify(r.routes[0]).slice(0, 300));
  t('候选标注了 AI 推荐项', r.routes.some((x) => x.recommended === true), JSON.stringify(r.routes.map((x) => x.recommended)));
  r = await call('novel_forge_choose_route', { projectId: pid });
  t('choose_route 缺少选择 → NEED_CHOICE（不许替用户拍板）', r.ok === false && r.code === 'NEED_CHOICE', JSON.stringify(r).slice(0, 180));
  r = await call('novel_forge_read_project', { projectId: pid, section: 'routes' });
  t('read routes 可见候选且未就绪', r.ok === true && r.ready === false && r.candidates.length >= 2, JSON.stringify(r).slice(0, 180));
  r = await call('novel_forge_choose_route', { projectId: pid, index: 1, note: '用户选第 2 条' });
  t('choose_route 按编号写入用户选定路线', r.ok === true && r.selected && r.selected.mode === 'user' && r.selected.name, JSON.stringify(r).slice(0, 200));
  r = await call('novel_forge_read_project', { projectId: pid, section: 'routes' });
  t('read routes 变为已就绪', r.ok === true && r.ready === true && r.selected.name, JSON.stringify(r.selected).slice(0, 160));
  r = await call('novel_forge_choose_route', { projectId: pid, custom: '双主角交替视角，前半明查后半倒叙，结局以代价收束' });
  t('choose_route 支持用户自定义路线（mode=custom）', r.ok === true && r.selected.mode === 'custom' && r.selected.approach.length > 8, JSON.stringify(r.selected).slice(0, 200));
  r = await call('novel_forge_choose_route', { projectId: pid, delegate: true });
  t('delegate 无授权原话 → NEED_AUTHORIZATION（拦下替用户拍板）', r.ok === false && r.code === 'NEED_AUTHORIZATION', JSON.stringify(r).slice(0, 180));
  r = await call('novel_forge_choose_route', { projectId: pid, delegate: true, note: '用户说：你来定' });
  t('choose_route 支持用户授权 AI 选定（mode=delegate）', r.ok === true && r.selected.mode === 'delegate', JSON.stringify(r.selected).slice(0, 160));

  console.log('== 2.6 一段话即可走通引导（新项目） ==');
  r = await call('novel_forge_new_project', { title: '《一段话测试》' });
  const pid2 = r.projectId;
  r = await call('novel_forge_route_plan', { projectId: pid2, paragraph: '深夜便利店里，值夜班的店员发现每位顾客的收据上，都印着他们第二天的死法。', count: 3 });
  t('引擎仅模拟引擎 → 改由会话模型自产候选（含字段规范）',
    r.ok === true && r.mode === 'session' && r.seededParagraph === true && r.authoring && r.authoring.fields.approach && Array.isArray(r.authoring.rules),
    JSON.stringify({ ok: r.ok, mode: r.mode, seeded: r.seededParagraph }).slice(0, 220));
  t('会话自产模式明确要求展示给用户并禁止先出大纲',
    /逐条完整展示给用户/.test(r.instruction || '') && /不得生成大纲/.test(r.blockedUntil || ''), (r.blockedUntil || '').slice(0, 120));
  r = await call('novel_forge_develop_project', { projectId: pid2, stage: 'outline' });
  t('新项目未选定路线 → 大纲仍被拒', r.ok === false && r.code === 'NEED_ROUTE', JSON.stringify(r).slice(0, 160));
  const authored = [
    { name: '收据直推·倒计时压迫', approach: '单线推进：每张收据给出一个死亡预告，店员逐条阻止却逐条落空，直到发现自己的收据。', structure: [{ phase: '第一幕·警觉', span: '第1~6章', goal: '异常显现', turn: '第一次阻止失败' }, { phase: '第二幕·代价', span: '第7~16章', goal: '代价升级', turn: '店员的收据出现' }], coreConflict: '想救人 vs 预告不可改', ending: '店员以自身为代价改写最后一张收据', tone: '冷硬深夜感', hooks: ['收据上的字迹', '消失的第七位顾客'], risk: '节奏紧、配角薄，适合悬疑短篇读者', recommended: true },
    { name: '群像切面·同一家店', approach: '多视角群像：每卷换一位顾客视角，最后在便利店合流。', structure: [{ phase: '第一幕', span: '第1~8章', goal: '铺开不同人生', turn: '共同指向同一张收据' }], coreConflict: '各自求生 vs 共享命运', ending: '众人选择共同承担', tone: '温厚群像', hooks: ['店长的沉默'], risk: '主线推进慢，适合群像爱好者', recommended: false },
  ];
  r = await call('novel_forge_choose_route', { projectId: pid2, routes: authored, index: 0, note: '用户选第 1 条' });
  t('会话自产候选可通过 choose_route 入库并选定', r.ok === true && r.selected.mode === 'user' && r.candidates === 2 && r.selected.name.includes('倒计时'), JSON.stringify(r.selected).slice(0, 180));
  r = await call('novel_forge_read_project', { projectId: pid2, section: 'routes' });
  t('自产候选已入库且就绪', r.ok === true && r.ready === true && r.candidates.length === 2 && r.selected.name === '收据直推·倒计时压迫', JSON.stringify(r).slice(0, 200));
  r = await call('novel_forge_develop_project', { projectId: pid2, stage: 'outline' });
  t('选定路线后大纲生成成功并标注遵循路线', r.ok === true && r.detail.chapters >= 3 && r.routeGuided === true && r.route && r.route.name, JSON.stringify(r).slice(0, 220));
  r = await call('novel_forge_export', { projectId: pid2, fmt: 'manuscript', limitChars: 8000 });
  t('底稿导出含「故事路线与大纲思路」', r.ok === true && r.content.includes('故事路线与大纲思路'), 'chars=' + (r.content || '').length);
  r = await call('novel_forge_remove_project', { projectId: pid2 });
  t('清理一段话测试项目', r.ok === true, JSON.stringify(r).slice(0, 120));

  console.log('== 3 分阶段 develop ==');
  r = await call('novel_forge_develop_project', { projectId: pid, stage: 'flesh' });
  t('flesh 深化并应用', r.ok === true && r.detail && r.detail.title, JSON.stringify(r).slice(0, 180));
  r = await call('novel_forge_develop_project', { projectId: pid, stage: 'world' });
  t('world 设定集', r.ok === true && r.detail && r.detail.sections > 0, JSON.stringify(r.detail));
  r = await call('novel_forge_develop_project', { projectId: pid, stage: 'characters', count: 6 });
  t('characters 群像', r.ok === true && r.detail && r.detail.characters >= 4, JSON.stringify(r.detail));
  r = await call('novel_forge_develop_project', { projectId: pid, stage: 'outline' });
  t('outline 全书大纲', r.ok === true && r.detail && r.detail.chapters >= 3, JSON.stringify(r.detail));

  console.log('== 4 查看与写章 ==');
  r = await call('novel_forge_read_project', { projectId: pid, section: 'outline' });
  t('read outline', r.ok === true && r.chapters.length >= 3 && r.chapters[0].status === '待写', JSON.stringify(r.chapters && r.chapters[0]));
  r = await call('novel_forge_write_chapter', { projectId: pid, chapterNo: 1 });
  t('写第1章+归档', r.ok === true && r.words > 800 && r.summarySaved === true, JSON.stringify(r).slice(0, 200));
  r = await call('novel_forge_write_chapter', { projectId: pid, chapterNo: 2 });
  t('写第2章+归档', r.ok === true && r.words > 800, JSON.stringify(r).slice(0, 120));
  // 重写保护
  r = await call('novel_forge_write_chapter', { projectId: pid, chapterNo: 1 });
  t('重复写已有章 → NEED_CONFIRM 且不覆盖', r.ok === false && r.code === 'NEED_CONFIRM', JSON.stringify(r).slice(0, 160));

  console.log('== 5 无人值守收尾 + 审校 ==');
  r = await call('novel_forge_chain', { projectId: pid, mode: 'write', timeoutSec: 120 });
  t('chain 收尾剩余章节 done', r.ok === true && r.result && r.result.status === 'done', JSON.stringify(r).slice(0, 260));
  r = await call('novel_forge_read_project', { projectId: pid, section: 'summary' });
  t('全部章节已写', r.ok === true && r.project && r.project.written === r.project.chapters && r.project.written >= 3, JSON.stringify(r.project));
  r = await call('novel_forge_develop_project', { projectId: pid, stage: 'audit' });
  t('audit 审查报告', r.ok === true && typeof (r.detail && r.detail.issues) === 'number' && r.detail.issues >= 0, JSON.stringify(r).slice(0, 160));

  console.log('== 5.5 会话内全量能力（读正文/精修/扩章/导出/删除） ==');
  r = await call('novel_forge_read_project', { projectId: pid, section: 'chapter', chapterNo: 1 });
  t('read chapter 返回正文', r.ok === true && r.written === true && (r.content || '').length > 200, JSON.stringify(r).slice(0, 120));
  r = await call('novel_forge_edit_chapter', { projectId: pid, chapterNo: 1, mode: 'polish', instruction: '润色' });
  t('edit polish 返回预览', r.ok === true && (r.preview || '').length > 100, JSON.stringify(r).slice(0, 160));
  r = await call('novel_forge_edit_chapter', { projectId: pid, chapterNo: 1, mode: 'summarize' });
  t('edit summarize 归档', r.ok === true && r.summarySaved === true, JSON.stringify(r).slice(0, 120));
  const beforeExt = (await call('novel_forge_read_project', { projectId: pid, section: 'summary' })).project.chapters;
  r = await call('novel_forge_extend_outline', { projectId: pid, count: 2 });
  t('extend outline +2 章', r.ok === true && r.chapters === beforeExt + 2, JSON.stringify(r).slice(0, 140));
  r = await call('novel_forge_write_chapter', { projectId: pid, chapterNo: beforeExt + 1 });
  t('续写新章成功', r.ok === true && r.words > 800, JSON.stringify(r).slice(0, 140));
  r = await call('novel_forge_export', { projectId: pid, fmt: 'md', limitChars: 60000 });
  t('export md 全文回会话', r.ok === true && r.content.includes('工具链测试') && r.content.length > 1000, 'chars=' + (r.content || '').length);
  r = await call('novel_forge_export', { projectId: pid, fmt: 'json', limitChars: 20000 });
  t('export json 截断保护', r.ok === true && r.truncated === true && typeof r.totalChars === 'number', JSON.stringify({ total: r.totalChars, trunc: r.truncated }));
  r = await call('novel_forge_remove_project', { projectId: pid });
  t('remove_project 删除', r.ok === true && r.removed === pid, JSON.stringify(r));
  const gone = await fetch(h.url + '/api/projects/' + pid);
  t('项目已不存在', gone.status === 404);
  r = await call('novel_forge_remove_project', { projectId: pid });
  t('重复删除报错不崩溃', r.ok === false, JSON.stringify(r).slice(0, 100));
} finally {
  if (h) await h.stop().catch(() => {});
  try { fs.rmSync(tmpData, { recursive: true, force: true }); } catch { /* ignore */ }
}
console.log(`\n工具集自测: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
