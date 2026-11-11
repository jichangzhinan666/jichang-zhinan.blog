#!/usr/bin/env node
/**
 * SEO 深度审计（面向 Bing）：在构建后的 dist 上逐页检查，并可选地核对线上域名。
 *
 *   node scripts/seo-deep-audit.mjs            只审计本地构建（dist）
 *   node scripts/seo-deep-audit.mjs --live     另外请求线上域名的每个 URL（上线后使用）
 *   node scripts/seo-deep-audit.mjs --csv URL-INDEX-AUDIT.csv --out seo-deep-audit.json
 *
 * 检查内容：
 *   - 每页：title / description / canonical / robots / H1–H3 / 正文字数 / 图片 alt / OG / 语言声明
 *   - 结构化数据：JSON-LD 语法、各类型的必要字段、FAQ 与页面可见内容是否一致、是否含评分
 *   - Sitemap：结构、重复、是否全部为 200 的规范 URL、与可索引页面是否一一对应、lastmod
 *   - 站内链接图：每页的入链页面数、正文内入链数、距首页的点击深度、孤立页、锚文本
 *   - 内容重复度：同类页面两两之间的 5 字片段重合率（Jaccard）
 *   - robots.txt、_headers、_redirects 规则
 *   - --live：DNS、HTTPS、HTTP→HTTPS、www、每个 URL 的状态码 / X-Robots-Tag / 以 Bingbot UA 的响应
 *
 * 只读：不修改任何文件（除写出报告），不提交 IndexNow。与构建时的 seo-audit.mjs 互补，不替代它。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import dns from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const SITE = 'https://jichang-zhinan.blog';
const HOST = 'jichang-zhinan.blog';
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const live = has('--live');
const outFile = path.resolve(root, val('--out', 'seo-deep-audit.json'));
const csvFile = path.resolve(root, val('--csv', 'URL-INDEX-AUDIT.csv'));
const today = new Date().toISOString().slice(0, 10);

if (!fs.existsSync(dist)) {
  console.error('[seo-deep] dist 不存在，请先 npm run build');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */
