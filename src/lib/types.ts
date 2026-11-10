/**
 * 机场指南 —— 核心数据模型
 *
 * 原则：所有字段只允许来自 source-materials/ 中用户提供的资料。
 * 缺失的字段保持 null / 空数组，由页面显示“暂无已核实资料”，禁止填入猜测值。
 */

/** 资料来源类型 */
export type SourceType =
  | 'user-supplied-official' // 用户提供的品牌/推广方官方资料（文本）
  | 'user-supplied-screenshot' // 用户提供的测速/节点/价格截图
  | 'independently-measured' // 站长/本站实测（报告图由站长提供）
  | 'public-reference' // 公开可查的第三方参考资料
  | 'unverified'; // 未经核实

export interface SourceRecord {
  sourceType: SourceType;
  /** 相对项目根目录的文件路径，例如 source-materials/brands/灵动云.txt */
  sourceFile: string;
  /** 文件内的位置（章节/行/区域） */
  sourceLocation?: string;
  /** 资料整理/核对日期（YYYY-MM-DD），来自文件修改时间或资料内标注 */
  verifiedAt?: string;
  note?: string;
}

export type EditorialStatus = 'draft' | 'review' | 'published' | 'archived';

/** 品牌测速证据状态（用于榜单排序与证据标签），按证据等级由高到低 */
export type EvidenceStatus =
  | 'owner-report' // 站长实测报告（标注测试时间、工具、出口）
  | 'dated-screenshot' // 有标注测试时间的测速截图
  | 'dated-record' // 有标注测试时间的文字记录（无截图）
  | 'undated-screenshot' // 有截图但截图未标注测试时间
  | 'none'; // 暂无任何测速证据

export interface CouponInfo {
  code: string;
  /** 例如 “8 折”；资料未注明时为 null */
  discount: string | null;
  appliesTo: string[];
  excludes: string[];
  limits: string[];
  usage: string;
}

/** 按系统列出的客户端（用于卡片上的简洁标签） */
export interface ClientPlatform {
  platforms: string;
  client: string;
  /** 'brand' 品牌客户端 / 'third' 第三方 / 'unverified' 待核实 */
  kind: 'brand' | 'third' | 'unverified';
  source: string;
}

export interface ClientPolicy {
  /** 是否以官方客户端为主要使用方式 */
  officialClient: boolean;
  /** 可选：按系统的客户端标签；缺省时页面使用 thirdPartyClients 文本 */
  platformsDetail?: ClientPlatform[];
  /** 订阅链接政策原文（资料原话整理） */
  subscriptionLink: string;
  /** 第三方客户端政策原文 */
  thirdPartyClients: string;
  downloadChannel: string;
  note: string | null;
}

export interface SupportInfo {
  channels: string[];
  hours: string | null;
  refund: string | null;
  trial: string | null;
  payment: string | null;
  antiFraud: string | null;
}

export interface SpeedTestSummary {
  /** 该品牌已有的测速报告 slug（按时间新→旧） */
  reportSlugs: string[];
  evidenceStatus: EvidenceStatus;
  /** 最近一次有日期记录的测试日期（YYYY-MM-DD），否则 null */
  latestDatedTest: string | null;
}

