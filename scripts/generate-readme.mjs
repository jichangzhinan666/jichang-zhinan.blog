#!/usr/bin/env node
/**
 * 生成 README.md 里的“机场推荐榜单”一节（npm run readme；构建前也会自动执行）。
 *
 * README 是 GitHub 仓库首页，榜单里的名次、价格、流量、地区数、测速证据与各项数量
 * 全部从 src/data/*.json 读取，口径与网站榜单页一致（见 src/lib/data.ts）——不要手改两个标记之间的内容，
 * 改数据后重新运行本脚本即可。标记之外的文字是手写的，脚本不会动。
 *
 *   node scripts/generate-readme.mjs          写回 README.md
 *   node scripts/generate-readme.mjs --check  只检查：README 与数据不一致时以 1 退出，不写文件
 *
 * 约束（与站内一致）：不显示评分；名次是站长编辑推荐（editorialRank），同时列出可核查的事实；
 * 链接指向站内品牌页，不直接放推广链接（推广链接与披露说明都在站内页面上）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const checkOnly = process.argv.includes('--check');

const START = '<!-- ranking:start（以下内容由 scripts/generate-readme.mjs 根据数据生成，请勿手改） -->';
const END = '<!-- ranking:end -->';

const siteTs = fs.readFileSync(path.join(root, 'src/lib/site.ts'), 'utf8');
const SITE_URL = siteTs.match(/url:\s*'([^']+)'/)?.[1] ?? 'https://jichang-zhinan.blog';
const YEAR = siteTs.match(/rankingYear:\s*(\d{4})/)?.[1];
if (!YEAR) throw new Error('读不到 src/lib/site.ts 里的 rankingYear');

const brands = read('src/data/brands.json').filter((b) => b.editorialStatus === 'published');
const brandIds = new Set(brands.map((b) => b.id));
const tiers = read('src/data/plans.json').filter((t) => brandIds.has(t.brandId));
const reports = read('src/data/speed-tests.json').filter((r) => r.status === 'published' && brandIds.has(r.brandId));

/* ---- 与 src/lib/data.ts 相同的口径 ---- */
const round3 = (n) => Math.round(n * 1000) / 1000;
const formatPrice = (n) => `¥${Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '')}`;
const formatTraffic = (gb) => (gb === null || gb === undefined ? '—' : gb >= 1000 && gb % 1000 === 0 ? `${gb / 1000} TB` : `${gb} GB`);
const formatPerGB = (n) => (n === null ? '—' : `¥${n < 1 ? n.toFixed(3).replace(/0$/, '') : n.toFixed(2)}/GB`);
/** 入门档：月付价格最低的周期套餐 */
function entryPlan(brandId) {
  const monthly = tiers.filter((t) => t.brandId === brandId && t.category === 'periodic' && t.prices?.monthly !== undefined);
  if (!monthly.length) return null;
  const t = [...monthly].sort((a, b) => a.prices.monthly - b.prices.monthly)[0];
  return { name: t.planName, price: t.prices.monthly, trafficGB: t.trafficGB, perGB: t.trafficGB ? round3(t.prices.monthly / t.trafficGB) : null };
}
function lineTags(b) {
  const text = b.lineTypes.join(' ');
  const tags = [];
  if (/IEPL/i.test(text)) tags.push('IEPL');
  if (/IPLC/i.test(text)) tags.push('IPLC');
  if (/BGP/i.test(text)) tags.push('BGP');
  if (/直连/.test(text)) tags.push('直连');
  return tags;
}
/** 测速证据三类，与榜单卡片上的标签一致 */
function evidence(b) {
  const s = b.speedTests.evidenceStatus;
  if (s === 'owner-report') return `有本站实测${b.speedTests.latestDatedTest ? `（${b.speedTests.latestDatedTest}）` : ''}`;
  if (s === 'none') return '暂无测速证据';
  return '有第三方记录';
}
const range = (values) => {
  const sorted = [...new Set(values.filter(Boolean).map((d) => String(d).slice(0, 10)))].sort();
  return sorted.length === 0 ? '资料未提供' : sorted.length === 1 ? sorted[0] : `${sorted[0]} 至 ${sorted.at(-1)}`;
};
const cell = (s) => String(s).replace(/\|/g, '\\|');

