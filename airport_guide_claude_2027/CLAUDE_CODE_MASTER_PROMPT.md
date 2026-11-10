# 机场指南 jichang-zhinan.blog｜2027 全站开发与 Bing SEO 总指令

> 用途：把本文件和同目录的 `homepage_reference.png` 放入 Claude Code 工作区。未来上传的机场品牌、套餐、节点及测速资料也放入工作区的 `source-materials/` 目录。阅读本指令后应实际修改代码、构建与测试，而不是只提出建议。

## 0. 项目目标与不可违背的原则

- 正式站名：**机场指南**；域名：`https://jichang-zhinan.blog`；全站使用**简体中文**。
- 定位：**2027 机场指南大全｜机场推荐、测评、教程、排名一体化**。这是真正长期运营的信息型博客，不是只包含购买按钮的联盟导流页。
- 视觉依据：`homepage_reference.png`。尽量复刻页面信息结构和蓝白科技视觉，不要为了换框架而完全重做。
- SEO：优先满足 Bing 官方 Webmaster Guidelines，并兼顾 Google 可访问性。SEO 目标是提升合法抓取、索引资格和自然排名竞争力，**不承诺一定获得/保持首页排名**。
- **资料优先**：只使用用户提供的品牌资料、套餐表、测速记录和可验证来源。不存在的字段显示“暂无已核实资料”或隐藏模块，不准杜撰套餐、评分、节点数、优惠、价格、实测结论、阅读量和发布日期。
- **时间真实性**：当前日期为 2026-11-10。任何在当前日期之前未实际完成的“2027 年 1 月测速”等不得标注为已发布或已实测。可把尚未正式进入 2027 的年度内容标记为“2027 前瞻版”，进入 2027 后更新。
- **尊重原项目**：先检查已有项目、依赖与部署方式。如果已是 Astro/Next.js 等可用技术栈，优先增量改造；只有缺乏现有项目或确有技术理由时才创建新的 Astro 项目。不要删除现存资料、密钥、链接或内容。
- **未经授权不直接部署生产、推送 GitHub、删仓库或批量发 IndexNow**；可完成本地构建、验证和部署准备。

## 1. 立即开始的执行流程

1. 检查当前目录、README、package.json、配置文件、现有页面和图片；确认是否存在 `source-materials/`。
2. 读取 `homepage_reference.png`，总结截图的布局、字体层级、色彩和卡片组件。如果图片读取能力不可用，按本文第 2 节描述实现。
3. 浏览所有用户提供的资料：PDF、Word、Excel、CSV、Markdown、文本、JSON、图片。建立逐条资料清单和字段映射，记录来源文件名/页码/工作表/更新时间/可信度。
4. 对于缺少内容的品牌或测速资料，不要臆造；生成可填充的数据模板、等待导入机制和明确的未验证状态。
5. 先以可用数据完成真实可点击的首页与基本页面，再完善品牌库、测速库、搜索、SEO 与测试。
6. 对每个开发阶段执行 lint、typecheck、build、关键页面检查。修复失败后再继续。
7. 输出 `IMPLEMENTATION_REPORT.md`，记录已完成模块、数据导入数量、无法确认的项目、检测结果、待人工处理事项及部署步骤。

## 2. UI 设计规范：尽量还原截图

### 整体风格
- 视觉：白色背景、浅蓝外层、深海军蓝 Hero、亮蓝渐变按钮、玻璃质感/柔和投影、科技地球和细微光线动态。
- 推荐设计令牌：primary #155EEF，primaryDark #0C2A68，text #101828，muted #667085，surface #FFFFFF，background #EFF5FF，border #D9E6FB。可根据参考图微调。
- 页面最大宽度建议 1440px，宽屏居中，间距遵守一致的 8px 栅格。文字优先于装饰，页面加载不能依赖大型三维 JS。
- 允许适量 hover、滑动与轻度动态效果；遵守 prefers-reduced-motion。保证对比度、键盘操作和焦点可见。

