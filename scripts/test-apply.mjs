// dsh-novel-forge apply() 入口测试（最小 ctx 桩模拟 Cordis）
import { apply, name } from '../index.js';
import { execFileSync } from 'node:child_process';

let pass = 0, fail = 0;
const t = (n, c, x) => { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('  FAIL ' + n + (x ? ' :: ' + String(x).slice(0, 300) : '')); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let cleanup = null;
const provided = {};
const ctx = {
  logger: (scope) => ({ log: (...a) => console.log('  [logger:' + scope + ']', ...a), warn: (...a) => console.warn('  [logger-warn]', ...a), error: (...a) => console.error('  [logger-err]', ...a) }),
  effect(fn) { cleanup = fn(); },
  provide(k, v) { provided[k] = v; },
};

apply(ctx, { autoStart: true, port: 0, startTimeoutMs: 20000 });
t('导出 name', name === 'novel-forge', name);
t('服务已注册 provide("novelForge")', !!provided.novelForge, Object.keys(provided).join(','));

let up = false;
for (let i = 0; i < 80 && !up; i++) {
  await sleep(250);
  if (provided.novelForge && provided.novelForge.status === 'running') up = true;
}
t('autoStart 后 status=running', up && provided.novelForge.status === 'running', provided.novelForge && provided.novelForge.status);
const url = provided.novelForge && provided.novelForge.url;
t('拿到 url', !!url && url.startsWith('http://127.0.0.1:'), url);
const d = provided.novelForge.describe();
t('describe 含应用信息与数据目录', d.app === '织文 NovelForge' && /data/.test(d.dataDir), JSON.stringify(d).slice(0, 160));

// dispose 清理 → 子进程停止
t('effect 清理函数已挂载', typeof cleanup === 'function');
if (cleanup) await cleanup();
await sleep(500);
let dead = false;
try { await fetch(url + '/api/health', { signal: AbortSignal.timeout(800) }); } catch { dead = true; }
t('dispose 后服务已停止', dead);

// 再次 start/stop 可用
await provided.novelForge.start();
await sleep(1500);
t('start() 可再次启动', provided.novelForge.status === 'running');
await provided.novelForge.stop();
t('stop() 后 status=stopped', provided.novelForge.status === 'stopped');

console.log(`\napply 入口测试: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
