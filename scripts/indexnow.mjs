#!/usr/bin/env node
/**
 * IndexNow 推送脚本（手动执行，构建不会调用；未经站长批准不要做真实提交）
 *
 *   npm run indexnow:dry      干运行：对比 dist/sitemap.xml 与上次提交的记录，列出“将要提交”的 URL，不发送、不写任何文件
 *   npm run indexnow          只提交发生变化的 URL（新增 / lastmod 更新 / 已从 Sitemap 移除），成功后更新记录并写日志
 *
 *   node scripts/indexnow.mjs --urls https://jichang-zhinan.blog/rankings/2026/,https://jichang-zhinan.blog/reviews/flyv/
 *   node scripts/indexnow.mjs --file changed-urls.txt
 *   node scripts/indexnow.mjs --from-sitemap --since 2026-11-10    只提交 lastmod ≥ 指定日期的 URL
 *   node scripts/indexnow.mjs --from-sitemap --all                 全量提交（仅首次上线或更换 key 时使用）
 *
 * 选项：--dry-run  --host <域名>  --endpoint <地址>  --skip-key-check
 *
 * 规则（对应 IndexNow 官方约定）：
 *   - 只在 URL 新增、内容实质更新或被删除 / 移动时提交；没有变化就不提交，不要把全站反复推送。
 *   - 提交前先确认 https://<host>/<KEY>.txt 可以公开访问且内容等于 key，否则搜索引擎会拒绝（403）。
 *   - 每次真实提交都把时间、URL 数量、响应码与失败原因追加到 .indexnow/log.jsonl；
 *     每个 URL 上次提交时的 lastmod 记在 .indexnow/state.json，下次据此判断哪些页面变了。
 *   - 提交成功只代表搜索引擎“收到了通知”，不代表已抓取、已收录或有排名。
 *
 * 需要环境变量 INDEXNOW_KEY（与部署时写入 /<KEY>.txt 的值一致）；key 不写入仓库。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const HOST = val('--host') ?? 'jichang-zhinan.blog';
const ENDPOINT = val('--endpoint') ?? 'https://api.indexnow.org/indexnow';
const dryRun = has('--dry-run');
const key = (process.env.INDEXNOW_KEY ?? '').trim();
const stateDir = path.join(root, '.indexnow');
const stateFile = path.join(stateDir, 'state.json');
const logFile = path.join(stateDir, 'log.jsonl');

const explicit = !!val('--urls') || !!val('--file') || has('--from-sitemap');
const changedMode = has('--changed') || !explicit;

function readSitemap() {
  const sm = path.join(root, 'dist', 'sitemap.xml');
  if (!fs.existsSync(sm)) {
    console.error('[indexnow] dist/sitemap.xml 不存在，请先执行 npm run build');
    process.exit(1);
  }
  const xml = fs.readFileSync(sm, 'utf8');
  const map = new Map();
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g)) map.set(m[1].trim(), m[2]?.trim() ?? '');
  return map;
}
function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return s && typeof s.urls === 'object' ? s : { host: HOST, urls: {} };
  } catch {
    return { host: HOST, urls: {} };
  }
}
function appendLog(entry) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.appendFileSync(logFile, `${JSON.stringify({ time: new Date().toISOString(), host: HOST, endpoint: ENDPOINT, ...entry })}\n`, 'utf8');
}

/* ---------------- 确定要提交的 URL ---------------- */
let urls = [];
let mode = 'manual';
let detail = { added: [], updated: [], removed: [] };
const sitemap = changedMode || has('--from-sitemap') ? readSitemap() : null;
const state = readState();