### 页头
- 左侧：纸飞机风格网站图标 + “机场指南” + 小字域名。
- 导航： 首页 / 机场推荐 / 实测评测 / 使用教程 / 选购指南 / 机场百科。
- 右侧：搜索按钮、日夜主题切换。移动端使用折叠菜单。
- 顶部导航保持清晰；所有菜单链接到实际页面，不得出现死链接。

### Hero 首屏
- 大标题：`2027 机场指南大全`。
- 副标题：`机场推荐 · 真实测评 · 使用教程 · 排行榜 · 一站式指南`。
- 简介：`从机场选购、套餐对比、节点测速到 Clash 等客户端教程，为你提供全面、客观、持续更新的网络加速使用指南。`
- 使用右侧蓝色数字地球、飞机轨迹或参考图中已有视觉素材；装饰图不能覆盖文本。
- 按钮 1：`查看 2027 机场推荐榜单`，指向 `/rankings/2027/`。
- 按钮 2：`新手入门指南`，指向 `/guides/`。
- 若未获得适用的图片授权，使用 CSS/SVG 原创装饰，不引用不明确版权的外部图片。

### 快捷入口
以六个图标入口横排：机场推荐榜单 / 实测评测 / 使用教程 / 选购指南 / 机场百科 / 最新资讯；移动端变为 2 列或可滑动布局。

### 三栏主区
- 左栏：2027 机场推荐排行榜。展示从真实资料中整理的品牌名称、Logo、简短特点、客观证据标签、详情入口。排名有明确方法说明；没有评分依据就不显示 `9.7/10` 这样的数值。
- 中栏：核心教程特色卡（例如 Clash 使用教程），下方两个小卡（如何选择机场、真实测速专题）。轮播仅在有多个已发布内容时运行；真实可点、可键盘操作。
- 右栏：站内搜索、新手快速上手、实用工具、订阅更新。搜索必须有真实结果页或本地索引；工具必须有真实功能或明确显示“开发中”，不能做成误导性按钮。

### 首页中下部
- 最新文章：分栏目筛选，图片/标题/摘要/真实发布日期/作者/阅读入口。
- 品牌资料库入口：全部品牌、地区、价格和功能筛选。
- 节点测速概览：延迟、Mbps、丢包、抖动以及测试时间，全部直接来自已核实的记录。
- FAQ：基于真实文章和常见问题，支持展开与无障碍导航。
- 页脚：关于我们、作者、编辑与测速方法、更新日志、合作与推广披露、隐私政策、联系方式、Sitemap。

### 响应式
- >=1200px：3 栏（左约 35%、中约 40%、右约 25%，可微调）。
- 768px~1199px：双栏，工具区移到下方。
- <768px：单栏；顶部导航折叠；图片适配；排行榜与正文优先；按钮可点击区域至少易于触控。
- 不能依赖截图切图作为网页主体；内容必须是可读取的 HTML。

## 3. 网站信息架构与固定 URL

- `/` 首页。
- `/rankings/2027/` 2027 年机场推荐总榜。
- `/rankings/` 年度榜单和专题榜单索引。
- `/reviews/` 品牌评测索引。
- `/reviews/[slug]/` 每个品牌的详细资料与有证据的测评。
- `/speed-tests/` 测速报告总览。
- `/speed-tests/[slug]/` 具有原始记录的地区或品牌测速报告。
- `/compare/` 多品牌与套餐对比。
- `/tutorials/` 使用教程与客户端知识。
- `/tutorials/[slug]/` 教程正文。
- `/guides/` 选购指南与新手入门。
- `/guides/[slug]/` 指南正文。
- `/wiki/` 机场百科。
- `/news/` 资讯与更新。
- `/search/` 搜索结果页。
- `/about/` 关于作者与网站。
- `/methodology/` 测评/评分/测速规则。
- `/editorial-policy/` 编辑与纠错规则。
- `/disclosure/` 广告和推广关系声明。
- `/privacy/` 隐私政策。
- `/contact/` 联系方式。