const issues = [];
const issue = (sev, code, url, msg) => issues.push({ sev, code, url, msg });
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
/** 显示宽度：全角字符记 2，其余记 1（用于估计搜索结果里标题是否会被截断） */
const displayWidth = (s) => [...s].reduce((n, ch) => n + (/[⺀-鿿＀-￯　-〿]/.test(ch) ? 2 : 1), 0);
/** 正文字数：汉字按字计，拉丁词按词计 */
const wordCount = (s) => (s.match(/[一-鿿]/g) || []).length + (s.match(/[A-Za-z0-9]+(?:[.\-/][A-Za-z0-9]+)*/g) || []).length;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}
const toUrlPath = (file) => {
  let rel = path.relative(dist, file).replace(/\\/g, '/');
  if (rel.endsWith('/index.html')) rel = rel.slice(0, -'index.html'.length);
  else if (rel === 'index.html') rel = '';
  return `/${rel}`;
};
const existsForPath = (p) => {
  const clean = p.split('#')[0].split('?')[0];
  if (clean === '/') return fs.existsSync(path.join(dist, 'index.html'));
  const rel = decodeURIComponent(clean.replace(/^\//, ''));
  if (clean.endsWith('/')) return fs.existsSync(path.join(dist, rel, 'index.html'));
  return fs.existsSync(path.join(dist, rel));
};
function pageType(p) {
  if (p === '/') return '首页';
  if (p === '/404.html') return '404 页';
  if (p === '/rankings/' || p === '/rankings/2026/') return '榜单';
  if (p === '/reviews/') return '品牌资料库';
  if (/^\/reviews\/[^/]+\/$/.test(p)) return '品牌详情';
  if (p === '/compare/') return '套餐对比';
  if (p === '/speed-tests/') return '测速索引';
  if (/^\/speed-tests\/[^/]+\/$/.test(p)) return '测速报告';
  if (/^\/(tutorials|guides|wiki|news)\/$/.test(p)) return '栏目页';
  if (/^\/tutorials\/[^/]+\/$/.test(p)) return '教程文章';
  if (/^\/guides\/[^/]+\/$/.test(p)) return '指南文章';
  if (/^\/wiki\/[^/]+\/$/.test(p)) return '百科文章';
  if (/^\/news\/[^/]+\/$/.test(p)) return '资讯文章';
  if (['/search/', '/me/'].includes(p)) return '功能页（不索引）';
  if (p === '/author/') return '作者页';
  return '说明页';
}

/* ------------------------------------------------------------------ */
/* 1. 逐页解析                                                         */
/* ------------------------------------------------------------------ */
const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
const pages = [];
const byPath = new Map();

for (const file of htmlFiles) {
  const urlPath = toUrlPath(file);
  const html = fs.readFileSync(file, 'utf8');
  const doc = parse(html);
  const head = doc.querySelector('head');
  const main = doc.querySelector('main') ?? doc;
  const meta = (sel, attr = 'content') => doc.querySelector(sel)?.getAttribute(attr) ?? null;

  const title = norm((head?.querySelectorAll('title') ?? []).filter((t) => !t.closest('svg'))[0]?.text);
  const description = meta('meta[name="description"]') ?? '';
  const robots = meta('meta[name="robots"]') ?? '';
  const canonical = meta('link[rel="canonical"]', 'href');
  const noindex = /noindex/i.test(robots);
  const h1 = doc.querySelectorAll('h1').map((h) => norm(h.text));
  const h2 = main.querySelectorAll('h2').map((h) => norm(h.text));
  const h3 = main.querySelectorAll('h3').map((h) => norm(h.text));

  // 正文文字：去掉脚本、样式与图标
  const mainClone = parse(main.toString());
  for (const el of mainClone.querySelectorAll('script,style,svg,noscript')) el.remove();
  const mainText = norm(mainClone.text);

  const imgs = doc.querySelectorAll('img');
  const jsonld = [];
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.text);
      jsonld.push(...(data['@graph'] ?? [data]));
    } catch (e) {
      issue('P1', 'jsonld-parse', urlPath, `JSON-LD 解析失败：${e.message}`);
    }
  }

  // 链接：区分页头 / 页脚导航与正文
  const links = [];
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') ?? '';
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;
    const target = clean.endsWith('/') || /\.[a-z0-9]+$/i.test(clean) ? clean : `${clean}/`;
    const inMain = !!a.closest('main');
    links.push({ target, anchor: norm(a.text) || a.getAttribute('aria-label') || '', inMain, rel: a.getAttribute('rel') ?? '' });
  }
  const external = doc
    .querySelectorAll('a[href]')
    .filter((a) => /^https?:\/\//.test(a.getAttribute('href') ?? '') && !(a.getAttribute('href') ?? '').startsWith(SITE))
    .map((a) => ({ href: a.getAttribute('href'), rel: a.getAttribute('rel') ?? '', target: a.getAttribute('target') ?? '' }));

  const page = {
    urlPath,
    type: pageType(urlPath),
    title,
    titleLen: [...title].length,
    titleWidth: displayWidth(title),
    description,
    descLen: [...description].length,
    robots,
    noindex,
    canonical,
    lang: doc.querySelector('html')?.getAttribute('lang') ?? null,
    contentLanguage: meta('meta[http-equiv="content-language"]'),
    og: Object.fromEntries(['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:locale', 'og:site_name'].map((p) => [p, meta(`meta[property="${p}"]`)])),
    articleTimes: { published: meta('meta[property="article:published_time"]'), modified: meta('meta[property="article:modified_time"]') },
    h1,
    h2,
    h3,
    words: wordCount(mainText),
    mainText,
    imgCount: imgs.length,
    imgNoAlt: imgs.filter((i) => i.getAttribute('alt') === undefined).length,
    imgEmptyAlt: imgs.filter((i) => i.getAttribute('alt') === '').length,
    jsonld,
    jsonldTypes: [...new Set(jsonld.map((n) => [].concat(n['@type'] ?? []).join('+')))],
    hasBreadcrumbNav: !!doc.querySelector('nav.breadcrumbs, nav[aria-label*="面包屑"], .breadcrumbs'),
    links,
    external,
    htmlBytes: Buffer.byteLength(html),
    scriptsExternal: doc.querySelectorAll('script[src]').map((s) => s.getAttribute('src')),
    inlineScriptBytes: doc.querySelectorAll('script:not([src]):not([type="application/ld+json"])').reduce((n, s) => n + Buffer.byteLength(s.text), 0),
    stylesheets: doc.querySelectorAll('link[rel="stylesheet"]').map((l) => l.getAttribute('href')),
    faqVisible: doc.querySelectorAll('details.faq-item summary').map((s) => norm(s.text)),
  };
  pages.push(page);
  byPath.set(urlPath, page);
}

