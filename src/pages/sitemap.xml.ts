import type { APIRoute } from 'astro';
import { getPublishedArticles, articleUrl } from '@/lib/articles';
import { getBrands, getBrandContentUpdatedAt, getSpeedReports } from '@/lib/data';
import { STATIC_PAGES, NOINDEX_PATHS, absoluteUrl } from '@/lib/site';

interface Entry {
  loc: string;
  lastmod: string;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 只包含可索引的规范页面；lastmod 来自内容的真实更新日期，不使用构建时间。
 */
export const GET: APIRoute = async () => {
  const entries: Entry[] = [];
  const seen = new Set<string>();
  const add = (path: string, lastmod: string) => {
    if (NOINDEX_PATHS.includes(path) || seen.has(path)) return;
    seen.add(path);
    entries.push({ loc: absoluteUrl(path), lastmod });
  };

  for (const [path, meta] of Object.entries(STATIC_PAGES)) add(path, meta.lastmod);
  // 品牌页：取页面内容最近一次实质更新的日期（资料核实、来源登记、测速报告三者中最晚的），
  // 而不是只看资料核实日期——否则页面新增了介绍文案或状态说明，lastmod 仍停在更早的日期
  for (const b of getBrands()) add(`/reviews/${b.slug}/`, getBrandContentUpdatedAt(b));
  for (const r of getSpeedReports()) add(`/speed-tests/${r.slug}/`, r.updatedAt);
  for (const a of await getPublishedArticles()) add(articleUrl(a), a.data.updatedAt);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url>\n    <loc>${escapeXml(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`).join('\n')}
</urlset>
`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