保持稳定 URL；2028 新榜单使用 `/rankings/2028/` 而不是覆盖 2027 年的永久 URL。对从未存在的页面不要创建空壳并加入 Sitemap。

## 4. 数据结构与导入

为品牌、套餐、节点、测速、文章与数据来源建立清晰的 TypeScript 数据模型。建议字段：

### Brand 品牌
`id`, `slug`, `displayName`, `aliases[]`, `description`, `officialWebsite?`, `logo?`, `supportedPlatforms[]`, `nodeRegions[]`, `lineTypes[]`, `streamingSupport?`, `aiSupport?`, `serviceFeatures[]`, `sourceRecords[]`, `lastVerifiedAt?`, `editorialStatus`。

### Plan 套餐
`id`, `brandId`, `planName`, `price`, `currency`, `period`, `trafficGB?`, `deviceLimit?`, `speedLimitMbps?`, `features[]`, `source`, `verifiedAt?`。价格及货币一定要保留来源，不要在没有实时汇率依据时自动假定换算价。

### SpeedTest 测速
`id`, `brandId`, `region`, `nodeName?`, `testedAt`, `timezone`, `isp`, `testOrigin`, `device?`, `tool`, `latencyMs?`, `jitterMs?`, `packetLossPct?`, `downloadMbps?`, `uploadMbps?`, `evidenceFiles[]`, `verificationStatus`。明确区分时间、测试环境和地区。测试不是中国大陆完成的，不得标为“中国大陆实测”。

### Article 文章
`title`, `slug`, `description`, `category`, `primaryKeyword?`, `tags[]`, `author`, `publishedAt`, `updatedAt`, `coverImage?`, `references[]`, `content`, `status`。正文使用 Markdown/MDX 或现有 CMS 模型，支持真正的文章详情页而不只是卡片摘要。

### 数据可信度与追踪
对所有有出处要求的事实加 `sourceType`（例如 `user-supplied-official` / `independently-measured` / `public-reference` / `unverified`）、`sourceFile`, `sourceLocation`, `verifiedAt`。提供数据校验脚本，导入时检查字段缺漏、价格单位、日期不合法及重复项。

### 排名与评分规则
- 绝不直接复制参考截图里演示的虚构品牌/分数到生产榜单。
- 实际得分必须有公开、可重复的评价规则和足够数据；不要因为资料缺失而给出 0 分或虚构 9.7 分。
- 推荐列表与客观测评评分分开，清楚说明“编辑推荐”“推广合作”和“实测排名”的不同含义。
- 如果存在商业返佣，声明关系；品牌排序和评语须真实，不应暗示没有利益关系。

## 5. 首批文章与内容策略

先完成栏目与可用资料模板。根据已有资料优先写出有事实基础的文章，不允许批量生成重复关键词文章。可建立以下初始选题，资料不足时保留草稿：

1. 2027 机场推荐排行榜：套餐、线路和使用场景指南
2. 2027 稳定机场怎么选：延迟、丢包与晚高峰
3. 2027 便宜机场套餐比较方法
4. Clash Verge Rev 安装和订阅导入教程
5. iOS、Android 和 Windows 常见客户端问题
6. TUN 模式与全局代理区别
7. DNS 泄露如何检测与排查
8. IEPL / IPLC / BGP / 直连线路区别
9. 香港、日本、新加坡等不同地区节点怎么选
10. 节点测速方法：NekoSpeed 与 Speedtest 的记录规范
11. 机场月付、季付、年付如何比较
12. 机场节点低延迟却速度慢的原因

品牌文章按实际导入资料生成；无法获得数据的测试报告不得标为“真实实测”。全部中文正文自然写作、有明确 H1/H2、对比依据、可读结论和内链。不要仅靠文章字数凑质量。

