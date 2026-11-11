# CLAUDE.md —— 机场指南 jichang-zhinan.blog 项目说明

本文件给在本仓库工作的 Claude Code / 开发者看。总体开发指令见 `airport_guide_claude_2027/CLAUDE_CODE_MASTER_PROMPT.md`，本文件只写项目现状、命令与硬性约束。

## 1. 技术栈与运行命令

- Astro 7（静态输出，`output: 'static'`）+ TypeScript + 原生 CSS（设计令牌在 `src/styles/global.css`）。Node ≥ 22.12（`.node-version`）。
- Markdown 处理器为 Astro 默认的 Sätteri；内容集合定义在 `src/content.config.ts`（`z` 来自 `astro/zod`，`render(entry)` 来自 `astro:content`）。

```bash
npm install            # 安装依赖
npm run dev            # 开发服务器
npm run check          # astro check（类型与模板检查）
npm run validate:data  # 校验 brands/plans/speed-tests/sources/evidence-map 与文章 frontmatter
npm run build          # prebuild(校验+资产) → astro build → postbuild(IndexNow key 文件 + SEO 审计)
npm run preview        # 预览 dist
npm run seo:audit      # 单独运行 SEO 审计（需先 build），输出 seo-audit-report.json
npm run seo:deep       # SEO 深度审计（需先 build）：逐页元数据、结构化数据、内链图、重复度；写出 URL-INDEX-AUDIT.csv
npm run seo:live       # 同上，并逐个请求线上域名的 URL（上线后使用；域名未解析时只报告“未上线”）
npm run ui:audit       # 全站 UI 审计（需先 build）：本机 Chrome 在 7 个视口渲染全部页面，输出 ui-audit-report.json
npm run ui:test        # 交互实测（需先 build）：真实鼠标 / 键盘操作 70 项用例，有失败时以非 0 退出
npm run indexnow:dry   # IndexNow 干运行：对比 dist/sitemap.xml 与上次提交记录，列出将提交的 URL（不发送、不写文件）
npm run indexnow       # IndexNow 真实提交，只推新增 / 更新 / 移除的 URL（需 INDEXNOW_KEY；须经站长批准）
```

`ui:audit` / `ui:test` 依赖本机已安装的 Chrome 或 Edge（可用 `CHROME_PATH` 指定），不联网、不改文件；**没有挂到 `build` 上**（Cloudflare Pages 构建环境没有浏览器）。改动样式、组件或交互脚本后请手动跑这两条。常用参数：`--vp 375,1440`、`--pages /,/compare/`、`--theme dark`、`--shots <目录>`、`--only <分组关键词>`。

构建会在以下情况失败：数据校验报错、文章 frontmatter 不合法、SEO 审计发现错误（死链、缺 canonical、多个 H1、未来日期、演示占位数据、sitemap 与页面不一致等）。请修复后再构建，不要绕过。

## 2. 重要路径

| 路径 | 用途 |
| --- | --- |
| `source-materials/brands/*.txt` | 用户提供的品牌资料原文（只读，不得修改原件） |
| `source-materials/evidence/` | 用户提供的测速/节点/价格截图；`reports/` 为站长实测报告图 |
| `source-materials/templates/资料填写.txt` | 新增品牌的资料模板 |
| `src/data/brands.json` | 品牌数据（类型见 `src/lib/types.ts`） |
| `src/data/plans.json` | 套餐档位（`prices` 为周期→价格映射，页面拍平为 Plan） |
| `src/data/speed-tests.json` | 测速报告（含站长实测 `ownerReport` 结构） |
| `src/data/sources.json` | 资料来源登记（文件、类型、整理日期、可信度） |
| `src/data/evidence-map.json` | 原图 → `src/assets/evidence/*.webp` 映射（由脚本生成） |
| `src/data/glossary.json` / `changelog.json` | 百科术语表 / 更新日志 |
| `src/content/articles/<category>/<slug>.md` | 文章，目录名必须等于 frontmatter `category` |
| `src/lib/site.ts` | 站点常量、导航、静态页面登记（`STATIC_PAGES` 的 lastmod 供 sitemap 使用） |
| `src/lib/data.ts` | 数据读取、拍平、榜单排序 `computeRanking()`、专题榜 |
| `src/lib/lastmod.ts` | 内容更新日期的统一来源：Sitemap lastmod、页脚“全站内容最近更新”、榜单页“内容更新”都从这里取 |
| `src/lib/seo.ts` | JSON-LD 构造（WebSite/Organization/Breadcrumb/Article/ItemList/FAQ） |
| `src/pages/sitemap.xml.ts` | 自定义 Sitemap（只含可索引页，lastmod 为真实内容日期） |
| `src/pages/search-index.json.ts` | 站内搜索索引 |
| `scripts/` | validate-data / generate-brand-assets / seo-audit / indexnow / write-indexnow-key；`ui-audit.mjs`（布局与可访问性扫描）、`ui-interactions.mjs`（交互实测）、`lib/cdp.mjs`（零依赖驱动本机 Chrome） |
| `UI_AUDIT_REPORT.md` / `docs/ui-audit/` | 2026-11-11 全站 UI 审计报告与修复前后对比图 |
| `SEO-AUDIT-REPORT.md` 等六份文件 | 2026-11-11 Bing SEO 审计：总报告、`URL-INDEX-AUDIT.csv`（由 `npm run seo:deep` 生成）、`KEYWORD-MAPPING.csv`、`CONTENT-QUALITY-REPORT.md`、`BING-SUBMISSION-REPORT.md`、`SEO-FINAL-CHECKLIST.md` |
| `scripts/seo-deep-audit.mjs` | SEO 深度审计脚本（与构建时的 `seo-audit.mjs` 互补） |
| `.indexnow/` | IndexNow 提交记录（`state.json`、`log.jsonl`）；首次真实提交后才会出现 |
| `public/robots.txt` `_headers` `_redirects` | 爬虫、响应头与重定向规则（Cloudflare Pages） |

