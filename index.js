// dsh-novel-forge —— DeepSeek Harness 组合包插件入口。
// 职责：把随包内嵌的「织文 NovelForge」零依赖 Web 应用作为子进程拉起，
//       并提供 novelForge 服务（url/status/start/stop/logs），随 DSH 生命周期启停。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';

export const name = 'novel-forge';
export const inject = [];

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(ROOT, 'app');
const DEFAULT_TIMEOUT = 20000;

// ---------------- 纯工具（可独立测试） ----------------

/**
 * 解析可用于拉起 Node 子进程的可执行文件。
 * 关键：在 DSH Desktop(Electron) 宿主内，process.execPath 指向宿主 exe 而非 node，
 * 直接用它运行 server/index.js 必然失败。解析优先级：
 *   1) 环境变量 NOVEL_NODE
 *   2) process.execPath —— 仅当它本身是 node（文件名含 node，且不是 electron/宿主名）
 *   3) 'node' —— 依赖 PATH（桌面宿主内置 Node 通常也在 PATH/由宿主注入）
 * @param {string} [exePath=process.execPath]
 */
export function resolveNode(exePath = process.execPath, env = process.env) {
  if (env.NOVEL_NODE && env.NOVEL_NODE.trim()) return env.NOVEL_NODE.trim();
  if (exePath) {
    const base = path.basename(exePath).toLowerCase().replace(/\.exe$/, '');
    const looksLikeNode = /^node/.test(base) && !/(electron|harness|dsh|desktop)/.test(base);
    if (looksLikeNode) {
      try { if (existsSync(exePath)) return exePath; } catch { return exePath; }
    }
  }
  return 'node';
}

/** 返回一个空闲 TCP 端口（port 0 = 系统分配） */
export function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

/** 探测 http://host:port/api/health 是否就绪 */
export async function probeReady(url, timeoutMs = 600) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url + '/api/health', { signal: ctl.signal });
    if (!res.ok) return false;
    const j = await res.json().catch(() => null);
    return !!(j && j.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 启动内嵌 NovelForge。
 * @param {object} opts {port=0, host='127.0.0.1', dataDir, startTimeoutMs, env}
 * @returns {Promise<{child, url, stop():Promise<void>, stdout:string, stderr:string}>}
 */
export async function launchNovelForge(opts = {}) {
  const host = opts.host || '127.0.0.1';
  const port = opts.port && opts.port !== 0 ? opts.port : await findFreePort();
  const url = `http://${host}:${port}`;
  const dataDir = opts.dataDir
    ? (path.isAbsolute(opts.dataDir) ? opts.dataDir : path.join(APP_DIR, opts.dataDir))
    : undefined;
  const nodeExe = resolveNode(process.execPath, opts.env ? { ...process.env, ...opts.env } : process.env);
  const child = spawn(nodeExe, [path.join(APP_DIR, 'server', 'index.js')], {
    cwd: APP_DIR,
    windowsHide: true,
    env: {
      ...process.env,
      ...(opts.env || {}),
      NOVEL_PORT: String(port),
      NOVEL_HOST: host,
      NOVEL_NO_OPEN: '1',
      ...(dataDir ? { NOVEL_DATA: dataDir } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  child.on('error', (e) => { stderr += '\n[spawn error] ' + e.message; });

  const deadline = Date.now() + (opts.startTimeoutMs || DEFAULT_TIMEOUT);
  let up = false;
  while (Date.now() < deadline && child.exitCode === null) {
    up = await probeReady(url);
    if (up) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!up) {
    const msg = `NovelForge 启动失败（${url}）：\n${(stderr || stdout).slice(-800)}`;
    try { child.kill(); } catch { /* ignore */ }
    throw new Error(msg);
  }
  let stopped = false;
  const stop = () => new Promise((resolve) => {
    if (stopped || child.exitCode !== null) { stopped = true; return resolve(); }
    stopped = true;
    const killer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }, 3000);
    child.once('exit', () => { clearTimeout(killer); resolve(); });
    try { child.kill(); } catch { resolve(); }
  });
  return { child, url, stop, stdout: () => stdout, stderr: () => stderr };
}

// ---------------- Cordis 插件入口 ----------------

/** 宿主 logger 兼容封装：不同宿主方法集不同（有的只有 info 没有 log），
 *  依次尝试 scoped[候选方法]，都缺失则退回 console。 */
export function makeLogger(scoped) {
  const use = (method, fallbacks, args) => {
    for (const m of [method, ...fallbacks]) {
      if (scoped && typeof scoped[m] === 'function') {
        try { return scoped[m](...args); } catch { /* 继续回退 */ }
      }
    }
    const c = method === 'error' ? console.error : method === 'warn' ? console.warn : console.log;
    try { c('[novel-forge]', ...args); } catch { /* ignore */ }
  };
  return {
    log: (...a) => use('log', ['info', 'debug'], a),
    info: (...a) => use('info', ['log'], a),
    warn: (...a) => use('warn', [], a),
    error: (...a) => use('error', [], a),
  };
}

export function apply(ctx, config = {}) {
  const conf = config || {};
  const logger = makeLogger(typeof ctx.logger === 'function' ? ctx.logger(name) : null);
  let handle = null;

  const start = async () => {
    if (handle) return handle;
    try {
      logger.log('正在启动内嵌 NovelForge …（node=' + resolveNode() + '）');
      handle = await launchNovelForge({
        port: conf.port || 0,
        host: conf.host || '127.0.0.1',
        dataDir: conf.dataDir || null,
        startTimeoutMs: conf.startTimeoutMs || DEFAULT_TIMEOUT,
      });
      logger.log(`已就绪：${handle.url}（会话内可用 novel_forge_* 工具完成全部创作；网页界面仅为可选可视化编辑，无需打开）`);
      return handle;
    } catch (e) {
      handle = null;
      const msg = (e && e.message) || String(e);
      logger.error('启动失败：' + msg);
      try { console.error('[novel-forge] 启动失败：' + msg); } catch { /* ignore */ }
      throw e;
    }
  };

  const stop = async () => {
    if (!handle) return;
    const h = handle;
    handle = null;
    try { await h.stop(); logger.log('已停止'); } catch (e) { logger.warn('停止时出错：' + e.message); }
  };

  const service = {
    get url() { return handle ? handle.url : null; },
    get status() { return handle ? 'running' : 'stopped'; },
    start,
    stop,
    /** 返回服务信息；open 由宿主侧按 url 处理 */
    describe() {
      return {
        app: '织文 NovelForge',
        status: service.status,
        url: service.url,
        dataDir: conf.dataDir ? path.join(APP_DIR, String(conf.dataDir)) : path.join(APP_DIR, 'data'),
        logs: handle ? (handle.stderr() + handle.stdout()) : '',
      };
    },
  };

  // 以 cordis 方式注册服务（兼容无 provide 的宿主则直接挂到 ctx 上）
  try {
    if (typeof ctx.provide === 'function') ctx.provide('novelForge', service);
    else ctx.novelForge = service;
  } catch (e) {
    ctx.novelForge = service;
  }

  // 生命周期清理
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => { stop().catch(() => {}); });
  } else if (typeof ctx.on === 'function') {
    ctx.on('dispose', () => { stop().catch(() => {}); });
  }

  if (conf.autoStart !== false) {
    setTimeout(() => {
      start().catch((e) => {
        const m = (e && e.message) || String(e);
        logger.error('autoStart 详细错误：' + m);
        logger.warn('autoStart 失败，可调用 ctx.novelForge.start() 重试');
      });
    }, 0);
  }
}