## 6. 搜索、筛选、工具、交互

- 全站站内搜索：支持中文标题、品牌别名、标签、摘要全文索引；结果页可点击，空结果有反馈。优先采用静态可构建的轻量索引。
- 价格/地区/平台筛选：操作后真实改变展示结果，并可清除筛选；若数据不足则显示空态。
- 套餐对比：从数据库读取品牌套餐，并展示币种、周期、流量、最后核实时间；绝不捏造信息。
- 测速图表：由可信测速数组驱动，标注单位与测试日期；无数据时显示“暂无可验证测速记录”。
- 订阅更新：如果没有邮件服务后端/授权配置，显示合法的联系渠道或功能待配置提示，**不能假装订阅成功**；须有隐私说明。
- IP 查询、订阅转换、配置生成：这些涉及外部服务与可能含有凭据的 URL。没有确认的安全后端/数据保护方案时不默认上线。不得把用户订阅密钥上传至第三方、提交给公共日志或写入浏览器分析数据。
- 暗色模式、移动导航、搜索抽屉、选项卡、FAQ、轮播均需实际可用并可操作。

## 7. 技术选型与文件结构

若从零构建，优先使用 Astro + TypeScript + CSS/Tailwind（根据项目状况选）+ Content Collections + `@astrojs/sitemap`，静态预渲染并部署 Cloudflare Pages。核心文章与品牌详情应出现在初始 HTML 中，而不是纯 CSR。可使用轻量 React/Vue/Svelte 岛组件承担搜索及筛选，但不强制。

建议目录（实际以现有项目为准）：

```text
src/
  components/{Header,Hero,RankCard,BrandCard,PlanTable,SpeedChart,ArticleCard,SearchBox,Footer,...}
  layouts/{BaseLayout,ArticleLayout}
  pages/{index,rankings,reviews,speed-tests,compare,tutorials,guides,wiki,news,search,...}
  content/{articles,reviews,guides,tutorials}
  data/{brands,plans,speed-tests,sources}
  lib/{seo,data-validation,search,formatting}
  styles/
public/{images,robots.txt,...}
source-materials/
scripts/{import-data,validate-content,seo-audit,indexnow}
CLAUDE.md
IMPLEMENTATION_REPORT.md
```

请建立 `CLAUDE.md`，写明本项目的运行命令、重要路径、简体中文内容要求、数据禁造原则、图片约束、SEO 要求与部署方式。若当前已有 `CLAUDE.md`，谨慎合并，不覆盖重要指令。

## 8. Bing SEO 专项（必须真实实现并验收）

1. 所有应收录的页面：HTTP 200、规范 URL 唯一、正确 canonical、独立 Title/Meta Description、一个清晰 H1、语义化 H2/H3、正文可抓取、有效 `<a href>` 内链。
2. 站点根网址 `https://jichang-zhinan.blog/`，统一协议和尾部斜杠策略。旧 URL 如有调整，提供 301 对照规则。
3. 生成 Sitemap，包含**可索引的规范页面**，只写真实 `lastmod`。特别注意 Astro 官方集成通常生成 `sitemap-index.xml`：**robots.txt 必须引用实际构建输出，不能未经验证就写 `/sitemap.xml`**。
4. 生成 robots.txt，允许公开内容被 Bingbot 抓取，不屏蔽 CSS/JS；测试/后台/站内搜索结果按实际 SEO 策略处理。只有明确不应索引的页面才使用 noindex。
5. IndexNow：实现可配置通知脚本（从环境变量读取 Key），提供在站点根目录可访问的 key 文件的部署方案；仅在真实发布、更改、删除 URL 时提交；本地构建不要自动提交；不要暴露额外密钥和客户端订阅 token。
6. JSON-LD：真实的 WebSite、Organization 或 Person（与真实主体一致）、BreadcrumbList、Article、适用时的 ItemList。不要使用虚假 Review/AggregateRating 或与正文不一致的 schema。
7. OG/Twitter 分享图、favicon、文章封面 alt、图片延迟加载、响应式图片；清楚区分装饰图与真正测速证据。
8. 404 页面状态与内容正确；不存在的页面不能都返回 200。避免 canonical 指向不存在的 URL、重复页面、参数污染和跳转链。
9. 验收手机端性能与 Core Web Vitals：LCP 目标 <=2.5s、INP <=200ms、CLS <=0.1，均为优化目标，不得在没有真实测试时谎称已达标。
10. 建立自动 `seo-audit`：扫描内链、标题重复、Meta 缺失、H1 缺失、图片 alt、错误 canonical、孤岛页、sitemap/robots 不一致、未来发布日期、文章空正文和假演示数据。
11. 预留 Bing Webmaster Tools 与 Google Search Console 验证入口，**只有拿到实际验证文件/标签才能配置**；不要伪造验证成功。
12. 在部署说明中写明：Bing Webmaster 添加站点 -> 验证 -> 提交 Sitemap -> 观察 IndexNow 接收情况 -> URL 检查与搜索表现。不得把 URL 已提交等同于已收录。

