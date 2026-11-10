import brandsJson from '../data/brands.json';
import plansJson from '../data/plans.json';
import speedTestsJson from '../data/speed-tests.json';
import sourcesJson from '../data/sources.json';
import type {
  Brand,
  EvidenceStatus,
  Plan,
  PlanTier,
  PricePeriod,
  SourceFileMeta,
  SpeedTestReport,
} from './types';

const brands = brandsJson as unknown as Brand[];
const planTiers = plansJson as unknown as PlanTier[];
const speedTests = speedTestsJson as unknown as SpeedTestReport[];
const sources = sourcesJson as unknown as SourceFileMeta[];

/* ------------------------------------------------------------------ */
/* 品牌                                                                */
/* ------------------------------------------------------------------ */

export function getBrands(): Brand[] {
  return brands.filter((b) => b.editorialStatus === 'published');
}

export function getAllBrands(): Brand[] {
  return brands;
}

export function getBrand(slugOrId: string): Brand | undefined {
  return brands.find((b) => b.slug === slugOrId || b.id === slugOrId);
}

/** 所有品牌共同出现的地区（用于首页地球装饰的真实标签） */
export function getRegionCoverage(): { region: string; count: number }[] {
  const published = getBrands();
  const counter = new Map<string, number>();
  for (const b of published) {
    for (const r of b.nodeRegions) counter.set(r, (counter.get(r) ?? 0) + 1);
  }
  return [...counter.entries()]
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region, 'zh-CN'));
}

/* ------------------------------------------------------------------ */
/* 套餐                                                                */
/* ------------------------------------------------------------------ */

export const PERIOD_LABEL: Record<PricePeriod, string> = {
  monthly: '月付',
  quarterly: '季付',
  'half-yearly': '半年付',
  yearly: '年付',
  'two-yearly': '两年付',
  'three-yearly': '三年付',
  'one-time': '一次性',
};

export const PERIOD_ORDER: PricePeriod[] = [
  'monthly',
  'quarterly',
  'half-yearly',
  'yearly',
  'two-yearly',
  'three-yearly',
  'one-time',
];

const PERIOD_MONTHS: Record<PricePeriod, number | null> = {
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  yearly: 12,
  'two-yearly': 24,
  'three-yearly': 36,
  'one-time': null,
};

export const CATEGORY_LABEL: Record<PlanTier['category'], string> = {
  periodic: '周期套餐',
  'annual-lite': '年付小包',
  'one-time': '不限时流量包',
  dedicated: '独享 / 定制线路',
};

export function getPlanTiers(brandId?: string): PlanTier[] {
  return brandId ? planTiers.filter((p) => p.brandId === brandId) : planTiers;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 每 GB 单价保留三位小数（¥0.167/GB 这类数值才有区分度） */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function monthlyEquivalent(price: number, period: PricePeriod): number | null {
  const months = PERIOD_MONTHS[period];
  return months ? round2(price / months) : null;
}

/** 拍平为 Plan 记录（每个周期一条） */
export function flattenPlans(brandId?: string): Plan[] {
  const out: Plan[] = [];
  for (const tier of getPlanTiers(brandId)) {
    for (const period of PERIOD_ORDER) {
      const price = tier.prices[period];
      if (price === undefined) continue;
      const me = monthlyEquivalent(price, period);
      let pricePerGB: number | null = null;
      if (tier.trafficGB) {
        if (period === 'one-time') pricePerGB = round3(price / tier.trafficGB);
        else if (me !== null) pricePerGB = round3(me / tier.trafficGB);
      }
      out.push({
        id: `${tier.id}--${period}`,
        brandId: tier.brandId,
        planName: tier.planName,
        category: tier.category,
        price,
        currency: tier.currency,
        period,
        trafficGB: tier.trafficGB,
        trafficNote: tier.trafficNote,
        deviceLimit: tier.deviceLimit,
        speedLimitMbps: tier.speedLimitMbps,
        features: tier.features,
        source: tier.source,
        verifiedAt: tier.verifiedAt,
        monthlyEquivalent: me,
        pricePerGB,
      });
    }
  }
  return out;
}

/** 入门档：月付价格最低的周期套餐 */
export function getEntryPlan(brandId: string): Plan | null {
  const monthly = flattenPlans(brandId).filter(
    (p) => p.category === 'periodic' && p.period === 'monthly',
  );
  if (monthly.length === 0) return null;
  return monthly.sort((a, b) => a.price - b.price)[0];
}

/** 最大周期套餐（按月流量） */
export function getTopPlan(brandId: string): PlanTier | null {
  const tiers = getPlanTiers(brandId).filter((t) => t.category === 'periodic' && t.trafficGB);
  if (tiers.length === 0) return null;
  return tiers.sort((a, b) => (b.trafficGB ?? 0) - (a.trafficGB ?? 0))[0];
}

export function formatPrice(n: number, currency = 'CNY'): string {
  const value = Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '');
  return currency === 'CNY' ? `¥${value}` : `${value} ${currency}`;
}