export interface Brand {
  id: string;
  slug: string;
  displayName: string;
  englishName: string | null;
  aliases: string[];
  /** 品牌定位一句话 */
  tagline: string;
  /** 品牌介绍（来自资料，整理为 2–4 句） */
  description: string;
  mission: string | null;
  vision: string | null;
  values: string | null;
  slogan: string | null;
  officialWebsite: string | null;
  /** 推广（联盟）链接：点击可能为本站带来佣金，页面需披露 */
  affiliateUrl: string | null;
  /** 官方 Logo 路径；目前均为 null，页面使用首字标识并注明非官方 Logo */
  logo: string | null;
  /** 首字标识与装饰用色（本站自定，非品牌官方色） */
  brandColor: string;
  /** 资料明确列出的支持系统；未列出为空数组 */
  supportedPlatforms: string[];
  platformsNote: string | null;
  nodeRegions: string[];
  nodeCount: number | null;
  nodeCountNote: string | null;
  /** 各地区节点数；资料未给出的地区不出现在此处；null 表示资料写明“待确认” */
  nodeCountByRegion: Record<string, number | null>;
  lineTypes: string[];
  protocol: string | null;
  ratio: string | null;
  streamingSupport: string[];
  aiSupport: string[];
  /** 流媒体/AI 相关说明（例如“使用原生 IP”、“以实测为准”） */
  streamingNote: string | null;
  serviceFeatures: string[];
  audiences: string[];
  deviceLimit: string;
  trafficRules: string[];
  clientPolicy: ClientPolicy;
  coupon: CouponInfo | null;
  support: SupportInfo;
  purchaseSteps: string[];
  /** 资料中“晚高峰实测”一节的原始状态描述 */
  peakTestNote: string | null;
  speedTests: SpeedTestSummary;
  /** 本站整理时发现的资料不一致/待确认事项（公开显示） */
  dataCaveats: string[];
  sourceRecords: SourceRecord[];
  lastVerifiedAt: string | null;
  editorialStatus: EditorialStatus;
  /** 可能被搜索的关键词（站内搜索用） */
  keywords: string[];
  /** 站长指定的编辑推荐名次（1 起，唯一）；榜单按此排序，页面同时展示可核查的事实 */
  editorialRank: number;
}

export type PlanCategory =
  | 'periodic' // 周期套餐（按月流量）
  | 'annual-lite' // 年付小包
  | 'one-time' // 不限时流量包
  | 'dedicated'; // 独享/定制线路

export type PricePeriod =
  | 'monthly'
  | 'quarterly'
  | 'half-yearly'
  | 'yearly'
  | 'two-yearly'
  | 'three-yearly'
  | 'one-time';

export type PriceMap = Partial<Record<PricePeriod, number>>;

export interface PlanTier {
  id: string;
  brandId: string;
  planName: string;
  category: PlanCategory;
  /** 流量额度（GB）；null 表示资料未给出 */
  trafficGB: number | null;
  /** 流量周期说明，如“每月重置”“每 30 天刷新”“一次性，用完为止” */
  trafficNote: string;
  currency: 'CNY';
  prices: PriceMap;
  /** "unlimited" 不限设备；数字为限制台数；null 为资料未说明 */
  deviceLimit: 'unlimited' | number | null;
  /** null 表示资料未说明限速；资料明确“不限速/不降速”时填 0 */
  speedLimitMbps: number | null;
  features: string[];
  /** true 适用优惠码；false 明确不适用；null 资料未说明 */
  couponEligible: boolean | null;
  note: string | null;
  source: SourceRecord;
  verifiedAt: string | null;
}

/** 拍平后的单条套餐价格（符合总指令的 Plan 模型） */
export interface Plan {
  id: string;
  brandId: string;
  planName: string;
  category: PlanCategory;
  price: number;
  currency: 'CNY';
  period: PricePeriod;
  trafficGB: number | null;
  trafficNote: string;
  deviceLimit: 'unlimited' | number | null;
  speedLimitMbps: number | null;
  features: string[];
  source: SourceRecord;
  verifiedAt: string | null;
  /** 折算到每月的价格（仅用于比较；一次性流量包为 null） */
  monthlyEquivalent: number | null;
  /** 每 GB 单价（CNY/GB），按名义价格计算，不含优惠码 */
  pricePerGB: number | null;
}

export type VerificationStatus =
  | 'owner-measured' // 站长实测，报告图由站长提供（原始截图未附）
  | 'user-supplied-record' // 用户提供的文字记录（含时间、网络环境）
  | 'user-supplied-screenshot' // 用户提供的测速截图
  | 'attribution-pending' // 截图归属待用户确认
  | 'unverified';

export interface Range {
  min: number;
  max: number;
  avg?: number;
}