## 3. 内容硬性约束（不得违反）

1. **全站简体中文**；品牌英文名、协议名等专有名词保留原文。
2. **资料优先、禁止虚构**：价格、流量、节点数、优惠码、客服政策只能来自 `source-materials/`；测速数值只能来自站长报告图、资料文字记录或用户截图。资料没有的字段用 `null` / 空数组，页面显示“资料未提供”。
3. **不显示评分**：任何页面与 JSON-LD 都不得出现 `ratingValue`、`aggregateRating`、“9.x 分”。榜单是“站长编辑推荐榜”，名次来自 `brands.json` 的 `editorialRank`（1..n 唯一，由站长指定并记录到更新日志），页面必须同时展示证据等级、入门价、地区数等可核查事实。
4. **日期真实**：`publishedAt` / `updatedAt` / `testedAt` 不得为未来日期；只在内容实质变更时改 `updatedAt` 与 `STATIC_PAGES.lastmod`，不要随构建自动改。未完成的测试不得标为“已实测”。当前为“2026 年度版”（`SITE.rankingYear`）；2027 年榜单新建 `/rankings/2027/`，不覆盖 2026 页面。
5. **证据与归属**：截图转录的区间数值标“约”；归属存疑的记录 `status: 'review'`，不发布、不进 sitemap。截图中的订阅标识需脱敏（`*.sbs-7502` 形式）。
6. **推广链接**：品牌入口均为推广链接，必须 `rel="sponsored nofollow noopener noreferrer"`，页面附披露说明。
7. **不新增误导性按钮**：工具必须真实可用或明确标“规划中”。不提供需要上传订阅链接的工具（IP 查询、订阅转换、配置生成），理由见 `/privacy/#tools`。订阅更新用 RSS，不得假装邮件订阅成功。
8. **图片**：无版权不明的外部图片；证据图经 `scripts/generate-brand-assets.mjs` 转为 ≤1600px webp 后用 `<Image>` 引用，`alt` 写明是报告图/截图；装饰图用 CSS/SVG。
9. **数据改动流程**：改 JSON → `npm run validate:data` → 需要时更新 `changelog.json` 与对应页面 lastmod → `npm run build`。

## 4. SEO 约定