export function formatPerGB(n: number | null): string {
  if (n === null) return '—';
  // <1 元时保留三位小数但去掉末尾一个 0（0.200 → 0.20，0.167 保持），≥1 元保留两位
  const text = n < 1 ? n.toFixed(3).replace(/0$/, '') : n.toFixed(2);
  return `¥${text}/GB`;
}

export function formatTraffic(gb: number | null): string {
  if (gb === null) return '—';
  if (gb >= 1000 && gb % 1000 === 0) return `${gb / 1000} TB`;
  return `${gb} GB`;
}

/* ------------------------------------------------------------------ */
/* 测速报告                                                            */
/* ------------------------------------------------------------------ */

export function getSpeedReports(includeUnpublished = false): SpeedTestReport[] {
  const list = includeUnpublished ? speedTests : speedTests.filter((r) => r.status === 'published');
  return [...list].sort((a, b) => {
    // 有日期的在前，按时间倒序；无日期的按标题
    if (a.testedAt && b.testedAt) return b.testedAt.localeCompare(a.testedAt);
    if (a.testedAt) return -1;
    if (b.testedAt) return 1;
    return a.title.localeCompare(b.title, 'zh-CN');
  });
}

export function getSpeedReport(slug: string): SpeedTestReport | undefined {
  return speedTests.find((r) => r.slug === slug);
}

export function getReportsForBrand(brandId: string): SpeedTestReport[] {
  return getSpeedReports().filter((r) => r.brandId === brandId);
}