## 9. 出版流程与真实性机制

- 文章编辑状态：`draft`, `review`, `published`, `archived`。草稿/未完成/空白页面不进入生产 Sitemap。
- 支持 `publishedAt`, `updatedAt`。实际更新内容时才调整更新时间，不要每次构建自动改成当天。
- 图文资料和测量字段有来源，失败导入不可静默采用虚构回退值。
- 每个品牌详情提供资料来源、最后核实时间、已测试/未测试状态、适合人群说明（若有证据）、套餐和 FAQ。
- 建立更正与问题反馈方式，重视隐私、条款和广告披露。
- 2027 年的标题可以作为年度前瞻内容使用，但其数据时间范围必须如实披露。

## 10. 开发验收清单（需要你实际执行）

- [ ] 首页在桌面与移动端视觉接近参考图。
- [ ] 所有顶部栏目、卡片、按钮、分页与搜索均有真实功能。
- [ ] 有资料的品牌都正确生成页面，资料不完整时没有虚构字段。
- [ ] 首页排行榜只显示真实品牌，不存在虚假评分与虚构测速数据。
- [ ] 文章点击后进入完整正文且可由纯 HTML 抓取。
- [ ] 所有 SEO 重点页面具备 unique Title、Description、Canonical、H1、文章结构。
- [ ] 构建输出正确的 Sitemap 与 robots，并相互匹配。
- [ ] IndexNow 有脚本、配置说明、模拟/干运行模式，不在未授权时直接调用。
- [ ] `npm run build`、相关校验/测试命令可成功执行；记录实际命令与输出。
- [ ] 不存在死链接、无意义按钮、虚假联系邮箱、虚假订阅成功、未来发布日期和隐私敏感信息泄露。
- [ ] `IMPLEMENTATION_REPORT.md` 明确说明已做/未做、文件变更、数据核验情况、部署步骤。

## 11. 本轮交付要求

请先扫描当前项目和素材，然后**直接开始实现**，不要停留在建议。遇到资料不够时请做架构和可填充模板，标记待补充项；有足够事实的数据先投入页面，不要假设不存在的业务信息。每完成一阶段说明实际修改文件和可运行的检查。最后告诉我：

1. 首页和各栏目是否完成；
2. 已导入多少个真实品牌、套餐、测速报告、文章；
3. 哪些资料待我上传或核实；
4. SEO 自动检查和构建结果；
5. Cloudflare Pages 的具体构建命令与输出目录（根据现有项目实际配置）；
6. Bing Webmaster 和 IndexNow 还需要我亲自完成的操作。

立即开始：先检查项目、图片和用户文件，再编写代码。完成本地代码、测试和部署配置；未经批准不得直接发布生产。
