// dsh-novel-forge 独立自测：不依赖 Cordis，用最小 ctx 桩验证 launchNovelForge 全生命周期
import { launchNovelForge, findFreePort, probeReady } from '../index.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('  FAIL ' + n + (x ? ' :: ' + String(x).slice(0, 300) : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-nf-test-'));

try {
  console.log('== 工具函数 ==');
  const port = await findFreePort();
  t('findFreePort 返回可用端口', Number.isInteger(port) && port > 0, port);
  t('probeReady 对空端口返回 false', (await probeReady(`http://127.0.0.1:${port}`)) === false);

  console.log('== launchNovelForge 全生命周期 ==');
  const h = await launchNovelForge({ port: 0, dataDir: tmpData, startTimeoutMs: 20000 });
  t('启动并健康检查通过', h.url.startsWith('http://127.0.0.1:'), h.url);
  const pr = await (await fetch(h.url + '/api/projects')).json();
  t('首启自动创建示例项目', Array.isArray(pr.projects) && pr.projects.length === 1 && pr.projects[0].demo === true, JSON.stringify(pr.projects && pr.projects[0] && pr.projects[0].name));
  const se = await (await fetch(h.url + '/api/settings')).json();
  t('厂商预设 12 家、模板 25 套（含故事路线模板）', (se.settings.providers || []).length === 12 && (se.settings.templates || []).length === 25
    && (se.settings.templates || []).some((x) => x.key === 't_route_plan'));
  const ac = await (await fetch(h.url + '/api/actions')).json();
  const routeAct = (ac.actions || []).find((x) => x.key === 'route_plan');
  t('引擎注册 route_plan 动作', !!routeAct && routeAct.stage === 'idea', JSON.stringify(routeAct || null));
  const tplOutline = (se.settings.templates || []).find((x) => x.key === 't_outline_generate');
  t('大纲模板已注入 {{routeText}}（大纲遵循选定路线）', !!tplOutline && /routeText/.test(tplOutline.user), tplOutline && tplOutline.user.slice(0, 60));
  const st = await (await fetch(h.url + '/api/pipeline/status')).json();
  t('流水线状态接口可用', st.pipeline && st.pipeline.status === 'idle');

  console.log('== 停止 ==');
  await h.stop();
  await sleep(400);
  let dead = false;
  try { await fetch(h.url + '/api/health', { signal: AbortSignal.timeout(800) }); } catch { dead = true; }
  t('stop 后端口已关闭', dead);

  console.log('== 二次启动（同一数据目录） ==');
  const h2 = await launchNovelForge({ port: 0, dataDir: tmpData, startTimeoutMs: 20000 });
  const pr2 = await (await fetch(h2.url + '/api/projects')).json();
  t('数据保留（示例仍在）', pr2.projects.length === 1);
  await h2.stop();
} finally {
  try { fs.rmSync(tmpData, { recursive: true, force: true }); } catch { /* ignore */ }
}
console.log(`\n插件自测: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
