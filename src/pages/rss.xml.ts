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

  const items = [
    ...articles.map((a) => ({
      title: a.data.title,
      description: a.data.description,
      link: absoluteUrl(articleUrl(a)),
      pubDate: toDate(a.data.publishedAt),
      categories: [categoryLabel(a.data.category), ...a.data.tags],
    })),
    ...reports.map((r) => ({
      title: r.title,
      description: r.summary,
      link: absoluteUrl(`/speed-tests/${r.slug}/`),
      pubDate: toDate(r.publishedAt),
      categories: ['节点测速报告', getBrand(r.brandId)?.displayName ?? ''],
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: `${SITE.name}｜${SITE.tagline}`,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items,
    customData: `<language>zh-cn</language>`,
    trailingSlash: false,
  });
};