export function formatTestedAt(report: SpeedTestReport): string {
  if (!report.testedAt) return '测试日期未标注';
  const d = new Date(report.testedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  // 以 +08:00 显示（资料均为北京时间 / CST）
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const bj = new Date(utc + 8 * 3600000);
  const date = `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())}`;
  if (report.testedAtPrecision === 'date') return date;
  return `${date} ${pad(bj.getHours())}:${pad(bj.getMinutes())}（北京时间）`;
}

export function testedDateOnly(report: SpeedTestReport): string | null {
  if (!report.testedAt) return null;
  return report.testedAt.slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* 证据标签 & 排序                                                     */
/* ------------------------------------------------------------------ */

export const EVIDENCE_RANK: Record<EvidenceStatus, number> = {
  'owner-report': 0,
  'dated-screenshot': 1,
  'dated-record': 1,
  'undated-screenshot': 2,
  none: 3,
};

export const EVIDENCE_LABEL: Record<EvidenceStatus, string> = {
  'owner-report': '站长实测',
  'dated-screenshot': '测速截图（有日期）',
  'dated-record': '晚高峰文字记录',
  'undated-screenshot': '测速截图（未标注日期）',
  none: '暂无测速证据',
};

export function evidenceBadge(brand: Brand): { label: string; tone: 'strong' | 'medium' | 'weak' | 'none' } {
  const s = brand.speedTests.evidenceStatus;
  const date = brand.speedTests.latestDatedTest;
  switch (s) {
    case 'owner-report':
      return { label: `站长实测 ${date ?? ''}`.trim(), tone: 'strong' };
    case 'dated-screenshot':
      return { label: `测速截图 ${date ?? ''}`.trim(), tone: 'medium' };
    case 'dated-record':
      return { label: `文字记录 ${date ?? ''}`.trim(), tone: 'medium' };
    case 'undated-screenshot':
      return { label: '测速截图（未标注日期）', tone: 'weak' };
    default:
      return { label: '暂无测速证据', tone: 'none' };
  }
}

export interface RankedBrand {
  position: number;
  brand: Brand;
  entry: Plan | null;
  pricePerGB: number | null;
  regionCount: number;
  evidenceRank: number;
  /** 排序依据说明（公开显示） */
  reasons: string[];
  /** 简短特点（来自资料 tagline） */
  highlight: string;
}

/**
 * 2027 榜单排序规则（可复现，详见 /methodology/）：
 * 1) 证据等级（站长实测 > 有日期的截图/记录 > 无日期截图 > 无证据）
 * 2) 入门档每 GB 单价（低→高）
 * 3) 节点地区数（多→少）
 * 4) slug 字母序
 * 该排序不是速度/稳定性评分，页面不显示任何分数。
 */
export function computeRanking(): RankedBrand[] {
  const rows = getBrands().map((brand) => {
    const entry = getEntryPlan(brand.id);
    return {
      brand,
      entry,
      pricePerGB: entry?.pricePerGB ?? null,
      regionCount: brand.nodeRegions.length,
      evidenceRank: EVIDENCE_RANK[brand.speedTests.evidenceStatus],
    };
  });
  rows.sort((a, b) => {
    if (a.evidenceRank !== b.evidenceRank) return a.evidenceRank - b.evidenceRank;
    const pa = a.pricePerGB ?? Number.POSITIVE_INFINITY;
    const pb = b.pricePerGB ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    if (a.regionCount !== b.regionCount) return b.regionCount - a.regionCount;
    return a.brand.slug.localeCompare(b.brand.slug);
  });
  return rows.map((r, i) => {
    const reasons: string[] = [];
    reasons.push(`证据等级：${EVIDENCE_LABEL[r.brand.speedTests.evidenceStatus]}`);
    if (r.entry) {
      reasons.push(
        `入门档 ${r.entry.planName} ${formatPrice(r.entry.price)}/月 · ${formatTraffic(r.entry.trafficGB)} · ${formatPerGB(r.pricePerGB)}`,
      );
    } else {
      reasons.push('入门档价格：资料未提供');
    }
    reasons.push(`节点地区 ${r.regionCount} 个`);
    return {
      position: i + 1,
      ...r,
      reasons,
      highlight: r.brand.tagline,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 专题榜（纯数据派生）                                                 */
/* ------------------------------------------------------------------ */

export function topicLists() {
  const published = getBrands();
  const entries = published
    .map((b) => ({ brand: b, entry: getEntryPlan(b.id) }))
    .filter((x): x is { brand: Brand; entry: Plan } => x.entry !== null);

  const byEntryPrice = [...entries].sort((a, b) => a.entry.price - b.entry.price);
  const byPerGB = [...entries]
    .filter((x) => x.entry.pricePerGB !== null)
    .sort((a, b) => (a.entry.pricePerGB ?? 0) - (b.entry.pricePerGB ?? 0));
  const byTopTraffic = published
    .map((b) => ({ brand: b, top: getTopPlan(b.id) }))
    .filter((x): x is { brand: Brand; top: PlanTier } => x.top !== null)
    .sort((a, b) => (b.top.trafficGB ?? 0) - (a.top.trafficGB ?? 0));
  const byRegions = [...published].sort(
    (a, b) => b.nodeRegions.length - a.nodeRegions.length || a.slug.localeCompare(b.slug),
  );
  const annualLite = planTiers
    .filter((t) => t.category === 'annual-lite' && t.prices.yearly !== undefined)
    .map((t) => ({ tier: t, brand: getBrand(t.brandId)! }))
    .sort((a, b) => (a.tier.prices.yearly ?? 0) - (b.tier.prices.yearly ?? 0));

  return { byEntryPrice, byPerGB, byTopTraffic, byRegions, annualLite };
}

/* ------------------------------------------------------------------ */
/* 资料来源                                                            */
/* ------------------------------------------------------------------ */

export function getSources(): SourceFileMeta[] {
  return sources;
}

export function getSourcesForBrand(brandId: string): SourceFileMeta[] {
  return sources.filter((s) => s.relatedBrandIds.includes(brandId));
}

/** 统计数字（首页/关于页用，全部由数据派生） */
export function getStats() {
  const published = getBrands();
  const tiers = planTiers.length;
  const plans = flattenPlans().length;
  const reports = getSpeedReports().length;
  const ownerReports = getSpeedReports().filter((r) => r.verificationStatus === 'owner-measured').length;
  return { brands: published.length, tiers, plans, reports, ownerReports };
}
