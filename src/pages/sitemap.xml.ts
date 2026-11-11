import type { APIRoute } from 'astro';
import { getIndexableEntries } from '@/lib/lastmod';
import { absoluteUrl } from '@/lib/site';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 只包含可索引的规范页面；lastmod 来自内容的真实更新日期，不使用构建时间。
 * 页面清单与日期由 src/lib/lastmod.ts 统一给出（页脚的“全站内容最近更新”取的是同一份数据）。
 */
export const GET: APIRoute = async () => {
  const entries = (await getIndexableEntries()).map((e) => ({ loc: absoluteUrl(e.path), lastmod: e.lastmod }));

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url>\n    <loc>${escapeXml(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`).join('\n')}
</urlset>
`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
