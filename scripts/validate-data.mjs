#!/usr/bin/env node
/**
 * 数据校验脚本（构建前自动执行：npm run validate:data）
 * 检查 brands / plans / speed-tests / sources / evidence-map 以及文章 frontmatter：
 * 字段缺漏、价格单位、日期合法性（不得为未来）、重复项、引用完整性、演示占位数据。
 * 任何 error 都会使进程以 1 退出，阻止构建。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const today = new Date();
const todayStr = today.toISOString().slice(0, 10);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s) => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
const notFuture = (s) => isDate(s) && s <= todayStr;
const exists = (rel) => fs.existsSync(path.join(root, rel));

const brands = read('src/data/brands.json');
const plans = read('src/data/plans.json');
const reports = read('src/data/speed-tests.json');
const sources = read('src/data/sources.json');
const evidenceMap = read('src/data/evidence-map.json');

const DEMO_STRINGS = ['飞云机场', '星链机场', '极光机场', '云帆机场', '速影机场', '9.7/10', '12,368', 'Lorem', 'lorem ipsum', 'TODO', '待填写', 'placeholder'];

/* ---------------- brands ---------------- */
const brandIds = new Set();
const brandSlugs = new Set();
const EVIDENCE = ['owner-report', 'dated-screenshot', 'dated-record', 'undated-screenshot', 'none'];
const STATUS = ['draft', 'review', 'published', 'archived'];
for (const b of brands) {
  const tag = `brands[${b.id ?? '?'}]`;
  for (const f of ['id', 'slug', 'displayName', 'tagline', 'description', 'brandColor', 'deviceLimit', 'editorialStatus']) {
    if (!b[f] || typeof b[f] !== 'string') err(`${tag}: 缺少字符串字段 ${f}`);
  }
  for (const f of ['aliases', 'supportedPlatforms', 'nodeRegions', 'lineTypes', 'streamingSupport', 'aiSupport', 'serviceFeatures', 'audiences', 'trafficRules', 'purchaseSteps', 'dataCaveats', 'sourceRecords', 'keywords']) {
    if (!Array.isArray(b[f])) err(`${tag}: 字段 ${f} 必须是数组`);
  }
  if (brandIds.has(b.id)) err(`${tag}: id 重复`);
  if (brandSlugs.has(b.slug)) err(`${tag}: slug 重复`);
  brandIds.add(b.id);
  brandSlugs.add(b.slug);
  if (!/^[a-z0-9-]+$/.test(b.slug ?? '')) err(`${tag}: slug 只能包含小写字母、数字与短横线`);
  if (!STATUS.includes(b.editorialStatus)) err(`${tag}: editorialStatus 非法`);
  if (!Array.isArray(b.nodeRegions) || b.nodeRegions.length === 0) err(`${tag}: nodeRegions 为空`);
  if (b.nodeCount !== null && (!Number.isInteger(b.nodeCount) || b.nodeCount <= 0)) err(`${tag}: nodeCount 必须为正整数或 null`);
  if (b.affiliateUrl && !/^https:\/\//.test(b.affiliateUrl)) err(`${tag}: affiliateUrl 必须为 https`);
  if (b.officialWebsite && !/^https?:\/\//.test(b.officialWebsite)) err(`${tag}: officialWebsite 不是 URL`);
  if (b.lastVerifiedAt !== null && !notFuture(b.lastVerifiedAt)) err(`${tag}: lastVerifiedAt 非法或为未来日期`);
  if (!b.speedTests || !EVIDENCE.includes(b.speedTests.evidenceStatus)) err(`${tag}: speedTests.evidenceStatus 非法`);
  if (b.speedTests?.latestDatedTest !== null && !notFuture(b.speedTests?.latestDatedTest)) err(`${tag}: speedTests.latestDatedTest 非法或为未来日期`);
  if (!Array.isArray(b.sourceRecords) || b.sourceRecords.length === 0) err(`${tag}: 至少需要一条 sourceRecords`);
  for (const s of b.sourceRecords ?? []) {
    if (!exists(s.sourceFile)) err(`${tag}: 来源文件不存在 ${s.sourceFile}`);
    if (s.verifiedAt && !notFuture(s.verifiedAt)) err(`${tag}: sourceRecords.verifiedAt 非法 ${s.verifiedAt}`);
  }
  if (b.coupon) {
    if (!b.coupon.code) err(`${tag}: coupon.code 为空`);
    if (b.coupon.discount === undefined) err(`${tag}: coupon.discount 缺失（未知请填 null）`);
  }
  // 证据状态与报告一致性
  const brandReports = reports.filter((r) => r.brandId === b.id && r.status === 'published');
  for (const slug of b.speedTests?.reportSlugs ?? []) {
    if (!reports.some((r) => r.slug === slug)) err(`${tag}: speedTests.reportSlugs 引用了不存在的报告 ${slug}`);
  }
  const hasOwner = brandReports.some((r) => r.verificationStatus === 'owner-measured');
  const hasDated = brandReports.some((r) => r.testedAt && r.verificationStatus !== 'attribution-pending');
  const hasUndated = brandReports.some((r) => !r.testedAt && r.verificationStatus === 'user-supplied-screenshot');
  const expected = hasOwner ? 'owner-report' : hasDated ? (brandReports.some((r) => r.testedAt && r.verificationStatus === 'user-supplied-screenshot') ? 'dated-screenshot' : 'dated-record') : hasUndated ? 'undated-screenshot' : 'none';
  if (b.speedTests?.evidenceStatus !== expected) err(`${tag}: evidenceStatus=${b.speedTests?.evidenceStatus} 与报告数据不一致（应为 ${expected}）`);
  const latest = brandReports.map((r) => r.testedAt).filter(Boolean).sort().at(-1)?.slice(0, 10) ?? null;
  if ((b.speedTests?.latestDatedTest ?? null) !== latest) err(`${tag}: latestDatedTest=${b.speedTests?.latestDatedTest} 与报告数据不一致（应为 ${latest}）`);
  if (!Number.isInteger(b.editorialRank) || b.editorialRank < 1) err(`${tag}: editorialRank 必须为 ≥1 的整数`);
  const json = JSON.stringify(b);
  for (const d of DEMO_STRINGS) if (json.includes(d)) err(`${tag}: 含演示/占位字符串 "${d}"`);
}
{
  const ranks = brands.filter((b) => b.editorialStatus === 'published').map((b) => b.editorialRank).sort((a, b) => a - b);
  ranks.forEach((r, i) => {
    if (r !== i + 1) err(`brands: 已发布品牌的 editorialRank 必须为 1..n 且不重复，实际 ${ranks.join(',')}`);
  });
}

/* ---------------- plans ---------------- */
const PERIODS = ['monthly', 'quarterly', 'half-yearly', 'yearly', 'two-yearly', 'three-yearly', 'one-time'];
const CATS = ['periodic', 'annual-lite', 'one-time', 'dedicated'];
const planIds = new Set();
const planKeys = new Set();
for (const p of plans) {
  const tag = `plans[${p.id ?? '?'}]`;
  if (planIds.has(p.id)) err(`${tag}: id 重复`);
  planIds.add(p.id);
  if (!brandIds.has(p.brandId)) err(`${tag}: brandId ${p.brandId} 不存在`);
  if (!CATS.includes(p.category)) err(`${tag}: category 非法`);
  if (p.currency !== 'CNY') err(`${tag}: currency 目前只支持 CNY（禁止无依据换算）`);
  const key = `${p.brandId}::${p.planName}`;
  if (planKeys.has(key)) err(`${tag}: 同一品牌下套餐名重复 ${p.planName}`);
  planKeys.add(key);
  const priceKeys = Object.keys(p.prices ?? {});
  if (priceKeys.length === 0) err(`${tag}: prices 为空`);
  for (const k of priceKeys) {
    if (!PERIODS.includes(k)) err(`${tag}: 未知周期 ${k}`);
    const v = p.prices[k];
    if (typeof v !== 'number' || !(v > 0) || v > 100000) err(`${tag}: 价格 ${k}=${v} 非法`);
  }
  if (p.category === 'one-time' && priceKeys.some((k) => k !== 'one-time')) err(`${tag}: 不限时流量包只能有 one-time 价格`);
  if (p.category !== 'one-time' && priceKeys.includes('one-time')) err(`${tag}: 非一次性套餐不应有 one-time 价格`);
  if (p.trafficGB !== null && (typeof p.trafficGB !== 'number' || !(p.trafficGB > 0))) err(`${tag}: trafficGB 非法`);
  if (!(p.deviceLimit === 'unlimited' || p.deviceLimit === null || Number.isInteger(p.deviceLimit))) err(`${tag}: deviceLimit 非法`);
  if (!(p.speedLimitMbps === null || typeof p.speedLimitMbps === 'number')) err(`${tag}: speedLimitMbps 非法`);
  if (!(p.couponEligible === null || typeof p.couponEligible === 'boolean')) err(`${tag}: couponEligible 非法`);
  if (!p.source?.sourceFile || !exists(p.source.sourceFile)) err(`${tag}: 来源文件缺失或不存在`);
  if (p.verifiedAt !== null && !notFuture(p.verifiedAt)) err(`${tag}: verifiedAt 非法或为未来日期`);
  // 长周期价格不应高于月付×月数（提示而非错误）
  const m = p.prices.monthly;
  const months = { quarterly: 3, 'half-yearly': 6, yearly: 12, 'two-yearly': 24, 'three-yearly': 36 };
  if (m) for (const [k, n] of Object.entries(months)) if (p.prices[k] && p.prices[k] > m * n + 0.01) warn(`${tag}: ${k} 价格 ${p.prices[k]} 高于月付×${n}=${m * n}，请核对`);
}

/* ---------------- speed tests ---------------- */
const VERIF = ['owner-measured', 'user-supplied-record', 'user-supplied-screenshot', 'attribution-pending', 'unverified'];
const slugs = new Set();
for (const r of reports) {
  const tag = `speed-tests[${r.slug ?? '?'}]`;
  if (slugs.has(r.slug)) err(`${tag}: slug 重复`);
  slugs.add(r.slug);
  if (!/^[a-z0-9-]+$/.test(r.slug ?? '')) err(`${tag}: slug 非法`);
  if (!brandIds.has(r.brandId)) err(`${tag}: brandId ${r.brandId} 不存在`);
  if (!STATUS.includes(r.status)) err(`${tag}: status 非法`);
  if (!VERIF.includes(r.verificationStatus)) err(`${tag}: verificationStatus 非法`);
  for (const f of ['title', 'summary', 'testOrigin', 'tool', 'method']) if (!r[f]) err(`${tag}: 缺少 ${f}`);
  if (r.testedAt !== null) {
    const t = Date.parse(r.testedAt);
    if (Number.isNaN(t)) err(`${tag}: testedAt 不是合法 ISO 时间`);
    else if (t > today.getTime()) err(`${tag}: testedAt 为未来时间，禁止标注未完成的测试`);
    if (r.testedAtPrecision === 'unknown') err(`${tag}: 有 testedAt 却标注 precision=unknown`);
  } else if (r.testedAtPrecision !== 'unknown') err(`${tag}: 无 testedAt 时 precision 必须为 unknown`);
  if (!notFuture(r.publishedAt)) err(`${tag}: publishedAt 非法或为未来日期`);
  if (!notFuture(r.updatedAt) || r.updatedAt < r.publishedAt) err(`${tag}: updatedAt 非法`);
  if (!Array.isArray(r.evidenceFiles) || r.evidenceFiles.length === 0) err(`${tag}: 至少需要一个证据文件`);
  for (const f of r.evidenceFiles ?? []) {
    if (!exists(f.file)) err(`${tag}: 证据文件不存在 ${f.file}`);
    if (f.hasTimestamp && !r.testedAt) err(`${tag}: 证据标注含时间戳但报告 testedAt 为空`);
  }
  if (r.verificationStatus === 'attribution-pending' && r.status === 'published') err(`${tag}: 归属待确认的报告不得发布`);
  if (r.verificationStatus === 'owner-measured') {
    if (!r.ownerReport) err(`${tag}: 站长实测必须包含 ownerReport`);
    else {
      const s = r.ownerReport.speed;
      for (const k of ['downloadMbps', 'uploadMbps', 'pingMs', 'jitterMs']) if (typeof s?.[k] !== 'number' || s[k] < 0) err(`${tag}: ownerReport.speed.${k} 非法`);
      if (r.ownerReport.connectivityTotal && r.ownerReport.connectivity.length + r.ownerReport.connectivityOthers.length !== r.ownerReport.connectivityTotal) err(`${tag}: 连通性项目数 ${r.ownerReport.connectivity.length}+${r.ownerReport.connectivityOthers.length} ≠ connectivityTotal ${r.ownerReport.connectivityTotal}`);
    }
    if (!r.testedAt) err(`${tag}: 站长实测必须有测试时间`);
  }
  for (const rr of r.regionResults ?? []) {
    const chk = (v, name) => {
      if (v && typeof v === 'object') {
        if (v.min > v.max) err(`${tag}/${rr.region}: ${name} min>max`);
        if (v.avg !== undefined && (v.avg < v.min || v.avg > v.max)) err(`${tag}/${rr.region}: ${name} avg 超出区间`);
      }
    };
    chk(rr.latencyMs, 'latencyMs');
    chk(rr.httpsLatencyMs, 'httpsLatencyMs');
    chk(rr.avgSpeedMBps, 'avgSpeedMBps');
    chk(rr.maxSpeedMBps, 'maxSpeedMBps');
    if (rr.avgSpeedMBps && rr.maxSpeedMBps && rr.avgSpeedMBps.max > rr.maxSpeedMBps.max + 0.01) warn(`${tag}/${rr.region}: 平均速度上限高于最高速度上限，请核对转录`);
    if (rr.downloadMbps !== null && !(rr.downloadMbps >= 0)) err(`${tag}/${rr.region}: downloadMbps 非法`);
  }
  const json = JSON.stringify(r);
  for (const d of DEMO_STRINGS) if (json.includes(d)) err(`${tag}: 含演示/占位字符串 "${d}"`);
}

/* ---------------- sources & evidence map ---------------- */
for (const s of sources) {
  if (!exists(s.file)) err(`sources[${s.id}]: 文件不存在 ${s.file}`);
  if (!notFuture(s.collectedAt)) err(`sources[${s.id}]: collectedAt 非法`);
  for (const b of s.relatedBrandIds ?? []) if (!brandIds.has(b)) err(`sources[${s.id}]: 关联品牌不存在 ${b}`);
}
for (const [src, dest] of Object.entries(evidenceMap)) {
  if (!exists(src)) err(`evidence-map: 原图不存在 ${src}`);
  if (!/^[a-z0-9-]+\.webp$/.test(dest)) err(`evidence-map: 目标文件名需为小写 ascii webp：${dest}`);
}
for (const r of reports) for (const f of r.evidenceFiles ?? []) if (f.kind !== 'text-record' && !evidenceMap[f.file]) warn(`speed-tests[${r.slug}]: 证据 ${f.file} 未在 evidence-map 中登记，页面将显示“图片未纳入构建”`);

/* ---------------- articles frontmatter ---------------- */
const articlesDir = path.join(root, 'src/content/articles');
const seenSlugs = new Set();
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : d.name.endsWith('.md') ? [path.join(dir, d.name)] : []));
}
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { fm, body: m[2] };
}
const articleFiles = walk(articlesDir);
if (articleFiles.length === 0) warn('src/content/articles 下没有文章');
for (const file of articleFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const parsed = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  if (!parsed) {
    err(`${rel}: 缺少 frontmatter`);
    continue;
  }
  const { fm, body } = parsed;
  const dirCat = path.basename(path.dirname(file));
  const slug = path.basename(file, '.md');
  if (fm.category && fm.category !== dirCat) err(`${rel}: 目录 ${dirCat} 与 category=${fm.category} 不一致`);
  if (!/^[a-z0-9-]+$/.test(slug)) err(`${rel}: 文件名（slug）只能包含小写字母、数字与短横线`);
  const key = `${dirCat}/${slug}`;
  if (seenSlugs.has(key)) err(`${rel}: slug 重复`);
  seenSlugs.add(key);
  if (!notFuture(fm.publishedAt)) err(`${rel}: publishedAt=${fm.publishedAt} 非法或为未来日期`);
  if (!notFuture(fm.updatedAt) || (fm.publishedAt && fm.updatedAt < fm.publishedAt)) err(`${rel}: updatedAt 非法或早于 publishedAt`);
  const text = body.replace(/\s+/g, '');
  if ((fm.status ?? 'draft') === 'published' && text.length < 600) err(`${rel}: 已发布文章正文过短（${text.length} 字）`);
  if (!/^##\s/m.test(body) && (fm.status ?? 'draft') === 'published') err(`${rel}: 已发布文章缺少 H2 小节`);
  if (/^#\s/m.test(body)) err(`${rel}: 正文中不得再出现 H1（标题由模板渲染）`);
  for (const d of DEMO_STRINGS) if (body.includes(d) || (fm.title ?? '').includes(d)) err(`${rel}: 含演示/占位字符串 "${d}"`);
  if (/\b(20[3-9]\d|2027-\d{2}-\d{2})\b/.test(fm.publishedAt ?? '')) err(`${rel}: 发布日期疑似未来`);
}

/* ---------------- summary ---------------- */
const summary = {
  brands: brands.length,
  publishedBrands: brands.filter((b) => b.editorialStatus === 'published').length,
  planTiers: plans.length,
  priceRecords: plans.reduce((n, p) => n + Object.keys(p.prices).length, 0),
  reports: reports.length,
  publishedReports: reports.filter((r) => r.status === 'published').length,
  ownerReports: reports.filter((r) => r.verificationStatus === 'owner-measured').length,
  articles: articleFiles.length,
};
console.log('[validate-data] 统计：', JSON.stringify(summary));
for (const w of warnings) console.warn('[validate-data] 警告：', w);
if (errors.length) {
  for (const e of errors) console.error('[validate-data] 错误：', e);
  console.error(`[validate-data] ${errors.length} 个错误，构建中止。`);
  process.exit(1);
}
console.log(`[validate-data] 通过：0 个错误，${warnings.length} 个警告。`);
