import type { APIRoute } from 'astro';
import { getPublishedArticles, articleUrl, categoryLabel } from '@/lib/articles';
import { getBrands, getSpeedReports } from '@/lib/data';
import { STATIC_PAGES, NOINDEX_PATHS } from '@/lib/site';
import { RANKING_PATH, getRankingContentUpdatedAt } from '@/lib/lastmod';
import glossary from '@/data/glossary.json';

interface IndexItem {
  title: string;
  url: string;
  type: string;
  description: string;
  keywords: string[];
  body?: string;
}

/** 去掉 Markdown 标记，保留纯文本供全文匹配 */
function stripMarkdown(md: string | undefined): string {
  if (!md) return '';
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>|-]{1,3}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2500);
}

export const GET: APIRoute = async () => {
  const items: IndexItem[] = [];

  for (const a of await getPublishedArticles()) {
    items.push({
      title: a.data.title,
      url: articleUrl(a),
      type: categoryLabel(a.data.category),
      description: a.data.description,
      keywords: [a.data.primaryKeyword, ...a.data.tags].filter((x): x is string => !!x),
      body: stripMarkdown(a.body),
    });
  }

  for (const b of getBrands()) {
    items.push({
      title: `${b.displayName}${b.englishName ? `（${b.englishName}）` : ''} 机场资料与测评`,
      url: `/reviews/${b.slug}/`,
      type: '品牌评测',
      description: b.tagline,
      keywords: [...b.aliases, ...b.keywords, ...(b.coupon ? [b.coupon.code] : [])],
      body: [b.description, ...b.serviceFeatures, ...b.nodeRegions, ...b.lineTypes, ...b.streamingSupport, ...b.aiSupport].join(' '),
    });
  }

  for (const r of getSpeedReports()) {
    items.push({
      title: r.title,
      url: `/speed-tests/${r.slug}/`,
      type: '测速报告',
      description: r.summary,
      keywords: [r.tool, r.isp ?? '', ...r.regionResults.map((x) => x.region)].filter(Boolean),
      body: [r.method, ...r.streamingNotes, ...r.limitations].join(' '),
    });
  }

  glossary.forEach((g, i) => {
    items.push({
      title: `${g.term}${g.en ? `（${g.en}）` : ''}`,
      url: `/wiki/#term-${i + 1}`,
      type: '百科术语',
      description: g.definition,
      keywords: [g.term, g.en ?? ''].filter(Boolean),
    });
  });

  for (const [path, meta] of Object.entries(STATIC_PAGES)) {
    if (NOINDEX_PATHS.includes(path) || path === '/') continue;
    // 榜单页的更新日期由数据派生（与页面上的“内容更新”、Sitemap lastmod 同一来源）
    const lastmod = path === RANKING_PATH ? getRankingContentUpdatedAt() : meta.lastmod;
    items.push({ title: meta.title, url: path, type: '页面', description: `${meta.title} · 更新于 ${lastmod}`, keywords: [] });
  }

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
};
