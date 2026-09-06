// check-mount.mjs —— 插件「挂载自检」核心引擎（被 check-mount.bat 调用，也可直接运行）
// 功能：
//   1) 环境与插件完整性检查；2) 实例探测（web/desktop 宿主下均可）；
//   3) 服务抽检；4) 宿主状态判定；5) 自动修正（重试等待/清理残留/隔离诊断启动）；
//   6) 生成 UTF-8 结构化报告 mount-check-report.txt（可直接发给开发者）。
// 用法：node scripts/check-mount.mjs [-url http://host:port] [-autofix] [-report 路径]
// 退出码：0=挂载可用；3=降级(插件本体正常，宿主侧未挂载/未运行)；2=硬性错误(插件或环境损坏)。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchNovelForge, findFreePort } from '../index.js';

const exec = promisify(execFile);
const ROOT = path.dirname(fileURLToPath(import.meta.url)); // scripts/
const PLUGIN = path.resolve(ROOT, '..');
const APP_DIR = path.join(PLUGIN, 'app');
const DEFAULT_REPORT = path.join(PLUGIN, 'mount-check-report.txt');

// ---------- 参数 ----------
const args = process.argv.slice(2);
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const URLS_ARG = [argVal('-url')].filter(Boolean);
const AUTOFIX = args.includes('-autofix');
const REPORT = argVal('-report') || DEFAULT_REPORT;
const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 日志与报告 ----------
const L = [];
const line = (tag, text) => { const s = `${tag} ${text}`; L.push(s); console.log(s); };
const pass = (t) => line('[PASS]', t);
const warn = (t) => line('[WARN]', t);
const info = (t) => line('[INFO]', t);
const fail = (t) => line('[FAIL]', t);
const fix = (t) => line('[FIX ]', t);
let exitCode = 0;

function report(tag, text) { L.push(`[${tag}] ${text}`); }

