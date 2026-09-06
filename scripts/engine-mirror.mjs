// engine-mirror.mjs —— NovelForge 双仓库「引擎镜像」工具（分仓库单一来源）
// 职责：
//   novel-forge（独立版，引擎唯一真源）  →  novel-forge-plugin/app（插件版内嵌引擎镜像）
//   verify：逐文件 SHA-256 对比两仓库 server/ 与 public/，输出差异清单（退出码 0=一致）
//   sync  ：把独立版 server/ public/ 全量同步进插件 app/（不触碰 data/），随后自动 verify
// 用法：
//   node scripts/engine-mirror.mjs verify [--src ..\novel-forge] [--dst ..]
//   node scripts/engine-mirror.mjs sync   [--src ..\novel-forge] [--dst ..]
// 默认：src=本仓库上一级的 novel-forge；dst=本仓库根（dst/server dst/public）
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const cmd = (args[0] || 'verify').toLowerCase();
const argVal = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const SRC = path.resolve(argVal('--src') || path.join(PLUGIN, '..', 'novel-forge'));
const DST = path.resolve(argVal('--dst') || path.join(PLUGIN, 'app'));
const SCOPES = ['server', 'public'];
const log = (...a) => console.log(...a);

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
}
function walk(dir, base, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['data', 'node_modules', '.git'].includes(f.name)) continue;
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walk(full, base, out);
    else out.push({ rel: path.relative(base, full).replace(/\\/g, '/'), full });
  }
  return out;
}
function snapshot(root) {
  const map = new Map();
  for (const scope of SCOPES) {
    const dir = path.join(root, scope);
    if (!fs.existsSync(dir)) continue;
    for (const { rel, full } of walk(dir, dir)) map.set(scope + '/' + rel, sha256(full));
  }
  return map;
}

function compare() {
  const a = snapshot(SRC);
  const b = snapshot(DST);
  const issues = [];
  for (const key of [...a.keys()].sort()) {
    if (!b.has(key)) issues.push(`[仅源有] ${key}`);
    else if (b.get(key) !== a.get(key)) issues.push(`[内容不同] ${key}  src=${a.get(key)} dst=${b.get(key)}`);
  }
  for (const key of [...b.keys()].sort()) if (!a.has(key)) issues.push(`[仅插件有] ${key}`);
  return { aCount: a.size, bCount: b.size, issues };
}

function sync() {
  log(`同步引擎：${SRC}  →  ${DST}`);
  for (const scope of SCOPES) {
    const srcDir = path.join(SRC, scope);
    const dstDir = path.join(DST, scope);
    if (!fs.existsSync(srcDir)) { log('跳过缺失目录：' + srcDir); continue; }
    fs.rmSync(dstDir, { recursive: true, force: true });
    fs.mkdirSync(dstDir, { recursive: true });
    for (const { rel, full } of walk(srcDir, srcDir)) {
      const target = path.join(dstDir, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(full, target);
    }
    log(`  · ${scope}/ 已同步（${walk(srcDir, srcDir).length} 个文件）`);
  }
  fs.writeFileSync(path.join(PLUGIN, 'engine-mirror.json'), JSON.stringify({
    tool: 'novel-forge engine mirror',
    note: '独立版(novel-forge)为引擎唯一真源；插件版 app/server、app/public 由本文件同步生成，勿手改。',
    srcRoot: SRC,
    syncedAt: new Date().toISOString(),
  }, null, 2), 'utf8');
  log('  · engine-mirror.json 已记录');
}

try {
  if (!fs.existsSync(path.join(SRC, 'server', 'index.js'))) throw new Error('源目录不是 novel-forge：' + SRC);
  if (cmd === 'sync') { sync(); log(''); }
  if (!['verify', 'sync'].includes(cmd)) throw new Error('未知命令（verify|sync）：' + cmd);
  const r = compare();
  log(`引擎镜像校验：源 ${r.aCount} 文件 vs 插件 ${r.bCount} 文件`);
  if (r.issues.length) {
    log(`发现 ${r.issues.length} 处漂移：`);
    r.issues.slice(0, 60).forEach((x) => log('  ' + x));
    if (r.issues.length > 60) log('  …（其余略）');
    process.exit(1);
  }
  log('✓ 引擎镜像一致，零漂移。');
  process.exit(0);
} catch (e) {
  log('✗ ' + e.message);
  process.exit(2);
}