/* ------------------------------------------------------------------ */
/* 2. Sitemap、robots、RSS、_headers、_redirects                       */
/* ------------------------------------------------------------------ */
const site = { sitemap: {}, robots: {}, rss: {}, headers: {}, redirects: [] };
const sitemapMap = new Map();
{
  const robotsTxt = fs.existsSync(path.join(dist, 'robots.txt')) ? fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8') : null;
  if (!robotsTxt) issue('P0', 'robots-missing', '/robots.txt', 'robots.txt 不存在');
  else {
    const lines = robotsTxt.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    site.robots = {
      lines,
      sitemaps: lines.filter((l) => /^sitemap:/i.test(l)).map((l) => l.replace(/^sitemap:\s*/i, '')),
      disallow: lines.filter((l) => /^disallow:/i.test(l)).map((l) => l.replace(/^disallow:\s*/i, '')),
      crawlDelay: lines.filter((l) => /^crawl-delay:/i.test(l)),
    };
    if (site.robots.disallow.some((d) => d === '/' )) issue('P0', 'robots-block-all', '/robots.txt', 'robots.txt 禁止了全站抓取');
    if (site.robots.disallow.some((d) => /^\/_astro/.test(d))) issue('P0', 'robots-block-assets', '/robots.txt', 'robots.txt 屏蔽了 /_astro/（CSS / JS）');
    if (!site.robots.sitemaps.length) issue('P1', 'robots-no-sitemap', '/robots.txt', 'robots.txt 未声明 Sitemap');
    for (const s of site.robots.sitemaps) if (!s.startsWith(SITE)) issue('P1', 'robots-sitemap-host', '/robots.txt', `Sitemap 地址不是正式域名：${s}`);
  }

  const smPath = path.join(dist, 'sitemap.xml');
  if (!fs.existsSync(smPath)) issue('P0', 'sitemap-missing', '/sitemap.xml', 'sitemap.xml 不存在');
  else {
    const xml = fs.readFileSync(smPath, 'utf8');
    const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?[\s\S]*?<\/url>/g)].map((m) => ({ loc: m[1].trim(), lastmod: m[2]?.trim() ?? null }));
    site.sitemap = {
      bytes: Buffer.byteLength(xml),
      count: entries.length,
      xmlDecl: /^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(xml),
      namespace: /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(xml),
      balanced: (xml.match(/<url>/g) || []).length === (xml.match(/<\/url>/g) || []).length,
      lastmods: {},
    };
    if (!site.sitemap.xmlDecl || !site.sitemap.namespace || !site.sitemap.balanced) issue('P1', 'sitemap-structure', '/sitemap.xml', 'Sitemap XML 声明、命名空间或标签配对不正确');
    const seen = new Set();
    for (const e of entries) {
      if (seen.has(e.loc)) issue('P1', 'sitemap-dup', '/sitemap.xml', `重复 URL：${e.loc}`);
      seen.add(e.loc);
      if (!e.loc.startsWith(`${SITE}/`)) issue('P1', 'sitemap-host', '/sitemap.xml', `非正式域名 URL：${e.loc}`);
      const p = e.loc.replace(SITE, '');
      sitemapMap.set(p, e.lastmod);
      if (!existsForPath(p)) issue('P1', 'sitemap-404', p, 'Sitemap 中的 URL 在构建输出里不存在');
      if (byPath.get(p)?.noindex) issue('P1', 'sitemap-noindex', p, 'Sitemap 包含了 noindex 页面');
      if (!e.lastmod) issue('P2', 'sitemap-no-lastmod', p, '缺少 lastmod');
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(e.lastmod)) issue('P2', 'sitemap-lastmod-format', p, `lastmod 格式不是 YYYY-MM-DD：${e.lastmod}`);
      else if (e.lastmod > today) issue('P1', 'sitemap-lastmod-future', p, `lastmod 为未来日期：${e.lastmod}`);
      if (e.lastmod) site.sitemap.lastmods[e.lastmod] = (site.sitemap.lastmods[e.lastmod] || 0) + 1;
    }
    for (const p of pages) if (!p.noindex && !sitemapMap.has(p.urlPath)) issue('P1', 'sitemap-missing-page', p.urlPath, '可索引页面未进入 Sitemap');
  }

  const rssPath = path.join(dist, 'rss.xml');
  if (fs.existsSync(rssPath)) {
    const xml = fs.readFileSync(rssPath, 'utf8');
    const items = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<\/item>/g)].map((m) => m[1].trim());
    site.rss = { items: items.length, bad: items.filter((u) => !u.startsWith(SITE) || !existsForPath(u.replace(SITE, ''))) };
    if (site.rss.bad.length) issue('P2', 'rss-bad-link', '/rss.xml', `RSS 条目链接无效：${site.rss.bad.slice(0, 3).join('，')}`);
  }

  const headersPath = path.join(dist, '_headers');
  if (fs.existsSync(headersPath)) {
    const txt = fs.readFileSync(headersPath, 'utf8');
    const blocks = [];
    let cur = null;
    for (const raw of txt.split(/\r?\n/)) {
      if (!raw.trim() || raw.trim().startsWith('#')) continue;
      if (!/^\s/.test(raw)) {
        cur = { pattern: raw.trim(), headers: {} };
        blocks.push(cur);
      } else if (cur) {
        const i = raw.indexOf(':');
        cur.headers[raw.slice(0, i).trim().toLowerCase()] = raw.slice(i + 1).trim();
      }
    }
    site.headers = {
      blocks: blocks.map((b) => ({ pattern: b.pattern, names: Object.keys(b.headers) })),
      xRobots: blocks.filter((b) => b.headers['x-robots-tag']).map((b) => ({ pattern: b.pattern, value: b.headers['x-robots-tag'] })),
      pagesDevNoindex: blocks.some((b) => /pages\.dev/.test(b.pattern) && /noindex/i.test(b.headers['x-robots-tag'] ?? '')),
    };
    for (const x of site.headers.xRobots) if (!/pages\.dev/.test(x.pattern) && /noindex/i.test(x.value) && !/search-index|\.json|\.txt/.test(x.pattern)) issue('P0', 'headers-noindex', x.pattern, `_headers 对正式域名的路径设置了 X-Robots-Tag: ${x.value}`);
    if (!site.headers.pagesDevNoindex) issue('P1', 'pages-dev-indexable', '_headers', 'Cloudflare Pages 的 *.pages.dev 域名会提供同一份内容，未设置 X-Robots-Tag: noindex，可能与正式域名形成重复收录');
  }

  const redirectsPath = path.join(dist, '_redirects');
  if (fs.existsSync(redirectsPath)) {
    for (const raw of fs.readFileSync(redirectsPath, 'utf8').split(/\r?\n/)) {
      const l = raw.trim();
      if (!l || l.startsWith('#')) continue;
      const [from, to, status = '301'] = l.split(/\s+/);
      const ok = /^https?:/.test(to) || existsForPath(to);
      site.redirects.push({ from, to, status, targetExists: ok, sourceIsPage: existsForPath(from.endsWith('/') ? from : `${from}/`) });
      if (!ok) issue('P1', 'redirect-target-missing', from, `重定向目标不存在：${to}`);
      if (site.redirects.some((r) => r.from === to)) issue('P1', 'redirect-chain', from, `重定向链：${from} → ${to} → …`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 3. 逐页规则                                                         */
/* ------------------------------------------------------------------ */
const titleMap = new Map();
const descMap = new Map();
const h1Map = new Map();
for (const p of pages) {
  const u = p.urlPath;
  const is404 = u === '/404.html';
  if (p.lang !== 'zh-CN') issue('P1', 'lang', u, `<html lang> 为 ${p.lang}`);
  if (!p.title) issue('P1', 'title-missing', u, '缺少 <title>');
  if (!p.description) issue('P1', 'desc-missing', u, '缺少 meta description');
  if (p.h1.length !== 1) issue('P1', 'h1-count', u, `H1 数量为 ${p.h1.length}`);
  if (p.noindex && !is404 && !['/search/', '/me/'].includes(u)) issue('P0', 'unexpected-noindex', u, `页面带有 noindex：${p.robots}`);
  if (!p.noindex) {
    if (!p.canonical) issue('P0', 'canonical-missing', u, '缺少 canonical');
    else if (p.canonical !== `${SITE}${u}`) issue('P0', 'canonical-mismatch', u, `canonical 指向 ${p.canonical}`);
    if (titleMap.has(p.title)) issue('P1', 'title-dup', u, `title 与 ${titleMap.get(p.title)} 重复`);
    titleMap.set(p.title, u);
    if (descMap.has(p.description)) issue('P1', 'desc-dup', u, `description 与 ${descMap.get(p.description)} 重复`);
    descMap.set(p.description, u);
    const h1 = p.h1[0] ?? '';
    if (h1Map.has(h1)) issue('P2', 'h1-dup', u, `H1 与 ${h1Map.get(h1)} 相同`);
    h1Map.set(h1, u);
    if (p.titleWidth > 70) issue('P3', 'title-long', u, `title 显示宽度 ${p.titleWidth}（约 ${Math.round(p.titleWidth / 2)} 个汉字），搜索结果中可能被截断`);
    if (p.descLen > 160) issue('P3', 'desc-long', u, `description ${p.descLen} 字，搜索结果摘要通常只显示前 80 字左右`);
    if (p.descLen > 0 && p.descLen < 50) issue('P2', 'desc-short', u, `description 仅 ${p.descLen} 字`);
    if (p.words < 300) issue('P2', 'thin-content', u, `正文约 ${p.words} 字，信息量偏少`);
    if (p.og['og:url'] !== p.canonical) issue('P1', 'og-url', u, 'og:url 与 canonical 不一致');
    for (const k of ['og:title', 'og:description', 'og:image']) if (!p.og[k]) issue('P2', 'og-missing', u, `缺少 ${k}`);
    if (p.og['og:image'] && !existsForPath(p.og['og:image'].replace(SITE, ''))) issue('P2', 'og-image-missing', u, `og:image 文件不存在：${p.og['og:image']}`);
    if (u !== '/' && !p.hasBreadcrumbNav) issue('P3', 'breadcrumb-nav', u, '页面没有可见的面包屑导航');
    if (u !== '/' && !p.jsonld.some((n) => n['@type'] === 'BreadcrumbList')) issue('P3', 'breadcrumb-ld', u, '缺少 BreadcrumbList 结构化数据');
  }
  if (p.imgNoAlt) issue('P2', 'img-alt', u, `${p.imgNoAlt} 张图片缺少 alt`);
  for (const l of p.links) {
    if (!existsForPath(l.target)) issue('P1', 'dead-link', u, `站内死链 ${l.target}`);
    if (/nofollow/.test(l.rel)) issue('P2', 'internal-nofollow', u, `站内链接带 nofollow：${l.target}`);
  }
  for (const e of p.external) if (e.target === '_blank' && !/noopener/.test(e.rel)) issue('P2', 'ext-noopener', u, `外链缺少 noopener：${e.href}`);

  /* 结构化数据逐类型核对 */
  const str = JSON.stringify(p.jsonld);
  if (/"aggregateRating"|"ratingValue"|"@type":"Review"|"reviewRating"/.test(str)) issue('P0', 'ld-rating', u, '结构化数据含评分 / 评论字段');
  for (const n of p.jsonld) {
    const t = [].concat(n['@type'] ?? []);
    if (t.some((x) => /Article|BlogPosting/.test(x))) {
      for (const f of ['headline', 'datePublished', 'dateModified', 'author', 'publisher', 'image', 'mainEntityOfPage']) if (!n[f]) issue('P2', 'ld-article-field', u, `Article 缺少 ${f}`);
      if (n.headline && [...n.headline].length > 110) issue('P3', 'ld-headline-long', u, `Article.headline ${[...n.headline].length} 字符（建议 ≤ 110）`);
      if (n.datePublished && n.dateModified && n.dateModified < n.datePublished) issue('P2', 'ld-date-order', u, `dateModified(${n.dateModified}) 早于 datePublished(${n.datePublished})`);
      for (const f of ['datePublished', 'dateModified']) if (n[f] && String(n[f]).slice(0, 10) > today) issue('P1', 'ld-date-future', u, `${f}=${n[f]} 为未来日期`);
      // 结构化数据写了作者，页面正文里就必须看得到署名
      const authorName = typeof n.author === 'string' ? n.author : n.author?.name;
      if (authorName && !p.mainText.includes(authorName)) issue('P2', 'ld-author-invisible', u, `Article.author（${authorName}）在页面正文中没有可见署名`);
      if (n.mainEntityOfPage && n.mainEntityOfPage !== p.canonical) issue('P2', 'ld-main-entity', u, 'Article.mainEntityOfPage 与 canonical 不一致');
      const img = typeof n.image === 'string' ? n.image : n.image?.url;
      if (img && !existsForPath(img.replace(SITE, ''))) issue('P2', 'ld-image-missing', u, `Article.image 文件不存在：${img}`);
    }
    if (t.includes('BreadcrumbList')) {
      const els = n.itemListElement ?? [];
      els.forEach((e, i) => {
        if (e.position !== i + 1 || !e.name || !e.item) issue('P2', 'ld-breadcrumb', u, `BreadcrumbList 第 ${i + 1} 项不完整`);
        else if (!existsForPath(String(e.item).replace(SITE, ''))) issue('P2', 'ld-breadcrumb-404', u, `BreadcrumbList 指向不存在的 ${e.item}`);
      });
      if (els.length && els[els.length - 1].item !== p.canonical) issue('P3', 'ld-breadcrumb-last', u, 'BreadcrumbList 最后一项不是当前页');
    }
    if (t.includes('FAQPage')) {
      const qs = (n.mainEntity ?? []).map((q) => norm(q.name));
      const missing = qs.filter((q) => !p.mainText.includes(q));
      if (missing.length) issue('P1', 'ld-faq-invisible', u, `FAQPage 中有 ${missing.length} 个问题在页面上看不到：${missing[0]}`);
      for (const q of n.mainEntity ?? []) if (!q.acceptedAnswer?.text) issue('P2', 'ld-faq-answer', u, `FAQ 缺少答案：${q.name}`);
    }
    if (t.includes('ItemList')) {
      const els = n.itemListElement ?? [];
      if (n.numberOfItems !== els.length) issue('P2', 'ld-itemlist-count', u, 'ItemList.numberOfItems 与实际条数不一致');
      for (const e of els) if (e.url && !existsForPath(String(e.url).replace(SITE, ''))) issue('P2', 'ld-itemlist-404', u, `ItemList 指向不存在的 ${e.url}`);
    }
    if (t.includes('Organization') && n.logo?.url && !existsForPath(n.logo.url.replace(SITE, ''))) issue('P2', 'ld-logo-missing', u, `Organization.logo 文件不存在：${n.logo.url}`);
  }
}

/* ------------------------------------------------------------------ */
/* 4. 站内链接图                                                       */
/* ------------------------------------------------------------------ */
const inboundAll = new Map();
const inboundMain = new Map();
const anchors = new Map();
for (const p of pages) {
  const seenAll = new Set();
  const seenMain = new Set();
  for (const l of p.links) {
    if (l.target === p.urlPath) continue;
    if (!seenAll.has(l.target)) {
      seenAll.add(l.target);
      inboundAll.set(l.target, (inboundAll.get(l.target) ?? 0) + 1);
    }
    if (l.inMain && !seenMain.has(l.target)) {
      seenMain.add(l.target);
      inboundMain.set(l.target, (inboundMain.get(l.target) ?? 0) + 1);
    }
    if (l.inMain && l.anchor) {
      if (!anchors.has(l.target)) anchors.set(l.target, new Map());
      const m = anchors.get(l.target);
      m.set(l.anchor, (m.get(l.anchor) ?? 0) + 1);
    }
  }
}
// 点击深度：从首页出发的最短点击次数（含导航链接）
const depth = new Map([['/', 0]]);
{
  const queue = ['/'];
  while (queue.length) {
    const cur = queue.shift();
    for (const l of byPath.get(cur)?.links ?? []) {
      if (!depth.has(l.target) && byPath.has(l.target)) {
        depth.set(l.target, depth.get(cur) + 1);
        queue.push(l.target);
      }
    }
  }
}
// 只走正文链接（不靠页头页脚）的点击深度：衡量“首页 → 榜单 → 品牌 → 报告 / 教程”这条内容路径是否通
const depthMain = new Map([['/', 0]]);
{
  const queue = ['/'];
  while (queue.length) {
    const cur = queue.shift();
    for (const l of byPath.get(cur)?.links ?? []) {
      if (l.inMain && !depthMain.has(l.target) && byPath.has(l.target)) {
        depthMain.set(l.target, depthMain.get(cur) + 1);
        queue.push(l.target);
      }
    }
  }
}
for (const p of pages) {
  p.inboundPages = inboundAll.get(p.urlPath) ?? 0;
  p.inboundMain = inboundMain.get(p.urlPath) ?? 0;
  p.depth = depth.get(p.urlPath) ?? null;
  p.depthMain = depthMain.get(p.urlPath) ?? null;
  p.outMain = new Set(p.links.filter((l) => l.inMain && l.target !== p.urlPath).map((l) => l.target)).size;
  if (p.noindex || p.urlPath === '/') continue;
  if (p.inboundPages === 0) issue('P1', 'orphan', p.urlPath, '孤立页：没有任何站内链接指向');
  else if (p.inboundMain === 0) issue('P2', 'no-content-inlink', p.urlPath, '只有页头 / 页脚链接指向，正文中没有任何页面链接到它');
  else if (p.inboundMain < 2) issue('P3', 'few-content-inlinks', p.urlPath, `正文中只有 ${p.inboundMain} 个页面链接到它`);
  if (p.depth === null) issue('P1', 'unreachable', p.urlPath, '从首页无法通过链接到达');
  else if (p.depth > 3) issue('P2', 'deep', p.urlPath, `距首页 ${p.depth} 次点击`);
  if (p.depthMain === null) issue('P2', 'unreachable-by-content', p.urlPath, '只沿正文链接走，从首页到不了这一页');
}

/* ------------------------------------------------------------------ */
/* 5. 内容重复度（5 字片段 Jaccard）                                    */
/* ------------------------------------------------------------------ */
const shingles = (text) => {
  const s = text.replace(/\s+/g, '');
  const set = new Set();
  for (let i = 0; i + 5 <= s.length; i++) set.add(s.slice(i, i + 5));
  return set;
};
const jaccard = (a, b) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};
const similarity = {};
const groups = {};
for (const p of pages.filter((x) => !x.noindex)) (groups[p.type] ??= []).push(p);
for (const [type, list] of Object.entries(groups)) {
  if (list.length < 2) continue;
  const sh = list.map((p) => shingles(p.mainText));
  const pairs = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) pairs.push({ a: list[i].urlPath, b: list[j].urlPath, sim: +jaccard(sh[i], sh[j]).toFixed(3) });
  pairs.sort((x, y) => y.sim - x.sim);
  // 模板占比：某页的片段里，有多少同时出现在同组 ≥ 75% 的页面中
  const counts = new Map();
  for (const s of sh) for (const x of s) counts.set(x, (counts.get(x) ?? 0) + 1);
  const threshold = Math.max(2, Math.ceil(list.length * 0.75));
  const boiler = list.map((p, i) => ({ url: p.urlPath, share: +([...sh[i]].filter((x) => counts.get(x) >= threshold).length / (sh[i].size || 1)).toFixed(3) }));
  similarity[type] = { pages: list.length, max: pairs[0], avg: +(pairs.reduce((n, x) => n + x.sim, 0) / pairs.length).toFixed(3), top: pairs.slice(0, 5), boilerplate: boiler };
  for (const pr of pairs) if (pr.sim >= 0.6) issue('P2', 'near-duplicate', pr.a, `与 ${pr.b} 的正文片段重合率 ${(pr.sim * 100).toFixed(0)}%`);
}

/* ------------------------------------------------------------------ */
/* 6. 线上核对（--live）                                               */
/* ------------------------------------------------------------------ */
const liveResult = { checked: live, at: new Date().toISOString(), dns: {}, pages: {} };
async function head(url, ua) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', headers: ua ? { 'User-Agent': ua } : {}, signal: AbortSignal.timeout(15000) });
    return { status: res.status, location: res.headers.get('location'), xRobots: res.headers.get('x-robots-tag'), type: res.headers.get('content-type'), server: res.headers.get('server'), cfMitigated: res.headers.get('cf-mitigated') };
  } catch (e) {
    return { error: e.cause?.code ?? e.name ?? String(e) };
  }
}
{
  // DNS 总是检查：站点是否上线是所有后续结论的前提
  for (const h of [HOST, `www.${HOST}`]) {
    const r = {};
    for (const [k, fn] of [['A', () => dns.resolve4(h)], ['AAAA', () => dns.resolve6(h)], ['CNAME', () => dns.resolveCname(h)]]) {
      try {
        r[k] = await fn();
      } catch (e) {
        r[k] = `无记录（${e.code}）`;
      }
    }
    liveResult.dns[h] = r;
  }
  try {
    liveResult.dns.NS = await dns.resolveNs(HOST);
  } catch (e) {
    liveResult.dns.NS = `无记录（${e.code}）`;
  }
  const resolvable = Array.isArray(liveResult.dns[HOST].A) || Array.isArray(liveResult.dns[HOST].AAAA) || Array.isArray(liveResult.dns[HOST].CNAME);
  liveResult.resolvable = resolvable;
  if (!resolvable) issue('P0', 'not-live', SITE, `正式域名没有 A / AAAA / CNAME 记录（NS：${[].concat(liveResult.dns.NS).join('、')}），站点尚未上线，搜索引擎无法抓取`);
  if (live && resolvable) {
    const BINGBOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36';
    liveResult.base = {
      https: await head(`${SITE}/`),
      http: await head(`http://${HOST}/`),
      wwwHttps: await head(`https://www.${HOST}/`),
      wwwHttp: await head(`http://www.${HOST}/`),
      robots: await head(`${SITE}/robots.txt`),
      sitemap: await head(`${SITE}/sitemap.xml`),
      notFound: await head(`${SITE}/__seo-audit-not-found__/`),
      bingbotHome: await head(`${SITE}/`, BINGBOT),
    };
    for (const p of pages) {
      if (p.urlPath === '/404.html') continue;
      const r = await head(`${SITE}${p.urlPath}`);
      liveResult.pages[p.urlPath] = r;
      if (r.error) issue('P0', 'live-error', p.urlPath, `线上请求失败：${r.error}`);
      else if (r.status !== 200) issue(r.status >= 500 || r.status === 403 ? 'P0' : 'P1', 'live-status', p.urlPath, `线上返回 ${r.status}${r.location ? ` → ${r.location}` : ''}`);
      else if (!p.noindex && /noindex/i.test(r.xRobots ?? '')) issue('P0', 'live-x-robots', p.urlPath, `线上响应头 X-Robots-Tag: ${r.xRobots}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 7. 输出                                                             */
/* ------------------------------------------------------------------ */
function riskOf(p) {
  if (p.urlPath === '/404.html') return ['不索引（设计如此）', '404 页，noindex'];
  if (p.noindex) return ['不索引（设计如此）', '功能页，noindex，不进 Sitemap'];
  const mine = issues.filter((i) => i.url === p.urlPath);
  const worst = ['P0', 'P1', 'P2', 'P3'].find((s) => mine.some((i) => i.sev === s));
  const notes = mine.map((i) => i.msg);
  if (worst === 'P0' || worst === 'P1') return ['高', notes.join('；')];
  if (worst === 'P2') return ['中', notes.join('；')];
  return ['低', notes.join('；')];
}
const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const liveNote = !liveResult.resolvable ? '无法验证（域名未解析，站点未上线）' : !live ? '未检查（运行时未加 --live）' : null;
const rows = [
  ['URL', '页面类型', '本地构建状态', '线上状态', 'robots meta', '是否可索引', 'Canonical', 'Canonical 自引用', '在 Sitemap 中', 'Sitemap lastmod', 'Title', 'Title 字符数', 'Description 字符数', 'H1', 'H2 数量', 'H3 数量', '正文字数', '入链页面数', '正文入链页面数', '距首页点击数', '结构化数据类型', '图片数', '缺 alt 图片数', '索引风险（本地构建）', '备注'],
];
for (const p of [...pages].sort((a, b) => a.urlPath.localeCompare(b.urlPath))) {
  const [risk, note] = riskOf(p);
  const lr = liveResult.pages[p.urlPath];
  const localStatus = p.urlPath === '/404.html' ? '404（由托管平台对不存在的地址返回）' : '200';
  rows.push([
    `${SITE}${p.urlPath === '/404.html' ? '/404.html' : p.urlPath}`,
    p.type,
    localStatus,
    liveNote ?? (lr ? (lr.error ? `请求失败：${lr.error}` : `${lr.status}${lr.location ? ` → ${lr.location}` : ''}`) : ''),
    p.robots,
    p.noindex ? '否' : '是',
    p.canonical ?? '（无）',
    p.noindex ? '—' : p.canonical === `${SITE}${p.urlPath}` ? '是' : '否',
    sitemapMap.has(p.urlPath) ? '是' : '否',
    sitemapMap.get(p.urlPath) ?? '',
    p.title,
    p.titleLen,
    p.descLen,
    p.h1.join(' / '),
    p.h2.length,
    p.h3.length,
    p.words,
    p.inboundPages,
    p.inboundMain,
    p.depth ?? '不可达',
    p.jsonldTypes.join(' | '),
    p.imgCount,
    p.imgNoAlt,
    risk,
    note,
  ]);
}
for (const f of ['robots.txt', 'sitemap.xml', 'rss.xml', 'search-index.json']) {
  const lr = liveResult.base?.[f.split('.')[0]];
  rows.push([`${SITE}/${f}`, '机器可读文件', fs.existsSync(path.join(dist, f)) ? '200' : '缺失', liveNote ?? (lr ? String(lr.status ?? lr.error) : ''), '', '否（非 HTML）', '', '—', '—', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '不适用', '']);
}
await fsp.writeFile(csvFile, `﻿${rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')}\r\n`, 'utf8');

const bySev = {};
for (const i of issues) bySev[i.sev] = (bySev[i.sev] || 0) + 1;
const byCode = {};
for (const i of issues) (byCode[`${i.sev} ${i.code}`] ??= []).push(i.url);
const indexablePages = pages.filter((p) => !p.noindex);
const summary = {
  generatedAt: new Date().toISOString(),
  pages: pages.length,
  indexable: indexablePages.length,
  noindex: pages.filter((p) => p.noindex).map((p) => p.urlPath),
  sitemapUrls: site.sitemap.count,
  issues: issues.length,
  bySeverity: bySev,
  live: { requested: live, resolvable: liveResult.resolvable },
  titleWidth: { max: Math.max(...indexablePages.map((p) => p.titleWidth)), over70: indexablePages.filter((p) => p.titleWidth > 70).length },
  descLen: { min: Math.min(...indexablePages.map((p) => p.descLen)), max: Math.max(...indexablePages.map((p) => p.descLen)), over160: indexablePages.filter((p) => p.descLen > 160).length },
  words: { min: Math.min(...indexablePages.map((p) => p.words)), median: indexablePages.map((p) => p.words).sort((a, b) => a - b)[Math.floor(indexablePages.length / 2)], max: Math.max(...indexablePages.map((p) => p.words)) },
  depth: indexablePages.reduce((m, p) => ((m[p.depth ?? '不可达'] = (m[p.depth ?? '不可达'] || 0) + 1), m), {}),
  jsonldTypes: indexablePages.reduce((m, p) => (p.jsonldTypes.forEach((t) => (m[t] = (m[t] || 0) + 1)), m), {}),
};
const slim = pages.map(({ mainText, links, external, jsonld, ...rest }) => ({ ...rest, linkCount: links.length, externalCount: external.length }));
await fsp.writeFile(outFile, JSON.stringify({ summary, site, live: liveResult, issues, byCode, similarity, anchors: Object.fromEntries([...anchors].map(([k, v]) => [k, Object.fromEntries([...v].sort((a, b) => b[1] - a[1]).slice(0, 8))])), pages: slim }, null, 1));

console.log(`[seo-deep] 页面 ${summary.pages}（可索引 ${summary.indexable}，不索引 ${summary.noindex.length}）；Sitemap ${summary.sitemapUrls} 个地址`);
console.log(`[seo-deep] 线上：${liveResult.resolvable ? (live ? '已逐页请求' : '域名可解析（未加 --live，未逐页请求）') : '域名未解析，站点未上线，线上项全部无法验证'}`);
console.log(`[seo-deep] 问题 ${issues.length} 条：${['P0', 'P1', 'P2', 'P3'].map((s) => `${s}=${bySev[s] || 0}`).join('，')}`);
for (const [k, urls] of Object.entries(byCode).sort()) console.log(`  ${k} ×${urls.length}：${[...new Set(urls)].slice(0, 4).join('，')}${urls.length > 4 ? ' …' : ''}`);
console.log(`[seo-deep] 已写入 ${path.relative(root, csvFile)} 与 ${path.relative(root, outFile)}`);