const ranked = [...brands].sort((a, b) => a.editorialRank - b.editorialRank || a.slug.localeCompare(b.slug));
const ownerReports = reports.filter((r) => r.verificationStatus === 'owner-measured');
const ownerBrands = ranked.filter((b) => b.speedTests.evidenceStatus === 'owner-report');
const thirdOnly = ranked.filter((b) => !['owner-report', 'none'].includes(b.speedTests.evidenceStatus));
const untested = ranked.filter((b) => b.speedTests.evidenceStatus === 'none');

const rows = ranked.map((b, i) => {
  const e = entryPlan(b.id);
  const entry = e ? `${cell(e.name)}：${formatPrice(e.price)}/月 · ${formatTraffic(e.trafficGB)} · ${formatPerGB(e.perGB)}` : '资料未提供';
  const regions = `${b.nodeRegions.length} 个：${b.nodeRegions.slice(0, 5).join('、')}${b.nodeRegions.length > 5 ? ' 等' : ''}`;
  const lines = lineTags(b).join(' / ') || '资料未说明';
  return `| ${i + 1} | [${cell(b.displayName)}](${SITE_URL}/reviews/${b.slug}/) | ${entry} | ${regions} | ${lines} | ${evidence(b)} |`;
});

const coverage = [
  `${ownerBrands.length} 个有站长实测报告`,
  thirdOnly.length ? `${thirdOnly.length} 个只有第三方记录` : null,
  untested.length ? `${untested.length} 个暂无测速证据` : null,
]
  .filter(Boolean)
  .join('，');

const block = [
  START,
  '',
  `## ${YEAR} 机场推荐榜单`,
  '',
  `目前收录 ${ranked.length} 个机场品牌、${tiers.length} 档套餐。下表的名次是**站长编辑推荐顺序**，综合资料完整度、套餐性价比、线路类型与客户端政策后指定，不是测速排名，也不含评分。每个名次旁列出可以核查的事实，点品牌名进入站内的品牌资料页。`,
  '',
  '| 名次 | 品牌 | 入门档（月付 · 月流量 · 每 GB） | 节点地区 | 线路 | 测速证据 |',
  '| :-: | --- | --- | --- | --- | --- |',
  ...rows,
  '',
  '说明：',
  '',
  `- **价格**是品牌资料里的名义价格（人民币，不含优惠码），以各品牌结算页为准。品牌资料核实日期：${range(ranked.map((b) => b.lastVerifiedAt))}。`,
  `- **测速证据**分三类：有本站实测、有第三方记录、暂无测速证据。${ranked.length} 个品牌里，${coverage}。${ownerReports.length ? `站长实测共 ${ownerReports.length} 份（${range(ownerReports.map((r) => r.testedAt))}），都是单次、单节点的测试，节点与时段各不相同，不能用来比较品牌之间的快慢。` : ''}`,
  `- **推广关系**：站内品牌页里的官网入口是推广链接，购买可能为本站带来佣金；名次不因佣金调整，不接受付费排名。见[推广关系披露](${SITE_URL}/disclosure/)。`,
  `- 完整榜单可按价格、流量、地区、线路筛选，并附每个品牌的套餐表与测速报告：[${YEAR} 机场推荐榜单](${SITE_URL}/rankings/${YEAR}/)；评选方法见[测评、排序与测速方法](${SITE_URL}/methodology/)。`,
  '',
  END,
].join('\n');

const file = path.join(root, 'README.md');
const current = fs.readFileSync(file, 'utf8');
const eol = current.includes('\r\n') ? '\r\n' : '\n';
const s = current.indexOf(START);
const e = current.indexOf(END);
if (s < 0 || e < 0 || e < s) {
  console.error('[generate-readme] README.md 里找不到榜单标记，未改动。请保留这两行：\n  ' + START + '\n  ' + END);
  process.exit(1);
}
const next = current.slice(0, s) + block.replace(/\n/g, eol) + current.slice(e + END.length);
if (next === current) {
  console.log(`[generate-readme] README 的榜单已是最新（${ranked.length} 个品牌，${tiers.length} 档套餐）`);
} else if (checkOnly) {
  console.error('[generate-readme] README 的榜单与数据不一致，请运行 npm run readme');
  process.exit(1);
} else {
  fs.writeFileSync(file, next);
  console.log(`[generate-readme] 已更新 README 的榜单（${ranked.length} 个品牌，${tiers.length} 档套餐，${ownerReports.length} 份站长实测）`);
}
