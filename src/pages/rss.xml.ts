import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPublishedArticles, articleUrl, categoryLabel } from '@/lib/articles';
import { getSpeedReports, getBrand } from '@/lib/data';
import { SITE, absoluteUrl } from '@/lib/site';

function toDate(ymd: string): Date {
  // 资料日期均为北京时间（UTC+8）当天
  return new Date(`${ymd}T00:00:00+08:00`);
}

export const GET: APIRoute = async (context) => {
  const articles = await getPublishedArticles();
  const reports = getSpeedReports();

  // 实际更新时间只在与发布日期不同时写入（<atom:updated>），不随构建自动变化
  const updatedTag = (publishedAt: string, updatedAt: string) =>
    updatedAt && updatedAt !== publishedAt ? `<atom:updated>${toDate(updatedAt).toISOString()}</atom:updated>` : undefined;

  const items = [
    ...articles.map((a) => ({
      title: a.data.title,
      description: a.data.description,
      link: absoluteUrl(articleUrl(a)),
      pubDate: toDate(a.data.publishedAt),
      categories: [categoryLabel(a.data.category), ...a.data.tags],
      customData: updatedTag(a.data.publishedAt, a.data.updatedAt),
      updatedAt: a.data.updatedAt || a.data.publishedAt,
    })),
    ...reports.map((r) => ({
      title: r.title,
      description: r.summary,
      link: absoluteUrl(`/speed-tests/${r.slug}/`),
      pubDate: toDate(r.publishedAt),
      categories: ['节点测速报告', getBrand(r.brandId)?.displayName ?? ''],
      customData: updatedTag(r.publishedAt, r.updatedAt),
      updatedAt: r.updatedAt || r.publishedAt,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  // 频道级最近更新时间 = 所有条目中最新的内容更新日期
  const lastBuild = items.reduce((max, it) => (it.updatedAt > max ? it.updatedAt : max), '0000-00-00');

  return rss({
    title: `${SITE.name}｜${SITE.tagline}`,
    description: SITE.description,
    site: context.site ?? SITE.url,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    items: items.map(({ updatedAt: _u, ...it }) => it),
    customData: [
      `<language>zh-cn</language>`,
      lastBuild !== '0000-00-00' ? `<lastBuildDate>${toDate(lastBuild).toUTCString()}</lastBuildDate>` : '',
      `<atom:link href="${absoluteUrl('/rss.xml')}" rel="self" type="application/rss+xml"/>`,
    ].join(''),
    trailingSlash: false,
  });
};
