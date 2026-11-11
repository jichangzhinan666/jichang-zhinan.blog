/**
 * 内容更新日期的统一来源。
 *
 * Sitemap 的 lastmod、页脚的“全站内容最近更新”、年度榜单页的“内容更新”都从这里取，几处数字因此始终一致。
 * 所有日期都来自内容里登记的真实日期（文章 updatedAt、品牌资料核实日期与来源登记日期、套餐核实日期、
 * 测速报告 updatedAt、STATIC_PAGES 的 lastmod）——不取构建时间，也不随访问变化；
 * 内容没有实质改动，这些日期就不会前进。
 */
import { getPublishedArticles, articleUrl } from './articles';
import { getBrands, getBrandContentUpdatedAt, getPlanTiers, getSpeedReports } from './data';
import { SITE, STATIC_PAGES, NOINDEX_PATHS } from './site';

const DATE = /^\d{4}-\d{2}-\d{2}/;

/** 一组日期中最晚的一个（YYYY-MM-DD）；忽略空值与格式不对的值 */
function latestDate(dates: (string | null | undefined)[]): string | null {
  return (
    dates
      .filter((d): d is string => typeof d === 'string' && DATE.test(d))
      .map((d) => d.slice(0, 10))
      .sort()
      .at(-1) ?? null
  );
}

/** 当前年度榜单页的路径（年份取 SITE.rankingYear） */
export const RANKING_PATH = `/rankings/${SITE.rankingYear}/`;

/**
 * 年度榜单页内容的最近实质更新日期。
 *
 * 榜单页展示的是品牌资料、套餐与测速证据，所以取这四类日期中最晚的一个：
 * 页面文案自身的修改日期（STATIC_PAGES）、已发布品牌的资料核实日期、这些品牌的套餐核实日期、已发布测速报告的更新日期。
 * 新增品牌、套餐或测速报告时按流程登记这些日期，页面上的“内容更新”、Sitemap lastmod 与 JSON-LD dateModified 会一起前进，不需要手改。
 */
export function getRankingContentUpdatedAt(): string {
  const own = STATIC_PAGES[RANKING_PATH]?.lastmod ?? SITE.launchedAt;
  const published = getBrands();
  const ids = new Set(published.map((b) => b.id));
  return (
    latestDate([
      own,
      ...published.map((b) => b.lastVerifiedAt),
      ...getPlanTiers()
        .filter((t) => ids.has(t.brandId))
        .map((t) => t.verifiedAt),
      ...getSpeedReports()
        .filter((r) => ids.has(r.brandId))
        .map((r) => r.updatedAt),
    ]) ?? own
  );
}

export interface IndexableEntry {
  /** 站内路径，如 /reviews/flyv/ */
  path: string;
  /** 内容最近实质更新日期（YYYY-MM-DD） */
  lastmod: string;
}

/**
 * 全站可索引页面及其内容更新日期（顺序即 Sitemap 的输出顺序）。
 * 只包含可索引的规范页面；noindex 页面（站内搜索、404、个人中心）不在其中。
 */
export async function getIndexableEntries(): Promise<IndexableEntry[]> {
  const entries: IndexableEntry[] = [];
  const seen = new Set<string>();
  const add = (path: string, lastmod: string) => {
    if (NOINDEX_PATHS.includes(path) || seen.has(path)) return;
    seen.add(path);
    entries.push({ path, lastmod });
  };

  for (const [path, meta] of Object.entries(STATIC_PAGES)) add(path, path === RANKING_PATH ? getRankingContentUpdatedAt() : meta.lastmod);
  // 品牌页：取页面内容最近一次实质更新的日期（资料核实、来源登记、测速报告三者中最晚的），
  // 而不是只看资料核实日期——否则页面新增了介绍文案或状态说明，lastmod 仍停在更早的日期
  for (const b of getBrands()) add(`/reviews/${b.slug}/`, getBrandContentUpdatedAt(b));
  for (const r of getSpeedReports()) add(`/speed-tests/${r.slug}/`, r.updatedAt);
  for (const a of await getPublishedArticles()) add(articleUrl(a), a.data.updatedAt);
  return entries;
}

/**
 * 全站内容最近一次实质更新的日期 = 所有可索引页面的更新日期中最晚的一个（也就是 Sitemap 里最大的 lastmod）。
 * 页脚的“全站内容最近更新”用它；构建后的 SEO 审计会核对两者一致。
 */
export async function getSiteContentUpdatedAt(): Promise<string> {
  return latestDate((await getIndexableEntries()).map((e) => e.lastmod)) ?? SITE.launchedAt;
}