if (changedMode) {
  mode = 'changed';
  for (const [u, lastmod] of sitemap) {
    const prev = state.urls[u];
    if (!prev) detail.added.push(u);
    else if (lastmod && prev.lastmod && lastmod > prev.lastmod) detail.updated.push(u);
    else if (lastmod && !prev.lastmod) detail.updated.push(u);
  }
  // 上次提交过、现在已不在 Sitemap 里的地址（删除或改了 URL）：也要通知搜索引擎重新抓取
  for (const u of Object.keys(state.urls)) if (!sitemap.has(u)) detail.removed.push(u);
  urls = [...detail.added, ...detail.updated, ...detail.removed];
} else {
  if (val('--urls')) urls = val('--urls').split(',').map((s) => s.trim()).filter(Boolean);
  if (val('--file')) urls.push(...fs.readFileSync(path.resolve(val('--file')), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#')));
  if (has('--from-sitemap')) {
    const since = val('--since');
    if (!since && !has('--all')) {
      console.error('[indexnow] --from-sitemap 需要配合 --since <日期> 或 --all。日常更新请直接用 npm run indexnow（只提交变化的 URL）。');
      process.exit(1);
    }
    mode = since ? `sitemap-since-${since}` : 'sitemap-all';
    if (!since) console.warn('[indexnow] 注意：将提交 Sitemap 中的全部 URL。只应在首次上线或更换 key 时这样做。');
    for (const [u, lastmod] of sitemap) {
      if (since && lastmod && lastmod < since) continue;
      urls.push(u);
    }
  }
}

urls = [...new Set(urls)].filter((u) => {
  try {
    if (new URL(u).host !== HOST) {
      console.warn(`[indexnow] 跳过非本站 URL：${u}`);
      return false;
    }
    return true;
  } catch {
    console.warn(`[indexnow] 跳过非法 URL：${u}`);
    return false;
  }
});

console.log(`[indexnow] 模式：${mode}；端点：${ENDPOINT}`);
if (mode === 'changed') {
  console.log(`[indexnow] 与上次提交记录相比：新增 ${detail.added.length}，更新 ${detail.updated.length}，移除 ${detail.removed.length}（记录中已有 ${Object.keys(state.urls).length} 个 URL）`);
}
if (urls.length === 0) {
  console.log(mode === 'changed' ? '[indexnow] 没有发生变化的 URL，不提交。' : '[indexnow] 没有可提交的 URL。用 --urls / --file / --from-sitemap 指定。');
  process.exit(mode === 'changed' ? 0 : 1);
}
if (urls.length > 10000) {
  console.error('[indexnow] 单次最多 10000 个 URL');
  process.exit(1);
}

const payload = {
  host: HOST,
  key: key || '<INDEXNOW_KEY 未设置>',
  keyLocation: `https://${HOST}/${key || '<KEY>'}.txt`,
  urlList: urls,
};
console.log(`[indexnow] URL 数量：${urls.length}`);

if (dryRun) {
  console.log('[indexnow] 干运行，不发送、不写记录。将提交：');
  for (const [label, list] of [['新增', detail.added], ['更新', detail.updated], ['移除', detail.removed]]) {
    if (list.length) console.log(`  ${label} ${list.length}：\n${list.map((u) => `    ${u}`).join('\n')}`);
  }
  if (mode !== 'changed') console.log(urls.map((u) => `    ${u}`).join('\n'));
  console.log(`[indexnow] key：${key ? `${key.slice(0, 4)}…（已设置）` : '未设置（真实提交前需要设置 INDEXNOW_KEY）'}`);
  process.exit(0);
}

if (!key) {
  console.error('[indexnow] 缺少 INDEXNOW_KEY 环境变量；请先设置，或使用 --dry-run 预览。');
  process.exit(1);
}
if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  console.error('[indexnow] INDEXNOW_KEY 格式非法：需 8–128 位，仅含字母、数字与短横线');
  process.exit(1);
}

/* ---------------- 提交前：key 文件是否可公开访问 ---------------- */
let keyCheck = { skipped: true };
if (!has('--skip-key-check')) {
  try {
    const r = await fetch(payload.keyLocation, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const body = r.ok ? (await r.text()).trim() : '';
    keyCheck = { status: r.status, ok: r.ok && body === key };
  } catch (e) {
    keyCheck = { ok: false, error: e.cause?.code ?? e.name ?? String(e) };
  }
  if (!keyCheck.ok) {
    const reason = keyCheck.error ? `请求失败（${keyCheck.error}）` : keyCheck.status !== 200 ? `返回 ${keyCheck.status}` : '文件内容与 key 不一致';
    console.error(`[indexnow] key 文件校验未通过：${payload.keyLocation.replace(key, `${key.slice(0, 4)}…`)} ${reason}。`);
    console.error('[indexnow] 请确认站点已部署、Cloudflare Pages 环境变量 INDEXNOW_KEY 与本机一致，然后重试。未提交。');
    appendLog({ mode, count: urls.length, ok: false, stage: 'key-check', keyCheck, error: reason });
    process.exit(1);
  }
}

/* ---------------- 提交 ---------------- */
let res;
let text = '';
try {
  res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  text = await res.text();
} catch (e) {
  const error = e.cause?.code ?? e.name ?? String(e);
  console.error(`[indexnow] 请求失败：${error}。未提交，记录未更新。`);
  appendLog({ mode, count: urls.length, ok: false, stage: 'submit', keyCheck, error });
  process.exit(1);
}
const meaning =
  {
    200: '成功：URL 已提交',
    202: '已接受：key 校验稍后进行',
    400: '请求格式错误',
    403: 'key 无效（检查 /<KEY>.txt 是否可访问且内容一致）',
    422: 'URL 不属于该 host 或 key 与 host 不匹配',
    429: '请求过多，稍后重试',
  }[res.status] ?? '未知状态';
console.log(`[indexnow] HTTP ${res.status} — ${meaning}${text ? `\n${text}` : ''}`);
appendLog({ mode, count: urls.length, added: detail.added.length, updated: detail.updated.length, removed: detail.removed.length, ok: res.ok, status: res.status, meaning, keyCheck, ...(res.ok ? {} : { error: text.slice(0, 300) || meaning }) });

if (res.ok) {
  // 只有提交被接受后才更新记录，失败时下次仍会重试这些 URL
  const now = new Date().toISOString();
  const lastmodOf = (u) => (sitemap ?? new Map()).get(u) ?? state.urls[u]?.lastmod ?? '';
  for (const u of urls) {
    if (detail.removed.includes(u)) delete state.urls[u];
    else state.urls[u] = { lastmod: lastmodOf(u), submittedAt: now };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify({ host: HOST, updatedAt: now, urls: Object.fromEntries(Object.entries(state.urls).sort()) }, null, 2)}\n`, 'utf8');
  console.log('[indexnow] 已更新 .indexnow/state.json 并追加 .indexnow/log.jsonl（请一并提交到仓库，作为提交记录）。');
}
console.log('[indexnow] 提示：提交成功 ≠ 已收录；请在 Bing Webmaster Tools 的 IndexNow 面板与 URL 检查中观察。');
process.exit(res.ok ? 0 : 1);
