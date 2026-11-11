#!/usr/bin/env node
/**
 * SEO 自动审计（构建后自动执行：npm run seo:audit）
 * 扫描 dist/ 中的全部 HTML：
 *  - lang、唯一 title / description、单一 H1、标题层级
 *  - canonical 存在且自引用（可索引页）
 *  - robots noindex 与 sitemap 一致；sitemap 中的 URL 必须真实存在
 *  - robots.txt 引用的 Sitemap 必须是真实构建输出
 *  - 站内链接不得死链；孤岛页检测
 *  - 图片 alt、JSON-LD 可解析、日期不得为未来
 *  - 文章页正文长度、演示/占位数据
 * 任何 error 使进程以 1 退出（--warn-only 可降级）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const SITE = 'https://jichang-zhinan.blog';
const warnOnly = process.argv.includes('--warn-only');
// “今天”按北京时间算：站内日期都是北京时间，而构建机（Cloudflare）在 UTC 时区。
// 用 UTC 日期的话，北京时间 0–8 点之间构建会把当天的内容误判为“未来日期”而失败
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

if (!fs.existsSync(dist)) {
  console.error('[seo-audit] dist 不存在，请先构建');
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}
const files = walk(dist);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const toUrlPath = (file) => {
  let rel = path.relative(dist, file).replace(/\\/g, '/');
  if (rel.endsWith('/index.html')) rel = rel.slice(0, -'index.html'.length);
  else if (rel === 'index.html') rel = '';
  return `/${rel}`;
};
const existsForPath = (p) => {
  const clean = p.split('#')[0].split('?')[0];
  if (clean === '/') return fs.existsSync(path.join(dist, 'index.html'));
  const rel = clean.replace(/^\//, '');
  if (clean.endsWith('/')) return fs.existsSync(path.join(dist, rel, 'index.html'));
  if (fs.existsSync(path.join(dist, rel))) return true;
  // 无尾斜杠的目录路径视为不规范
  return false;
};

const DEMO_STRINGS = ['飞云机场', '星链机场', '极光机场', '云帆机场', '速影机场', '9.7/10', '12,368', 'Lorem ipsum', 'lorem ipsum', 'TODO', '待填写'];
const titles = new Map();
const descriptions = new Map();
const inbound = new Map();
const indexable = new Set();
const noindexPages = new Set();
const pages = [];

for (const file of htmlFiles) {
  const urlPath = toUrlPath(file);
  const html = fs.readFileSync(file, 'utf8');
  const doc = parse(html);
  const is404 = urlPath === '/404.html';
  const tag = urlPath;

  const htmlEl = doc.querySelector('html');
  if (htmlEl?.getAttribute('lang') !== 'zh-CN') err(`${tag}: <html lang> 应为 zh-CN`);

  // 只统计 <head> 内的 <title>，SVG 内的 <title> 是无障碍标签，不是页面标题
  const titleEls = (doc.querySelector('head')?.querySelectorAll('title') ?? []).filter((t) => !t.closest('svg'));
  const title = titleEls[0]?.text.trim() ?? '';
  if (titleEls.length !== 1 || !title) err(`${tag}: title 缺失或多个`);
  if (title.length > 72) warn(`${tag}: title 过长（${title.length} 字符）`);
  if (title.length && title.length < 10) warn(`${tag}: title 过短`);

  const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';
  if (!desc) err(`${tag}: 缺少 meta description`);
  else {
    if (desc.length < 50) warn(`${tag}: description 过短（${desc.length} 字符）`);
    if (desc.length > 230) warn(`${tag}: description 过长（${desc.length} 字符）`);
  }

  const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';
  const noindex = /noindex/i.test(robots);
  if (is404 && !noindex) err(`${tag}: 404 页必须 noindex`);
  if (noindex) noindexPages.add(urlPath);
  else indexable.add(urlPath);

  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
  // noindex 页面（404、站内搜索）允许不设 canonical
  if (!canonical && !noindex) err(`${tag}: 缺少 canonical`);
  else if (canonical && !noindex && canonical !== `${SITE}${urlPath}`) err(`${tag}: canonical=${canonical} 与页面 URL 不一致`);
  if (canonical && !canonical.startsWith(SITE)) err(`${tag}: canonical 不是本站绝对 URL`);
  if (canonical) {
    const cPath = canonical.replace(SITE, '');
    if (!existsForPath(cPath)) err(`${tag}: canonical 指向不存在的页面 ${cPath}`);
  }

  const h1s = doc.querySelectorAll('h1');
  if (h1s.length !== 1) err(`${tag}: H1 数量为 ${h1s.length}（应为 1）`);
  const headings = doc.querySelectorAll('h1,h2,h3,h4').map((h) => Number(h.tagName.slice(1)));
  for (let i = 1; i < headings.length; i++) if (headings[i] - headings[i - 1] > 1) warn(`${tag}: 标题层级跳跃 h${headings[i - 1]} → h${headings[i]}`);

  if (!noindex) {
    if (titles.has(title)) err(`${tag}: title 与 ${titles.get(title)} 重复`);
    else titles.set(title, urlPath);
    if (desc) {
      if (descriptions.has(desc)) err(`${tag}: description 与 ${descriptions.get(desc)} 重复`);
      else descriptions.set(desc, urlPath);
    }
  }

  // og / twitter
  const requiredOg = noindex ? ['og:title', 'og:description', 'og:image'] : ['og:title', 'og:description', 'og:url', 'og:image'];
  for (const prop of requiredOg) if (!doc.querySelector(`meta[property="${prop}"]`)) err(`${tag}: 缺少 ${prop}`);
  const ogUrl = doc.querySelector('meta[property="og:url"]')?.getAttribute('content');
  if (ogUrl && canonical && ogUrl !== canonical) err(`${tag}: og:url 与 canonical 不一致`);

  // 图片 alt
  for (const img of doc.querySelectorAll('img')) {
    if (img.getAttribute('alt') === undefined) err(`${tag}: <img src="${img.getAttribute('src')}"> 缺少 alt`);
    const src = img.getAttribute('src') ?? '';
    if (src.startsWith('/') && !existsForPath(src)) err(`${tag}: 图片不存在 ${src}`);
    if (!img.getAttribute('loading') && !/hero|logo/.test(img.getAttribute('class') ?? '')) warn(`${tag}: 图片未设置 loading 属性 ${src}`);
  }

  // 链接
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('/') && !href.startsWith('//')) {
      const clean = href.split('#')[0].split('?')[0];
      if (!clean) continue;
      if (!existsForPath(clean)) err(`${tag}: 死链 ${href}`);
      else {
        if (!clean.endsWith('/') && !/\.[a-z0-9]+$/i.test(clean)) warn(`${tag}: 链接缺少尾部斜杠 ${href}`);
        const key = clean.endsWith('/') || /\.[a-z0-9]+$/i.test(clean) ? clean : `${clean}/`;
        if (key !== urlPath) inbound.set(key, (inbound.get(key) ?? 0) + 1);
      }
    } else if (/^https?:\/\//.test(href) && !href.startsWith(SITE)) {
      const rel = a.getAttribute('rel') ?? '';
      if (!/noopener/.test(rel) && a.getAttribute('target') === '_blank') warn(`${tag}: 外链缺少 rel=noopener ${href}`);
    }
    if (!a.text.trim() && !a.getAttribute('aria-label') && !a.querySelector('img[alt]') && a.getAttribute('tabindex') !== '-1') warn(`${tag}: 空链接文本 ${href}`);
  }

  // JSON-LD
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.text);
      const str = JSON.stringify(data);
      for (const m of str.matchAll(/"(datePublished|dateModified)":"(\d{4}-\d{2}-\d{2})/g)) if (m[2] > today) err(`${tag}: JSON-LD ${m[1]}=${m[2]} 为未来日期`);
      if (/"aggregateRating"|"ratingValue"/.test(str)) err(`${tag}: JSON-LD 含评分字段（本站禁止）`);
    } catch (e) {
      err(`${tag}: JSON-LD 解析失败 ${e.message}`);
    }
  }

  // time 元素日期
  for (const t of doc.querySelectorAll('time[datetime]')) {
    const d = t.getAttribute('datetime') ?? '';
    if (/^\d{4}-\d{2}-\d{2}/.test(d) && d.slice(0, 10) > today) err(`${tag}: <time datetime="${d}"> 为未来日期`);
  }

  // 正文长度（文章/品牌/报告页）
  const bodyText = (doc.querySelector('main')?.text ?? '').replace(/\s+/g, '');
  const isArticle = /^\/(tutorials|guides|wiki|news)\/[^/]+\/$/.test(urlPath);
  if (isArticle) {
    const prose = (doc.querySelector('.prose')?.text ?? '').replace(/\s+/g, '');
    if (prose.length < 800) err(`${tag}: 文章正文过短（${prose.length} 字）`);
  }
  if (!noindex && bodyText.length < 300) warn(`${tag}: 页面正文内容偏少（${bodyText.length} 字）`);

  for (const d of DEMO_STRINGS) if (html.includes(d)) err(`${tag}: 页面含演示/占位字符串 "${d}"`);

  pages.push({
    urlPath,
    noindex,
    // 页脚的“全站内容最近更新”与页面自己标出的“内容更新”，稍后与 Sitemap 的 lastmod 核对
    siteUpdated: doc.querySelector('time[data-site-updated]')?.getAttribute('datetime') ?? null,
    pageUpdated: doc.querySelector('time[data-page-updated]')?.getAttribute('datetime') ?? null,
  });
}

/* ---------------- sitemap & robots ---------------- */
const robotsPath = path.join(dist, 'robots.txt');
let sitemapFile = null;
if (!fs.existsSync(robotsPath)) err('robots.txt 不存在');
else {
  const robots = fs.readFileSync(robotsPath, 'utf8');
  const lines = robots.split(/\r?\n/).filter((l) => /^sitemap:/i.test(l.trim()));
  if (lines.length === 0) err('robots.txt 未声明 Sitemap');
  for (const l of lines) {
    const url = l.split(/:\s*/).slice(1).join(':').trim();
    if (!url.startsWith(SITE)) err(`robots.txt Sitemap 不是本站绝对 URL：${url}`);
    const rel = url.replace(SITE, '').replace(/^\//, '');
    if (!fs.existsSync(path.join(dist, rel))) err(`robots.txt 引用的 Sitemap 文件不存在于构建输出：${rel}`);
    else sitemapFile = path.join(dist, rel);
  }
  if (/disallow:\s*\/_astro/i.test(robots)) err('robots.txt 屏蔽了 /_astro/（CSS/JS 不得屏蔽）');
}
if (sitemapFile) {
  const xml = fs.readFileSync(sitemapFile, 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1].trim());
  for (const lm of lastmods) if (lm.slice(0, 10) > today) err(`sitemap: lastmod ${lm} 为未来日期`);
  const sitemapPaths = new Set();
  for (const loc of locs) {
    if (!loc.startsWith(SITE)) err(`sitemap: 非本站 URL ${loc}`);
    const p = loc.replace(SITE, '');
    sitemapPaths.add(p);
    if (!existsForPath(p)) err(`sitemap: URL 不存在于构建输出 ${p}`);
    if (noindexPages.has(p)) err(`sitemap: 包含 noindex 页面 ${p}`);
    if (!p.endsWith('/')) err(`sitemap: URL 缺少尾部斜杠 ${p}`);
  }
  for (const p of indexable) if (!sitemapPaths.has(p)) err(`sitemap: 可索引页面未收录 ${p}`);
  if (new Set(locs).size !== locs.length) err('sitemap: 存在重复 URL');

  /* 页面上显示的更新日期必须与 Sitemap 一致（两者同出 src/lib/lastmod.ts）：
     - 页脚的“全站内容最近更新”= Sitemap 中最大的 lastmod，每个页面都相同；
     - 页面自己标出的“内容更新”（time[data-page-updated]）= 该页在 Sitemap 中的 lastmod。
     这样页面上不可能出现随构建或访问变化、与真实内容日期脱节的“更新日期”。 */
  const lastmodByPath = new Map(locs.map((loc, i) => [loc.replace(SITE, ''), lastmods[i]]));
  const maxLastmod = [...lastmods].sort().at(-1) ?? null;
  const footerDates = new Map();
  for (const p of pages) {
    const key = p.siteUpdated ?? '(缺失)';
    if (!footerDates.has(key)) footerDates.set(key, []);
    footerDates.get(key).push(p.urlPath);
    if (p.pageUpdated && lastmodByPath.has(p.urlPath) && p.pageUpdated !== lastmodByPath.get(p.urlPath)) {
      err(`${p.urlPath}: 页面显示的内容更新日期 ${p.pageUpdated} 与 Sitemap lastmod ${lastmodByPath.get(p.urlPath)} 不一致`);
    }
  }
  for (const [date, list] of footerDates) {
    if (date !== maxLastmod) err(`页脚“全站内容最近更新”为 ${date}，应等于 Sitemap 中最大的 lastmod ${maxLastmod}（${list.length} 个页面，如 ${list[0]}）`);
  }
}

/* ---------------- 孤岛页 ---------------- */
for (const p of indexable) {
  if (p === '/') continue;
  if (!inbound.get(p)) warn(`孤岛页（无站内链接指向）：${p}`);
}

/* ---------------- 其他文件 ---------------- */
for (const f of ['404.html', 'rss.xml', 'search-index.json', 'favicon.svg', 'images/og-default.png', '_headers']) {
  if (!fs.existsSync(path.join(dist, f))) err(`缺少构建输出 ${f}`);
}

const summary = `[seo-audit] 页面 ${htmlFiles.length}（可索引 ${indexable.size}，noindex ${noindexPages.size}）；错误 ${errors.length}，警告 ${warnings.length}`;
for (const w of warnings) console.warn('[seo-audit] 警告：', w);
for (const e of errors) console.error('[seo-audit] 错误：', e);
console.log(summary);
fs.writeFileSync(path.join(root, 'seo-audit-report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), pages: htmlFiles.length, indexable: indexable.size, noindex: noindexPages.size, errors, warnings }, null, 2));
if (errors.length && !warnOnly) process.exit(1);