// ---------- 工具 ----------
async function sh(cmd, argsArr, opts = {}) {
  try {
    const r = await exec(cmd, argsArr, { timeout: opts.timeout || 20000, maxBuffer: 8 * 1024 * 1024, windowsHide: true, encoding: 'utf8' });
    return { ok: true, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
  } catch (e) {
    return { ok: false, out: (e.stdout || '').trim(), err: String(e.stderr || e.message || '') };
  }
}
async function probe(url, ms = 1600) {
  try {
    const res = await fetch(url + '/api/health', { signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    return j && j.ok ? j : null;
  } catch { return null; }
}
async function fetchJson(url, p, ms = 2000) {
  try { const r = await fetch(url + p, { signal: AbortSignal.timeout(ms) }); if (!r.ok) return null; return await r.json().catch(() => null); }
  catch { return null; }
}
const isWin = process.platform === 'win32';

async function hostProcessHints() {
  // 尽力探测宿主进程（web=cli/node dsh；desktop=electron/DSH），失败不阻塞
  const hints = [];
  if (isWin) {
    const r = await sh('tasklist', ['/FO', 'CSV', '/NH']);
    if (r.ok) {
      const names = (r.out.match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, ''));
      const hit = (re) => names.some((n) => re.test(n));
      if (hit(/electron/i)) hints.push('检测到 electron 进程（可能是 DSH Desktop 宿主）');
      if (hit(/dsh/i)) hints.push('检测到名称含 dsh 的进程（可能是宿主/CLI）');
      if (names.some((n) => /node/i.test(n))) hints.push('检测到 node 进程（宿主可能以 node/cli 方式运行）');
    }
  } else {
    const r = await sh('ps', ['-A', '-o', 'comm=']);
    if (r.ok) {
      const names = r.out.split('\n');
      if (names.some((n) => /electron/i.test(n))) hints.push('检测到 electron 进程（可能是 DSH Desktop 宿主）');
      if (names.some((n) => /dsh/i.test(n))) hints.push('检测到名称含 dsh 的进程');
    }
  }
  return hints;
}

// ---------- 主流程 ----------
async function main() {
  const ts = new Date();
  line('==========', '织文 NovelForge · 插件挂载自检');
  info(`时间：${ts.toLocaleString('zh-CN', { hour12: false })}`);
  info(`平台：${process.platform} ${os.release()} · Node ${process.version}`);
  info(`插件目录：${PLUGIN}`);
  info(`模式：${AUTOFIX ? '自动修正开启' : '仅诊断（加 -autofix 可尝试自动修正）'}`);

  // [0] 环境
  line('----', '[0] 环境与插件完整性 ----');
  if (Number(process.versions.node.split('.')[0]) < 18) { fail(`Node 版本过低：${process.version}（需 ≥18.17）`); exitCode = 2; }
  else pass(`Node ${process.version} ≥18.17`);
  const need = ['index.js', 'cordis.patch.yml', path.join('app', 'server', 'index.js'), path.join('app', 'public', 'index.html')];
  for (const rel of need) {
    if (fs.existsSync(path.join(PLUGIN, rel))) pass(`文件存在：${rel}`);
    else { fail(`文件缺失：${rel}（请重新拷贝/安装完整插件包）`); exitCode = 2; }
  }

  // 数据目录可写性
  const dataDir = path.join(APP_DIR, 'data');
  try { fs.mkdirSync(dataDir, { recursive: true }); fs.accessSync(dataDir, fs.constants.W_OK); pass(`数据目录可写：${dataDir}`); }
  catch (e) { fail(`数据目录不可写：${dataDir}（${e.message}）`); exitCode = 2; }

  // [1] 实例探测
  line('----', '[1] 实例探测（web/desktop 宿主下均可）----');
  const candidates = [];
  candidates.push(...URLS_ARG);
  candidates.push(process.env.NOVEL_FORGE_URL || '');
  candidates.push('http://127.0.0.1:7390');
  const unique = [...new Set(candidates.filter(Boolean))];
  const found = [];
  for (const url of unique) {
    const h = await probe(url);
    if (h) found.push({ url, health: h });
    else info(`未响应：${url}`);
  }
  let live = null;
  if (found.length) {
    for (const f of found) {
      const projects = await fetchJson(f.url, '/api/projects');
      const meta = await fetchJson(f.url, '/api/meta');
      const hasDemo = Array.isArray(projects && projects.projects) && projects.projects.some((p) => p && p.demo);
      const appName = meta && meta.app ? (meta.app.nameEn || meta.app.name || 'novel-forge') : '?';
      info(`命中实例 ${f.url}：app=${appName} · 示例项目=${hasDemo ? '在' : '无'}`);
    }
    live = found[0];
    pass(`挂载实例可达：${live.url}（${found.length} 个健康实例）`);
  } else {
    warn('未探测到健康实例');
  }

  // [2] 服务抽检（对 live 实例）
  line('----', '[2] 服务抽检 ----');
  if (live) {
    let okAll = true;
    const checks = [
      ['示例项目在位', async () => { const p = await fetchJson(live.url, '/api/projects'); return !!p && p.projects.some((x) => x.demo); }],
      ['厂商预设与模板', async () => { const s = await fetchJson(live.url, '/api/settings'); return !!s && (s.settings.providers || []).length >= 11 && (s.settings.templates || []).length >= 17; }],
      ['生成动作就绪', async () => { const a = await fetchJson(live.url, '/api/actions'); return !!a && (a.actions || []).length >= 17; }],
      ['Web 页面可达', async () => { try { const r = await fetch(live.url + '/', { signal: AbortSignal.timeout(2000) }); const t = await r.text(); return r.ok && t.includes('NovelForge'); } catch { return false; } }],
      ['导出接口可用', async () => { try { const r = await fetch(live.url + '/api/projects/nf_demo_fogport/export?fmt=md', { signal: AbortSignal.timeout(3000) }); const t = await r.text(); return r.ok && t.length > 200; } catch { return false; } }],
    ];
    for (const [name, fn] of checks) {
      const ok = await fn().catch(() => false);
      if (ok) pass(`抽检通过：${name}`);
      else { fail(`抽检未通过：${name}`); okAll = false; }
    }
    if (!okAll) exitCode = Math.max(exitCode, 3);
  } else {
    warn('跳过抽检（无实例）');
  }

  // [3] 宿主状态
  line('----', '[3] 宿主状态 ----');
  const hints = await hostProcessHints();
  if (hints.length) hints.forEach((h) => info(h));
  else warn('未识别到明显宿主进程（web 端以标签页运行/远程宿主属正常）');

  // [4] 自动修正与诊断
  line('----', '[4] 诊断与自动修正 ----');
  const fixesDone = [];
  if (!live) {
    // 等待性重试（给宿主启动留时间）
    if (AUTOFIX) {
      info('等待宿主完成插件启动（最多 15 秒）…');
      for (let i = 0; i < 10 && !live; i++) {
        await SLEEP(1500);
        for (const url of unique) { const h = await probe(url); if (h) { live = { url, health: h }; break; } }
      }
      if (live) { pass('重试后实例已就绪'); fixesDone.push('等待重试：实例变为就绪'); }
      else warn('等待重试后仍无实例');
    }
    // 清理数据目录残留 .tmp
    if (AUTOFIX) {
      try {
        const dir = path.join(dataDir, 'projects');
        if (fs.existsSync(dir)) {
          let removed = 0;
          for (const f of fs.readdirSync(dir)) if (f.endsWith('.tmp')) { fs.unlinkSync(path.join(dir, f)); removed++; }
          if (removed) { fixesDone.push(`清理残留临时文件 ${removed} 个`); info(`已清理 ${removed} 个 .tmp 残留`); }
        }
      } catch (e) { warn('清理残留失败：' + e.message); }
    }
    // 隔离诊断启动：验证插件本体可独立运行（与宿主无关）
    info('执行隔离诊断：尝试独立拉起插件内嵌应用（3 秒后自动关闭）…');
    try {
      const h = await launchNovelForge({ port: 0, startTimeoutMs: 20000 });
      pass(`插件本体可独立启动：${h.url}（已自动关闭）`);
      fixesDone.push('隔离诊断启动成功：插件本体正常');
      await h.stop();
      if (!live) { warn('宿主侧仍未发现该实例：请确认插件已启用/已加入 profile（见下方指引）'); exitCode = Math.max(exitCode, 3); }
    } catch (e) {
      fail('插件本体独立启动失败：' + (e.message || e).slice(0, 300));
      exitCode = 2;
    }
  } else if (AUTOFIX) {
    info('实例健康，无自动修正需要');
  }

  // [5] 结论
  line('----', '[5] 结论与建议 ----');
  if (live) {
    pass(`挂载成功：${live.url}`);
    info('• 会话内可直接使用 novel_forge_* 工具完成创作（无需打开浏览器）。');
    info('• 宿主侧服务对象：ctx.novelForge.status/url/start/stop/describe；网页为可选可视化界面。');
  } else if (exitCode === 2) {
    fail('存在硬性错误：插件文件或环境不完整，请按 [FAIL] 行修复后重跑。');
    info('• 修复后重跑本自检：node scripts/check-mount.mjs -autofix');
  } else {
    warn('挂载未就绪（降级）：插件本体正常，宿主侧未发现实例。');
    info('排查指引：');
    info('  1) web(CLI) 宿主：dsh plugin add <插件目录> 后重启宿主，日志应出现 “已就绪：http://…”；');
    info('     dsh --profile <名> --dump-config 中应能看到 novel-forge 层；');
    info('  2) desktop 宿主：在插件面板确认 dsh-novel-forge 已启用并重启；');
    info('  3) 确认没有其它实例占用固定端口（port:0 为自动随机，不会冲突）。');
    info('  4) 自检报告文件可发给开发者定位。');
  }
  if (fixesDone.length) { line('----', '[FIX] 本次自动修正动作 ----'); fixesDone.forEach((f) => fix(f)); }
  else line('----', '[FIX] 本次无自动修正动作 ----');

  // [6] 写报告
  line('----', '[6] 写报告 ----');
  try {
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    const body = L.join('\n') + '\n\n' + [
      '==============================================',
      '如何把这份报告交给开发者：直接发送本文件即可。',
      '包含：时间/环境/插件完整性/探测结果/抽检结果/',
      '自动修正动作/结论与建议，全部为可机读的行式文本',
      '（[PASS]/[WARN]/[FAIL]/[FIX]/[INFO] 前缀）。',
      '配合宿主日志（搜索 “[novel-forge]” 或 “已就绪”）一起发更佳。',
      '==============================================',
    ].join('\n');
    fs.writeFileSync(REPORT, body, 'utf8');
    pass(`报告已写入：${REPORT}`);
  } catch (e) { fail('报告写入失败：' + e.message); exitCode = 2; }

  console.log(`\n自检退出码：${exitCode}（0=挂载可用；3=降级待处理；2=硬性错误）`);
  process.exit(exitCode);
}

main().catch((e) => { console.error('自检引擎异常：', e); try { fs.writeFileSync(REPORT, '自检引擎异常：' + (e.stack || e.message), 'utf8'); } catch { /* ignore */ } process.exit(2); });
