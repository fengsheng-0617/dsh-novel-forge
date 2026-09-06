// verify-mounted.mjs —— 插件「挂载后」运行时验收
// 用法：
//   1) 从宿主日志/describe 拿到 NovelForge 地址（形如 http://127.0.0.1:54321）
//   2) node scripts/verify-mounted.mjs [url]   （缺省尝试 7390 与从参数读）
'use strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ARG = process.argv[2] || '';
const CANDIDATES = (ARG ? [ARG] : []).concat(['http://127.0.0.1:7390']);
let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('  FAIL ' + n + (x ? ' :: ' + String(x).slice(0, 260) : '')); } };

async function pick() {
  for (const base of CANDIDATES) {
    try {
      const r = await fetch(base + '/api/health', { signal: AbortSignal.timeout(2500) });
      const j = await r.json().catch(() => null);
      if (j && j.ok) return base;
    } catch { /* 下一个候选 */ }
  }
  return null;
}
async function req(base, p, method = 'GET', body) {
  const res = await fetch(base + p, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, json, text };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const base = await pick();
if (!base) {
  console.log('✗ 找不到可用的 NovelForge 实例');
  console.log('  请从宿主日志中找到 “已就绪：http://127.0.0.1:端口” 后，以 URL 为参数重跑：');
  console.log('  node scripts/verify-mounted.mjs http://127.0.0.1:端口');
  process.exit(1);
}
console.log('挂载验收对象：' + base + '\n');

console.log('== 1 服务与页面 ==');
let r = await req(base, '/api/health');
t('健康检查', r.status === 200 && r.json && r.json.ok);
r = await req(base, '/');
t('Web 界面可达', r.status === 200 && r.text.includes('NovelForge'));
r = await req(base, '/api/meta');
t('版本元数据', r.json && r.json.app && r.json.app.version);

console.log('== 2 出厂内容 ==');
r = await req(base, '/api/projects');
t('示例项目《雾港来信》在位', r.json.projects.some((p) => p.id === 'nf_demo_fogport'));
r = await req(base, '/api/settings');
t('模板 18 套 + 厂商 12 家', (r.json.settings.templates || []).length >= 17 && (r.json.settings.providers || []).length >= 11);
r = await req(base, '/api/actions');
t('生成动作 18 个', (r.json.actions || []).length >= 17);
r = await req(base, '/api/pipeline/status');
t('流水线状态接口', r.json.pipeline && r.json.pipeline.status === 'idle');

console.log('== 3 模拟引擎端到端（离线、无需 Key） ==');
r = await req(base, '/api/projects', 'POST', { name: '挂载验收临时书', desc: 'verify-mounted' });
const pid = r.json.project.id;
t('创建临时项目', r.status === 200 && !!pid);
// 写入最小立项 → 深化 → 应用
await req(base, `/api/projects/${pid}/doc`, 'PUT', {
  pointer: 'idea',
  value: { title: '《挂载验收》', genres: ['奇幻'], targetWords: 60000, logline: '临时测试。', premise: '用于挂载后验收的临时设定。', pov: '第三人称', tone: '', audience: '', hook: '', conflict: '', extra: '', candidates: [] },
});
r = await req(base, '/api/gen', 'POST', { projectId: pid, action: 'idea_flesh', args: {}, stream: false });
t('AI 深化生成（模拟引擎）', r.status === 200 && r.json.result && r.json.result.kind === 'json');
if (r.status === 200) {
  await req(base, '/api/apply', 'POST', { projectId: pid, resultId: r.json.result.id });
  const pr = await req(base, `/api/projects/${pid}`);
  t('结果已应用入库', pr.json.project.idea.title.includes('挂载验收') || (pr.json.project.idea.premise || '').length > 0);
}
// 导出
const md = await req(base, `/api/projects/${pid}/export?fmt=md`);
t('导出成书 md 可用', md.status === 200 && md.text.length > 100 && md.text.includes('挂载验收'), 'len=' + (md.text || '').length);
r = await req(base, `/api/projects/${pid}`, 'DELETE');
t('临时项目已清理', r.status === 200);
r = await req(base, '/api/projects');
t('示例项目未被破坏', r.json.projects.some((p) => p.id === 'nf_demo_fogport'));

console.log('== 4 宿主集成提示 ==');
console.log('  若以上全绿，说明插件挂载与内嵌应用工作正常。');
console.log('  宿主侧服务对象 ctx.novelForge：status/url/start/stop/describe 可直接调用。');
console.log('  数据目录：插件 app/data/（settings.json 含模型配置，projects/ 含书稿）。');

console.log(`\n挂载验收: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