export interface RegionResult {
  region: string;
  /** 该地区参与测试/被统计的节点数 */
  nodeCount: number | null;
  fastestNode: string | null;
  /** 单位 ms；文字记录为单值，截图/报告为区间（含平均值） */
  latencyMs: number | Range | null;
  /** 延迟数据的来源说明，如“客户端测试延迟”“TLS RTT” */
  latencyLabel: string | null;
  httpsLatencyMs: Range | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  /** 文字记录/报告中的下载/上传（Mbps） */
  downloadMbps: number | null;
  uploadMbps: number | null;
  /** 截图中的平均/最高速度（MB/s，MiaoKo / SpeedCentre 原始单位） */
  avgSpeedMBps: Range | null;
  maxSpeedMBps: Range | null;
  failedNodes: string[];
  status: string | null;
  notes: string[];
}

export interface EvidenceFile {
  file: string;
  caption: string;
  kind: 'report' | 'speed' | 'streaming' | 'topology' | 'pricing' | 'text-record' | 'unknown';
  /** 截图/报告内是否标注了测试时间 */
  hasTimestamp: boolean;
  /** 截图中出现的订阅标识（已脱敏，如 *.sbs-7502） */
  subscriptionTag: string | null;
}

export type ConnectivityCategory = 'AI' | '视频' | '音乐' | '常用网站';

export interface ConnectivityItem {
  name: string;
  category: ConnectivityCategory;
  latencyMs: number;
}

export interface SuitabilityTag {
  label: string;
  verdict: 'ok' | 'warn' | 'bad';
}

/** 站长实测报告中的结构化数据（仅报告图中出现的字段） */
export interface OwnerReportDetails {
  testedNode: string | null;
  plan: string | null;
  client: string | null;
  testServer: string | null;
  exit: { location: string; org: string | null; asn: string | null } | null;
  speed: {
    downloadMbps: number;
    uploadMbps: number;
    pingMs: number;
    jitterMs: number;
    loadedLatencyDownMs: number | null;
    loadedLatencyUpMs: number | null;
  };
  /** IPCheck 网络质量评估原文（良好/一般/较差/差） */
  quality: { onlineVideo: string; onlineGaming: string; videoConference: string } | null;
  connectivity: ConnectivityItem[];
  /** 报告图中标注“均显示可用”但未列出延迟的服务 */
  connectivityOthers: string[];
  connectivityTotal: number | null;
  connectivityAvgMs: number | null;
  youtube: {
    node: string;
    connectionSpeedKbps: number[];
    resolution: string;
    droppedFrames: string;
    bufferSeconds: string;
    note: string | null;
  } | null;
  /** 单节点延迟样本（如香港 20 个节点） */
  nodeLatencySamples: { label: string; nodes: { node: string; ms: number }[] } | null;
  suitability: SuitabilityTag[];
  conclusions: string[];
}

export interface SpeedTestReport {
  id: string;
  slug: string;
  brandId: string;
  title: string;
  /** 列表/卡片使用的短摘要 */
  summary: string;
  /** ISO 8601；未知为 null */
  testedAt: string | null;
  testedAtPrecision: 'datetime' | 'date' | 'unknown';
  timezone: string | null;
  isp: string | null;
  /** 测试发起地/网络环境描述（只写资料明示的内容） */
  testOrigin: string;
  device: string | null;
  tool: string;
  toolVersion: string | null;
  method: string;
  protocol: string | null;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  evidenceFiles: EvidenceFile[];
  transcriptionNote: string | null;
  regionResults: RegionResult[];
  ownerReport: OwnerReportDetails | null;
  streamingNotes: string[];
  /** 资料原文结论（如有），不做引申 */
  conclusion: string | null;
  limitations: string[];
  publishedAt: string;
  updatedAt: string;
  status: EditorialStatus;
}

export interface SourceFileMeta {
  id: string;
  file: string;
  sourceType: SourceType;
  collectedAt: string;
  description: string;
  credibility: string;
  relatedBrandIds: string[];
}