- 根 URL `https://jichang-zhinan.blog/`，`trailingSlash: 'always'`，目录式 URL。所有站内链接以 `/` 结尾（文件类 `.xml/.json` 除外）。
- 每页唯一 `<title>`（≤ 70 字符）与 description（50–230 字符），一个 H1，自引用 canonical，OG/Twitter 标签在 `BaseLayout`。
- `/search/` 与 404 为 noindex，不进 sitemap。
- robots.txt 引用 `/sitemap.xml`（自定义端点，不是 `sitemap-index.xml`）。不得屏蔽 `/_astro/`。
- IndexNow：`INDEXNOW_KEY` 只放环境变量；`scripts/write-indexnow-key.mjs` 在构建后写 `dist/<KEY>.txt`；推送只用 `scripts/indexnow.mjs` 手动执行。默认只提交发生变化的 URL：每个 URL 上次提交时的 lastmod 记在 `.indexnow/state.json`，每次真实提交的时间、数量、响应码与失败原因追加到 `.indexnow/log.jsonl`（两者都入库，作为提交记录）。全量提交需显式加 `--from-sitemap --all`，只在首次上线或更换 key 时使用。
- 品牌页的 Sitemap lastmod、JSON-LD `dateModified` 与页面上的“本页资料与说明最近更新”都来自 `getBrandContentUpdatedAt()`：取资料核实日期、该品牌来源文件登记日期、已发布测速报告更新日期中最晚的一个。给品牌页加内容时登记来源（`sources.json` 的 `collectedAt`）即可，不要手改日期；`lastVerifiedAt` 只表示套餐与节点资料何时核对过。
- 年度榜单页（`/rankings/2026/`）的 Sitemap lastmod、JSON-LD `dateModified` 与页首的“内容更新”都来自 `getRankingContentUpdatedAt()`（`src/lib/lastmod.ts`）：取页面文案修改日期（`STATIC_PAGES`）、已发布品牌的 `lastVerifiedAt`、套餐的 `verifiedAt`、已发布测速报告的 `updatedAt` 中最晚的一个。新增品牌、套餐或报告时照常填这些日期即可；只改了页面文案才需要手动改 `STATIC_PAGES` 的 lastmod。
- 页脚的“全站内容最近更新”等于 Sitemap 里最大的 lastmod（`getSiteContentUpdatedAt()`），不得改成构建时间或访问时间。构建后的 `seo-audit.mjs` 会核对两者一致，也会核对带 `data-page-updated` 的页面日期与该页的 Sitemap lastmod 一致，不一致则构建失败。
- 榜单页与页脚里的品牌数、套餐数、实测份数、测试日期一律由数据统计（`getStats()`、测速报告清单），不要写死数字。“已发布实测”只统计 `verificationStatus` 为 `owner-measured` 的已发布报告；他人提供的记录不算实测。
- 榜单页用独立的 SEO 标题（`titleSuffix={false}`，以“ - 机场指南”结尾），H1 只写“2026 机场推荐排行榜”；地址与 canonical 固定为 `/rankings/2026/`。
- 没有站长实测的品牌：标题末段写“测速状态”（无任何记录）或“测速记录”（只有他人提供的记录），FAQ 回答“本站暂无独立实测”，页首徽章写“未测试”或“仅有第三方记录”（“已有测试记录”只给有站长实测的品牌）；`brands.json` 的 `speedObservation` 提供“节点表现待观察”说明。拿到站长实测后删除 `speedObservation`（校验脚本会报错提醒）。
- 带 `Article` / `TechArticle` 结构化数据的页面（文章、品牌页、测速报告、年度榜单）必须在正文里有可见署名并链接到 `/author/`；他人提供的测速记录写“整理”，不写“测试”。`npm run seo:deep` 会检查（`ld-author-invisible`）。
- `_headers` 对 `https://:project.pages.dev/*` 设了 `X-Robots-Tag: noindex`，避免 Cloudflare Pages 的默认域名与正式域名重复收录；不要删。
- 上线前后的检查清单与 Bing 站长工具的手动步骤见 `SEO-FINAL-CHECKLIST.md`、`BING-SUBMISSION-REPORT.md`；关键词与页面的对应关系见 `KEYWORD-MAPPING.csv`，新增页面前先查表，避免两个页面抢同一个词。
- Bing/Google 验证标签通过 `PUBLIC_BING_SITE_VERIFICATION` / `PUBLIC_GOOGLE_SITE_VERIFICATION` 注入，未拿到真实值前留空。

## 5. 部署（Cloudflare Pages）

