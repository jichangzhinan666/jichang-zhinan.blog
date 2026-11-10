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
npm run indexnow:dry   # IndexNow 干运行（从 dist/sitemap.xml 读取 URL，不发送）
```

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
| `src/lib/seo.ts` | JSON-LD 构造（WebSite/Organization/Breadcrumb/Article/ItemList/FAQ） |
| `src/pages/sitemap.xml.ts` | 自定义 Sitemap（只含可索引页，lastmod 为真实内容日期） |
| `src/pages/search-index.json.ts` | 站内搜索索引 |
| `scripts/` | validate-data / generate-brand-assets / seo-audit / indexnow / write-indexnow-key |
| `public/robots.txt` `_headers` `_redirects` | 爬虫、响应头与重定向规则（Cloudflare Pages） |

## 3. 内容硬性约束（不得违反）

1. **全站简体中文**；品牌英文名、协议名等专有名词保留原文。
2. **资料优先、禁止虚构**：价格、流量、节点数、优惠码、客服政策只能来自 `source-materials/`；测速数值只能来自站长报告图、资料文字记录或用户截图。资料没有的字段用 `null` / 空数组，页面显示“资料未提供”。
3. **不显示评分**：任何页面与 JSON-LD 都不得出现 `ratingValue`、`aggregateRating`、“9.x 分”。榜单是“站长编辑推荐榜”，名次来自 `brands.json` 的 `editorialRank`（1..n 唯一，由站长指定并记录到更新日志），页面必须同时展示证据等级、入门价、地区数等可核查事实。
4. **日期真实**：`publishedAt` / `updatedAt` / `testedAt` 不得为未来日期；只在内容实质变更时改 `updatedAt` 与 `STATIC_PAGES.lastmod`，不要随构建自动改。未完成的测试不得标为“已实测”。当前为“2027 前瞻版”（`SITE.isPreview`），进入 2027 后更新文案。
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
- IndexNow：`INDEXNOW_KEY` 只放环境变量；`scripts/write-indexnow-key.mjs` 在构建后写 `dist/<KEY>.txt`；推送只用 `scripts/indexnow.mjs` 手动执行，默认干运行。
- Bing/Google 验证标签通过 `PUBLIC_BING_SITE_VERIFICATION` / `PUBLIC_GOOGLE_SITE_VERIFICATION` 注入，未拿到真实值前留空。

## 5. 部署（Cloudflare Pages）

- 构建命令：`npm run build`；输出目录：`dist`；Node 版本：22（环境变量 `NODE_VERSION=22`）。
- 环境变量：`INDEXNOW_KEY`（可选）、`PUBLIC_CONTACT_EMAIL`（可选）、`PUBLIC_BING_SITE_VERIFICATION`、`PUBLIC_GOOGLE_SITE_VERIFICATION`（拿到后再填）。
- 404：Cloudflare Pages 自动使用 `dist/404.html` 并返回 404 状态码。
- `_headers` 提供安全头与缓存策略；`_redirects` 提供 `/rankings/latest/` 别名与未来的 301 对照。
- **未经站长批准不得部署生产、推送远端仓库或执行真实的 IndexNow 提交。**

## 6. 新增品牌 / 报告的步骤

1. 把资料放入 `source-materials/brands/`，截图放入 `source-materials/evidence/`，并在 `src/data/sources.json` 登记。
2. 在 `brands.json`、`plans.json`（必要时 `speed-tests.json`）中添加记录；`speedTests.evidenceStatus` 与 `latestDatedTest` 必须与报告数据一致（校验脚本会检查）。
3. 证据图加入 `scripts/generate-brand-assets.mjs` 的映射表，运行脚本生成 webp。
4. 更新 `changelog.json` 与相关页面的 `STATIC_PAGES.lastmod`。
5. `npm run build` 通过后再提交。
