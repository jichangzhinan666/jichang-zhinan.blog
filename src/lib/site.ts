/**
 * 站点级常量：名称、URL、导航、静态页面登记（供 sitemap lastmod 使用）。
 * 本文件不依赖 Astro 运行时，脚本与配置均可引用。
 */

export const SITE = {
  name: '机场指南',
  domain: 'jichang-zhinan.blog',
  url: 'https://jichang-zhinan.blog',
  /** 首页 H1 */
  heroTitle: '2026 机场指南大全｜机场推荐、真实测评、节点测速与排行榜',
  /** 留空则不渲染副标题行 */
  heroSubtitle: '',
  heroIntro:
    '一站式了解 2026 年机场推荐、机场排行榜、套餐价格对比与节点测速。涵盖香港、日本、新加坡、美国等地区节点分析、出口运营商信息、线路稳定性、流媒体与 AI 兼容性，以及 Clash 客户端使用教程，为你提供全面、客观、持续更新的机场选择指南。',
  tagline: '2026 机场指南大全｜机场推荐、测评、教程、排名一体化',
  headerTagline: '2026 专业机场指南 · 推荐 · 测评 · 教程 · 排名',
  description:
    '机场指南（jichang-zhinan.blog）整理 2026 机场推荐榜单、品牌资料库、节点测速报告、Clash 等客户端教程与选购指南。所有价格、节点与测速数据均注明来源与核实时间，不虚构评分。',
  locale: 'zh-CN',
  author: {
    name: '机场阿南',
    /** 社交平台昵称 */
    alias: '孟南子',
    url: '/author/',
    role: '机场推荐、VPN 测评、网络节点测速与客户端使用教程内容创作者',
    bio: [
      '大家好，我是机场阿南，一名专注于机场推荐、VPN 测评、网络节点测速及客户端使用教程的内容创作者。',
      '我创建机场指南，希望通过整理机场品牌资料、套餐价格、线路信息、真实测速记录以及新手使用教程，帮助读者更清楚地了解不同网络加速服务。',
      '我的分享内容涵盖机场推荐排行榜、品牌资料、节点测速、Clash 使用教程、Windows、Android 和 iOS 客户端配置等。',
      '欢迎读者向我提供建议、最新资料及文章纠错信息，让机场指南持续完善。',
    ],
    focus: ['机场推荐排行榜', '品牌资料整理', '节点测速记录', 'Clash 使用教程', 'Windows / Android / iOS 客户端配置', 'VPN 与网络加速测评'],
  },
  /** 本站上线日期（真实） */
  launchedAt: '2026-11-10',
  /** 榜单年度 */
  rankingYear: 2026,
  /** 2026 为当前年度版；进入 2027 年后新建 /rankings/2027/，本字段保留供年度切换时使用 */
  isPreview: false,
  contactEmail: (import.meta.env?.PUBLIC_CONTACT_EMAIL as string | undefined) || null,
  bingVerification: (import.meta.env?.PUBLIC_BING_SITE_VERIFICATION as string | undefined) || null,
  googleVerification:
    (import.meta.env?.PUBLIC_GOOGLE_SITE_VERIFICATION as string | undefined) || null,
  defaultOgImage: '/images/og-default.png',
} as const;

export type NavChild = { label: string; href: string; description?: string };
export type NavItem = {
  label: string;
  href: string;
  icon: string;
  /** 下拉子项；教程/指南/百科的子项在 Header 中由文章集合动态补充 */
  children?: NavChild[];
  dynamicCategory?: 'tutorials' | 'guides' | 'wiki';
};

export const NAV: NavItem[] = [
  { label: '首页', href: '/', icon: 'home' },
  {
    label: '机场推荐',
    href: '/rankings/',
    icon: 'globe',
    children: [
      { label: '2026 机场推荐榜单', href: '/rankings/2026/', description: '编辑整理榜（年度版）' },
      { label: '2026 机场分类榜单', href: '/rankings/', description: '低价机场、大流量套餐、节点地区与线路类型' },
      { label: '2026 机场套餐价格对比', href: '/compare/', description: '月付费用、流量与每 GB 单价' },
      { label: '2026 机场品牌测评大全', href: '/reviews/', description: '节点线路、客户端与详细资料库' },
    ],
  },
  {
    label: '实测评测',
    href: '/reviews/',
    icon: 'chart',
    children: [
      { label: '节点测速报告', href: '/speed-tests/', description: '站长实测与用户提供的测速记录' },
      { label: '测评与测速方法', href: '/methodology/', description: '排序规则、数据来源与局限' },
    ],
  },
  { label: '使用教程', href: '/tutorials/', icon: 'book', dynamicCategory: 'tutorials' },
  { label: '选购指南', href: '/guides/', icon: 'tag', dynamicCategory: 'guides' },
  { label: '机场百科', href: '/wiki/', icon: 'layers', dynamicCategory: 'wiki' },
];

/**
 * 社交 / 外部入口（页头右侧图标）。
 * href 为 null 的项会显示为带“链接待补充”提示的禁用图标，不生成无效链接；拿到地址后填入即可生效。
 */
export const SOCIAL_LINKS: { id: 'telegram' | 'github'; label: string; href: string | null }[] = [
  { id: 'telegram', label: 'Telegram 群组', href: 'https://t.me/+i7oRptf4FstlMTVl' },
  { id: 'github', label: 'GitHub', href: null },
];

