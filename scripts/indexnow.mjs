#!/usr/bin/env node
/**
 * IndexNow 推送脚本（手动执行，构建不会调用）
 *
 *   npm run indexnow:dry                      # 干运行：从 dist/sitemap.xml 读取 URL，只打印 payload
 *   node scripts/indexnow.mjs --urls https://jichang-zhinan.blog/rankings/2026/,https://jichang-zhinan.blog/reviews/flyv/
 *   node scripts/indexnow.mjs --file changed-urls.txt
 *   node scripts/indexnow.mjs --from-sitemap --since 2026-11-10   # 只提交 lastmod ≥ 指定日期的 URL
 *
 * 需要环境变量 INDEXNOW_KEY（与部署时写入 /<KEY>.txt 的值一致）。
 * 只在真实发布 / 更改 / 删除 URL 时提交；不要把全站 URL 反复提交。
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

let urls = [];
if (val('--urls')) urls = val('--urls').split(',').map((s) => s.trim()).filter(Boolean);
if (val('--file')) urls.push(...fs.readFileSync(path.resolve(val('--file')), 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#')));
if (has('--from-sitemap')) {
  const sm = path.join(root, 'dist', 'sitemap.xml');
  if (!fs.existsSync(sm)) {
    console.error('[indexnow] dist/sitemap.xml 不存在，请先执行 npm run build');
    process.exit(1);
  }
  const xml = fs.readFileSync(sm, 'utf8');
  const since = val('--since');
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g)) {
    if (since && m[2] && m[2] < since) continue;
    urls.push(m[1].trim());
  }
}
urls = [...new Set(urls)].filter((u) => {
  try {
    const h = new URL(u).host;
    if (h !== HOST) {
      console.warn(`[indexnow] 跳过非本站 URL：${u}`);
      return false;
    }
    return true;
  } catch {
    console.warn(`[indexnow] 跳过非法 URL：${u}`);
    return false;
  }
});

if (urls.length === 0) {
  console.error('[indexnow] 没有可提交的 URL。用 --urls / --file / --from-sitemap 指定。');
  process.exit(1);
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

console.log(`[indexnow] 端点：${ENDPOINT}`);
console.log(`[indexnow] URL 数量：${urls.length}`);
if (dryRun) {
  console.log('[indexnow] 干运行，不发送。payload：');
  console.log(JSON.stringify({ ...payload, key: key ? `${key.slice(0, 4)}…` : payload.key }, null, 2));
  process.exit(0);
}
if (!key) {
  console.error('[indexnow] 缺少 INDEXNOW_KEY 环境变量；请先设置，或使用 --dry-run 预览。');
  process.exit(1);
}
if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  console.error('[indexnow] INDEXNOW_KEY 格式非法');
  process.exit(1);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});
const text = await res.text();
const meaning = {
  200: '成功：URL 已提交',
  202: '已接受：key 校验稍后进行',
  400: '请求格式错误',
  403: 'key 无效（检查 /<KEY>.txt 是否可访问且内容一致）',
  422: 'URL 不属于该 host 或 key 与 host 不匹配',
  429: '请求过多，稍后重试',
}[res.status] ?? '未知状态';
console.log(`[indexnow] HTTP ${res.status} — ${meaning}${text ? `\n${text}` : ''}`);
console.log('[indexnow] 提示：提交成功 ≠ 已收录；请在 Bing Webmaster Tools 的 IndexNow 面板与 URL 检查中观察。');
process.exit(res.ok ? 0 : 1);