- 构建命令：`npm run build`；输出目录：`dist`；Node 版本：22（环境变量 `NODE_VERSION=22`）。
- 环境变量：`INDEXNOW_KEY`（可选）、`PUBLIC_CONTACT_EMAIL`（可选）、`PUBLIC_BING_SITE_VERIFICATION`、`PUBLIC_GOOGLE_SITE_VERIFICATION`（拿到后再填）。
- 404：Cloudflare Pages 自动使用 `dist/404.html` 并返回 404 状态码。
- `_headers` 提供安全头与缓存策略；`_redirects` 提供 `/rankings/latest/` 别名与未来的 301 对照。
- 远端仓库：`origin` 指向 GitHub 的 `jichangzhinan666/jichang-zhinan.blog`。站长 2026-11-11 决定按**公开仓库**推送（已知悉仓库里有品牌原始资料、站内注明“未公开”的截图与内部 SEO 报告）。公开仓库里的内容任何人可见，GitHub 的 robots.txt 也允许 Bing 抓取仓库里的文件页，所以：不要提交密钥、订阅链接、个人信息或未脱敏的截图；仓库是否公开不影响 Bing 收录网站本身，Cloudflare Pages 也可以连接私有仓库，站长随时可以在 GitHub 把仓库改为私有。
- 提交身份：本仓库的 git 配置已固定为 `jichangzhinan666`（GitHub 隐私邮箱）。不要用其他账号的名字或邮箱提交；新克隆的副本要先设置同样的 `user.name` / `user.email` 再提交。
- **未经站长批准不得部署生产、推送远端仓库或执行真实的 IndexNow 提交。**每次推送都要站长明确同意，上一次的同意不延续到下一次。

## 6. 新增品牌 / 报告的步骤

1. 把资料放入 `source-materials/brands/`，截图放入 `source-materials/evidence/`，并在 `src/data/sources.json` 登记。
2. 在 `brands.json`、`plans.json`（必要时 `speed-tests.json`）中添加记录；`speedTests.evidenceStatus` 与 `latestDatedTest` 必须与报告数据一致（校验脚本会检查）。
3. 证据图加入 `scripts/generate-brand-assets.mjs` 的映射表，运行脚本生成 webp。
4. 更新 `changelog.json` 与相关页面的 `STATIC_PAGES.lastmod`。
5. `npm run build` 通过后再提交。

## 7. UI 约定（2026-11-11 全站审计后确立，详见 `UI_AUDIT_REPORT.md`）

- **用 `hidden` 属性隐藏元素是可靠的**：`global.css` 里有 `[hidden] { display: none !important }`。不要删这条——组件里的 `display: flex / grid` 会覆盖浏览器默认的 `[hidden]`，此前三处筛选因此“只改计数、卡片不消失”。
- **给子组件传 `class` 并在父组件 `<style>` 里写它的规则时**，子组件必须把多余属性（`data-astro-cid-*`）转发到根元素（`Icon.astro` 已转发）；否则规则不生效，需改用 `:global()`。
- **按容器宽度而不是视口宽度做响应式**：同一组件会出现在窄栏和整行里。`RankList`、`SpeedBars`、`ReportCard`、`PlanTable`、`ContactChannels`、首页测速小表都用 `container-type: inline-size` + `@container`。
- **窄屏表格**：名称列不折行、数值列不折行、长说明给最小宽度（`.col-keep` / `.col-text`），放不下由 `.table-wrap` 横向滚动；说明文字很长的表（套餐表、首页测速小表）在窄容器里改为“每条记录下方一整行”，不要把文字挤成每行一两个字。
- **网格列一律写 `minmax(0, 1fr)`**，不要写裸 `1fr`（不可折行的内容会把整页撑出横向滚动）。
- **并排等高卡片**用子网格对齐内部各段（榜单卡片、品牌资料卡片），不要靠 `margin-top: auto` 把按钮压到底而在中间留空。
- **含「｜」、日期或“数字 + 量词”的大标题**用 `<TitleText text={…} />` 渲染（只加不折行的 `<span>`，文字内容不变）；≥768px 的 H1 只在标点和空格处折行。
- **颜色**：实底蓝色按钮 / 选中态用 `--primary-solid`，浅底上的蓝色小字用 `--primary-strong-text`，弱化文字需要 AA 对比度时用 `--muted-strong`；按钮高度固定为 44px（`.btn`）与 36px（`.btn-sm`）。
- **触屏点击区域**：独立成行的文字链接在 `@media (pointer: coarse)` 里补上下内边距（`global.css` 末尾的清单），新增此类链接时把选择器加进去。
- **深色底区块**（首页首屏、榜单页页首、页脚）在两种主题下都是深蓝底：颜色在组件内固定取值，不用浅色主题的文字令牌；键盘焦点环改用浅蓝 `#9cc2ff`（全局的主色蓝在深蓝底上不足 3:1）。页脚按自身宽度切换三种布局（≥1080 左右两栏、640–1079 上下两段、<640 单栏），页脚里的站内链接每个地址只出现一次（披露链接除外）。
- 不存在的功能不要为了“完整”而添加：站内目前没有返回顶部、分享、复制链接按钮，也没有评论区。