/**
 * 联系与纠错渠道（站长提供）。邮箱走 mailto，一键发送；主页类链接新标签页打开。
 * href 为 null 时页面显示“链接待补充”，不生成虚假链接。
 */
export const CONTACT_CHANNELS: {
  id: 'gmail' | 'protonmail' | 'facebook';
  label: string;
  icon: string;
  kind: 'email' | 'profile';
  value: string;
  display: string;
  href: string | null;
}[] = [
  { id: 'gmail', label: 'Gmail', icon: 'gmail', kind: 'email', value: 'jichangzhinan666@gmail.com', display: 'jichangzhinan666@gmail.com', href: 'mailto:jichangzhinan666@gmail.com' },
  { id: 'protonmail', label: 'Proton Mail', icon: 'protonmail', kind: 'email', value: 'jichangzhinan666@proton.me', display: 'jichangzhinan666@proton.me', href: 'mailto:jichangzhinan666@proton.me' },
  { id: 'facebook', label: 'Facebook', icon: 'facebook', kind: 'profile', value: '孟南子｜机场阿南', display: '孟南子｜机场阿南', href: 'https://www.facebook.com/profile.php?id=61596343863401' },
];

/** 首页快捷入口（六个） */
export const QUICK_LINKS = [
  { label: '机场推荐榜单', sub: '2026 年度版 · 编辑整理', href: '/rankings/2026/', icon: 'trophy' },
  { label: '实测评测', sub: '速度 · 延迟 · 连通性', href: '/speed-tests/', icon: 'chart' },
  { label: '使用教程', sub: 'Clash · iOS · Android', href: '/tutorials/', icon: 'book' },
  { label: '选购指南', sub: '按需求 · 按预算选择', href: '/guides/', icon: 'tag' },
  { label: '机场百科', sub: '术语 · 线路 · 常见问题', href: '/wiki/', icon: 'layers' },
  { label: '最新资讯', sub: '站点动态 · 更新日志', href: '/news/', icon: 'bolt' },
] as const;

export const CATEGORY_META = {
  tutorials: { label: '使用教程', href: '/tutorials/', description: 'Clash、iOS、Android、Windows 等客户端的安装、导入与排错教程。' },
  guides: { label: '选购指南', href: '/guides/', description: '从预算、流量、地区、线路与付费周期出发，帮你判断该选哪一类机场。' },
  wiki: { label: '机场百科', href: '/wiki/', description: '机场、IEPL/IPLC、BGP、TUN、DNS 等术语与原理的通俗解释。' },
  news: { label: '资讯与更新', href: '/news/', description: '站点上线、内容更新、数据核实与更正记录。' },
} as const;

export type CategoryKey = keyof typeof CATEGORY_META;

/**
 * 静态页面登记：路径 → 标题 + 最后实质性更新日期。
 * 只有在真正修改内容时才更新 lastmod，不要每次构建改成当天。
 */
export const STATIC_PAGES: Record<string, { title: string; lastmod: string; changefreq: string }> = {
  '/': { title: '首页', lastmod: '2026-11-10', changefreq: 'weekly' },
  '/rankings/': { title: '2026 机场分类榜单', lastmod: '2026-11-10', changefreq: 'monthly' },
  '/rankings/2026/': { title: '2026 机场推荐榜单', lastmod: '2026-11-10', changefreq: 'weekly' },
  '/reviews/': { title: '2026 机场品牌测评大全', lastmod: '2026-11-10', changefreq: 'weekly' },
  '/speed-tests/': { title: '2026 机场节点测速报告', lastmod: '2026-11-10', changefreq: 'weekly' },
  '/compare/': { title: '2026 机场套餐价格对比', lastmod: '2026-11-10', changefreq: 'weekly' },
  '/tutorials/': { title: '2026 机场使用教程大全', lastmod: '2026-11-10', changefreq: 'weekly' },
  '/guides/': { title: '2026 机场选购指南', lastmod: '2026-11-10', changefreq: 'weekly' },
  '/wiki/': { title: '2026 机场知识百科', lastmod: '2026-11-10', changefreq: 'monthly' },
  '/author/': { title: '作者介绍：机场阿南', lastmod: '2026-11-10', changefreq: 'monthly' },
  '/news/': { title: '资讯与更新', lastmod: '2026-11-11', changefreq: 'weekly' },
  '/about/': { title: '关于机场指南', lastmod: '2026-11-10', changefreq: 'yearly' },
  '/methodology/': { title: '测评、排序与测速方法', lastmod: '2026-11-10', changefreq: 'yearly' },
  '/editorial-policy/': { title: '编辑与纠错政策', lastmod: '2026-11-10', changefreq: 'yearly' },
  '/disclosure/': { title: '推广关系披露', lastmod: '2026-11-10', changefreq: 'yearly' },
  '/privacy/': { title: '隐私政策', lastmod: '2026-11-10', changefreq: 'yearly' },
  '/contact/': { title: '联系与反馈', lastmod: '2026-11-10', changefreq: 'yearly' },
};

/** 不应被索引、也不进入 sitemap 的路径 */
/** noindex 且不进 sitemap / 站内搜索索引的页面（站内搜索、404、个人中心） */
export const NOINDEX_PATHS = ['/search/', '/404/', '/me/'];

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE.url}${normalized}`;
}
