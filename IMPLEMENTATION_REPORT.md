# IMPLEMENTATION_REPORT.md —— 机场指南 2027 首版实施报告

- 项目：机场指南 jichang-zhinan.blog（2027 前瞻版）
- 报告日期：2026-11-10
- 状态：**本地构建、校验与检查全部通过；未部署生产、未推送任何远端仓库、未向搜索引擎提交 IndexNow**（按总指令第 0 节要求等待站长批准）

---

## 1. 总指令第 11 节六个问题的直接回答

### 1.1 首页和各栏目是否完成

已完成，共 50 个 HTML 页面 + 7 个非 HTML 输出，全部静态预渲染：

| 栏目 | URL | 状态 |
| --- | --- | --- |
| 首页（Hero、快捷入口、三栏主区、最新文章、品牌库、测速概览、FAQ） | `/` | 完成 |
| 榜单索引 + 5 个数据派生专题榜 | `/rankings/` | 完成 |
| 2027 机场推荐榜单（编辑整理榜，含排序理由、场景解读、速查表、FAQ） | `/rankings/2027/` | 完成 |
| 品牌评测索引（地区 / 价格 / 功能筛选 + 排序） | `/reviews/` | 完成 |
| 品牌详情 ×8 | `/reviews/{slug}/` | 完成 |
| 测速报告总览 + 报告详情 ×8 | `/speed-tests/`、`/speed-tests/{slug}/` | 完成 |
| 套餐对比（筛选、排序、每 GB 计算器） | `/compare/` | 完成 |
| 使用教程索引 + 6 篇 | `/tutorials/`、`/tutorials/{slug}/` | 完成 |
| 选购指南索引（含新手阅读顺序）+ 6 篇 | `/guides/`、`/guides/{slug}/` | 完成 |
| 机场百科索引（26 条术语表）+ 3 篇 | `/wiki/`、`/wiki/{slug}/` | 完成 |
| 资讯与更新（含更新日志）+ 1 篇 | `/news/`、`/news/{slug}/` | 完成 |
| 站内搜索（noindex，本地索引） | `/search/` | 完成 |
| 关于 / 方法 / 编辑政策 / 披露 / 隐私 / 联系 | `/about/` `/methodology/` `/editorial-policy/` `/disclosure/` `/privacy/` `/contact/` | 完成 |
| 404 | `/404.html`（Cloudflare Pages 自动返回 404 状态） | 完成 |
| Sitemap / RSS / 搜索索引 / robots / 响应头 / 重定向 | `/sitemap.xml` `/rss.xml` `/search-index.json` `/robots.txt` `/_headers` `/_redirects` | 完成 |

### 1.2 已导入多少真实品牌、套餐、测速报告、文章

数据校验脚本输出（`node scripts/validate-data.mjs`）：

```
{"brands":8,"publishedBrands":8,"planTiers":66,"priceRecords":153,"reports":9,"publishedReports":8,"ownerReports":4,"articles":16}
通过：0 个错误，0 个警告
```

| 类别 | 数量 | 说明 |
| --- | --- | --- |
| 品牌 | 8 | 灵动云、飞V、大佬云、飞猫云、浪网、暮光加速、微风网络、隐形人；全部 `published` |
| 套餐档位 | 66 | 周期套餐 31、年付小包 8、不限时流量包 20、独享/定制 7 |
| 价格记录 | 153 | 每个“档位 × 周期”一条，人民币名义价，含来源文件与核实日期 |
| 测速记录 | 9（8 份已发布） | 4 份站长 2026-11-10 实测报告（隐形人 香港03、飞V 新加坡、浪网 香港、灵动云 日本5）；1 份资料文字记录（灵动云 2026-10-28 晚高峰）；1 份带时间戳截图（浪网 2026-07-19 MiaoKo）；2 份未标注日期截图（微风网络、飞猫云）；1 份归属待确认（飞猫测速图 (2)）为 `review` 状态，不发布 |
| 证据图片 | 13 | `source-materials/evidence/` 原图 → `src/assets/evidence/*.webp`（≤1600px） |
| 文章 | 16 | 指南 6、教程 6、百科 3、资讯 1；全部 `published`，发布日期 2026-11-10 |
| 术语 | 26 | `src/data/glossary.json`，渲染于 `/wiki/#glossary` |

### 1.3 哪些资料待站长上传或核实

见第 5 节“无法确认与待人工处理事项”，共 14 项。最重要的 6 项：

1. 联系邮箱（`PUBLIC_CONTACT_EMAIL`）与作者署名/简介。
2. “飞猫测速图 (2).webp” 的归属（订阅标识 `*.cc-1744` 与另两张飞猫截图不一致）。
3. 隐形人优惠码 `yxr888` 的折扣幅度与适用范围。
4. 4 份站长实测的本地接入运营商与城市、原始截图。
5. 大佬云、暮光加速的任何测速记录。
6. Bing Webmaster 验证值与 IndexNow Key（拿到后填环境变量）。

### 1.4 SEO 自动检查和构建结果

- `npx astro check`：0 errors，0 warnings。
- `npm run build`：50 page(s) built；prebuild 数据校验通过；postbuild SEO 审计 **50 页（可索引 48，noindex 2），错误 0，警告 0**。
- Sitemap：48 个 URL，与可索引页面一一对应；`lastmod` 全部为真实内容日期（2026-11-10）。
- robots.txt 引用的 `https://jichang-zhinan.blog/sitemap.xml` 为真实构建输出（自定义端点，不是 `sitemap-index.xml`）。
- 审计覆盖项：lang、唯一 title/description、单一 H1、标题层级、自引用 canonical、og/twitter、图片 alt、站内死链、尾部斜杠一致性、孤岛页、JSON-LD 可解析且不含评分字段、`<time>`/JSON-LD 未来日期、文章正文长度、演示占位字符串、sitemap↔页面↔noindex 一致性、robots↔sitemap 一致性。

### 1.5 Cloudflare Pages 的构建命令与输出目录

| 配置项 | 值 |
| --- | --- |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 仓库根目录 |
| 环境变量 | `NODE_VERSION=22`；可选 `INDEXNOW_KEY`、`PUBLIC_CONTACT_EMAIL`、`PUBLIC_BING_SITE_VERIFICATION`、`PUBLIC_GOOGLE_SITE_VERIFICATION` |
| 404 | `dist/404.html`，Pages 自动以 404 状态码返回 |
| 响应头 / 重定向 | `public/_headers`、`public/_redirects` 随构建进入 `dist/` |

### 1.6 Bing Webmaster 与 IndexNow 还需要站长亲自完成的操作

见第 8 节完整步骤。概括：① 在 Bing Webmaster Tools 添加站点并选择验证方式（meta 标签值填入 `PUBLIC_BING_SITE_VERIFICATION` 后重新部署，或上传 Bing 提供的 XML 文件到 `public/`）；② 提交 Sitemap `https://jichang-zhinan.blog/sitemap.xml`；③ 生成 IndexNow Key，设置 `INDEXNOW_KEY` 并重新部署，确认 `https://jichang-zhinan.blog/<KEY>.txt` 可访问；④ 首次用 `node scripts/indexnow.mjs --from-sitemap` 提交，之后只在发布/更新/删除 URL 时提交；⑤ 在 Bing Webmaster 观察 IndexNow 接收、URL 检查与搜索表现。**URL 已提交 ≠ 已收录，本站不承诺任何排名。**

---

## 2. 项目扫描结果（开发前）

- 工作区原状：仅 `airport_guide_claude_2027/`（总指令 + 参考图）与同内容的 zip，无任何现有代码、`package.json` 或部署配置 → 按总指令第 7 节新建 Astro 项目。
- `source-materials/` 原不存在 → 已创建并从 `C:\Users\USERR\Desktop\更改后的 MD\` 复制资料（原件未改动）：`brands/`（8 个 txt）、`evidence/`（8 张截图 + `reports/` 5 张站长实测报告图）、`templates/资料填写.txt`。
- 参考图 `homepage_reference.png` 已读取：页头（纸飞机图标 + 站名 + 域名 + 胶囊导航 + 搜索/主题按钮）、深海军蓝 Hero + 数字地球 + 浮动地区标签、六个快捷入口、三栏主区（榜单 / 精选轮播 + 两小卡 / 搜索 + 新手上手 + 工具 + 订阅）、最新文章 Tab。已按此结构实现，参考图中的虚构品牌（飞云机场等）、评分（9.7）、阅读量（12,368）、未来日期一律未采用，并写入校验脚本的禁用字符串。

## 3. 技术实现

- Astro 7.4.8（`output: 'static'`，`trailingSlash: 'always'`，目录式 URL）+ TypeScript 5.9 + 原生 CSS 设计令牌（`src/styles/global.css`，primary #155EEF / primaryDark #0C2A68 / text #101828 / muted #667085 / background #EFF5FF / border #D9E6FB）。无 Tailwind、无前端框架岛，交互为少量原生 `<script>`。
- 内容集合：`src/content.config.ts`（Astro 7 写法：`glob` loader、`z` 来自 `astro/zod`、`render(entry)`）；文章 frontmatter 含 `status / publishedAt / updatedAt / faq / relatedBrands / references`。
- 数据层：`src/data/*.json` + `src/lib/types.ts`（Brand / PlanTier→Plan / SpeedTestReport / SourceRecord 等，字段与总指令第 4 节对应并扩展了证据等级与站长报告结构）；`src/lib/data.ts` 提供拍平、每 GB 计算、`computeRanking()` 与专题榜。
- 响应式：≥1200px 三栏（35/40/25）；768–1199px 双栏，工具区下移；<768px 单栏 + 折叠菜单；表格在 `.table-wrap` 内横向滚动；`prefers-reduced-motion` 下关闭轨道/飞机/脉冲动画与轮播自动切换。
- 暗色模式：`<html data-theme>` + `localStorage('jz-theme')`，首屏内联脚本防闪烁。
- 搜索：`/search-index.json`（文章全文摘录、品牌别名/关键词、报告、术语、页面）+ 页头抽屉即时结果 + `/search/` 结果页，纯本地匹配。
- 图片：证据图经 sharp 转 webp，`<Image>` 输出 3 档 srcset、`loading="lazy"`；装饰均为 CSS/SVG 原创；品牌无官方 Logo，使用首字标识并在 `aria-label` 注明“非官方 Logo”。
- 结构化数据：WebSite（含 SearchAction）+ Organization 全站；BreadcrumbList 全部内页；Article/TechArticle（文章、品牌页、报告页）；ItemList（首页、榜单、索引页）；FAQPage（真实问答）。无 Review / AggregateRating。
- 推广链接：`rel="sponsored nofollow noopener noreferrer"`，品牌页与页脚、`/disclosure/` 三处披露。

## 4. 资料清单与字段映射

| 来源文件 | 类型 | 整理日期 | 映射到 | 可信度说明 |
| --- | --- | --- | --- | --- |
| brands/灵动云.txt | 品牌资料 | 2026-11-09 | brands.lingdongyun、plans ×9、speed-tests `lingdongyun-2026-10-28-evening-peak` | 推广方资料；晚高峰为文字记录，无截图、无工具名 |
| brands/FLYV.txt | 品牌资料 | 2026-11-09 | brands.flyv、plans ×9 | 长周期只给比例，未收录金额 |
| brands/大佬云.txt | 品牌资料 | 2026-11-10 | brands.dalaoyun、plans ×7 | “入门价低于 34 家中位数”样本未提供，未采用 |
| brands/飞猫云.txt | 品牌资料 | 2026-11-09 | brands.flycat、plans ×7 | 节点数 63 与截图 49 不一致 |
| brands/浪网.txt | 品牌资料 | 2026-11-09 | brands.langwang、plans ×9 | 英文名 WaveNet 取自站长报告图 |
| brands/暮光加速.txt | 品牌资料 | 2026-11-09 | brands.twilight、plans ×9 | 无测速 |
| brands/微风网络.txt | 品牌资料 | 2026-11-09 | brands.breezenet、plans ×7 | 节点数 53 与截图 50 不一致 |
| brands/隐形人.txt | 品牌资料 | 2026-11-09 | brands.invisible、plans ×9 | 优惠码折扣未注明；马来西亚节点数待确认 |
| evidence/reports/隐形人_香港节点_实测报告.png | 站长实测报告图 | 2026-11-10 11:43 | `invisible-2026-11-10-hongkong03`（速度、20 节点延迟、5 地区延迟、23 项连通性、YouTube 统计） | 原始截图未附；本地网络未标注 |
| evidence/reports/FlyV_新加坡节点_实测报告.png | 站长实测报告图 | 2026-11-10 12:09 | `flyv-2026-11-10-singapore`（速度、出口 AS9664、23 项连通延迟） | 未标注套餐与客户端 |
| evidence/reports/浪网_香港节点_实测报告.png | 站长实测报告图 | 2026-11-10 13:31 | `langwang-2026-11-10-hongkong`（速度、出口 AS32167、23 项连通延迟） | 未标注套餐与客户端 |
| evidence/reports/灵动云_实测报告_浅色版/深色版.png | 站长实测报告图 | 2026-11-10 10:54 | `lingdongyun-2026-11-10-japan5`（速度、5 地区 55 节点延迟、23 项连通性、YouTube 两段统计） | 两版数据相同 |
| evidence/浪网测速图.jpg | MiaoKo 截图 | 测试 2026-07-19 16:18:50 CST | `langwang-2026-07-19-miaoko`（5 地区 TLS RTT / HTTPS / 平均 / 最高速度区间） | 珠海联通 9Gbps 服务器侧；人工转录 |
| evidence/微风测速图.webp、微风节点图.webp | MiaoKo 截图 | 未标注 | `breezenet-miaoko-undated` | 区间为约数 |
| evidence/飞猫测速图.webp、(3).webp、(4).webp | SpeedCentre+ 截图 | 未标注 | `flycat-speedcentre-undated`（8 地区区间 + 拓扑 ASN；(4) 分辨率不足未提取） | 入口 AS8143（US）无法解释 |
| evidence/飞猫测速图 (2).webp | MiaoKo 截图 | 未标注 | `flycat-miaoko-attribution-pending`（status=review，不发布） | 订阅标识不一致，归属待确认 |
| evidence/飞猫测速图 (5).webp | 价格表截图 | — | 飞猫云星耀/星环/银河版两年付、三年付价格（与折扣规则吻合才采用） | 低分辨率；宇宙版两年/三年付不一致未收录 |
| templates/资料填写.txt | 模板 | — | `/about/`、`/contact/` 中的收录流程说明 | — |

## 5. 无法确认与待人工处理事项

1. 联系邮箱未配置：`/contact/` 显示“联系邮箱尚未配置”，不显示虚构邮箱。设置 `PUBLIC_CONTACT_EMAIL` 后自动显示。
2. 作者署名与简介缺失：全站署名“机场指南编辑部”，`/about/` 注明待补充。
3. 飞猫测速图 (2) 归属待确认（`*.cc-1744` vs `*.*.com-1159` / `*.com-8733`），未公开。
4. 飞猫云宇宙版两年付/三年付：截图数字与“两年 7 折、三年 6 折”规则不符，未收录。
5. 隐形人 `yxr888` 折扣幅度与适用范围未注明；隐形人对第三方客户端的描述前后不一致（“支持主流第三方客户端” vs “不推荐导入 Clash”），已在品牌页 dataCaveats 公开。
6. 隐形人马来西亚节点数“待确认”；站长报告图只标 5 个地区。
7. 飞V 季付/半年付/年付只有比例无金额，表中留空。
8. 微风网络节点数（资料 53 / 截图 50）、飞猫云节点数（资料 63 / 截图 49）不一致，已在品牌页公开。
9. 4 份站长实测未标注本地运营商与城市，原始截图未随资料附上；报告页已写明该局限，且全站不做跨品牌速度比较。
10. 大佬云、暮光加速无任何测速记录，榜单按规则排在有证据的品牌之后。
11. 灵动云 2026-10-28 晚高峰记录无工具名与城市。
12. 大佬云、微风网络“34 家中位数 / 并列第 1”类对比说法样本未提供，未采用。
13. 5 个品牌的推广链接域名含同一前缀 `varnexa`，且定制线路规格价格完全一致；无法核实运营关系，已在 `/disclosure/` 如实披露、未在品牌页下结论。
14. 丢包率：所有资料均未提供，页面显示“—”。

## 6. 页面交互与响应式验证记录

验证方式：`npm run preview`（dist 静态预览）+ 桌面应用内置浏览器（DOM / 脚本检查）+ 本机 Chrome 无头模式截图（1440px 桌面；因 Chrome 最小窗口宽度限制，390px 截图被裁切，移动端改用真实浏览器 375×812 视口的 DOM 度量验证）。

| 检查项 | 结果 |
| --- | --- |
| 首页桌面布局（1440px） | 与参考图结构一致：页头胶囊导航、Hero 地球 + 4 个数据驱动的地区标签（8/8 品牌覆盖）、6 快捷入口、三栏（榜单 / 轮播 + 两小卡 / 搜索 + 上手 + 工具 + RSS）、文章 Tab、品牌库、测速概览、FAQ |
| 移动端（375px） | `scrollWidth === clientWidth === 375`，无页面级横向溢出；Hero 4 个浮动标签与文字无重叠；表格仅在 `.table-wrap` 内滚动 |
| 折叠菜单 | 点击后 `#main-nav.open`、`aria-expanded=true`，29 个链接可达；Esc 关闭 |
| 深色模式 | 切换后 `data-theme=dark`、`localStorage.jz-theme=dark`、背景 `rgb(11,19,36)`，再次点击恢复 |
| 搜索抽屉 | `<dialog>` 打开并聚焦；输入“优惠码”得到 8 条即时结果，首条指向 `/guides/pianyi-jichang-taocan-bijiao-fangfa/`；回车进入 `/search/?q=` |
| 首页文章 Tab | “机场百科”显示 3 / 隐藏 5；每个栏目至少 1 篇（修复了资讯 Tab 为空的问题） |
| 轮播 | 3 张精选、3 个圆点，前后按钮与圆点可用，悬停/聚焦暂停，`prefers-reduced-motion` 不自动播放 |
| FAQ | `<details>` 展开，答案文本 135 字 |
| 品牌库筛选 | “可导入第三方客户端” → 灵动云、飞猫云、大佬云；再加“韩国” → 飞猫云、大佬云；按入门价排序：大佬云 19.99 → 灵动云 20 → 暮光 20 → 隐形人 24 → 飞V/微风/飞猫 25 → 浪网 30 |
| 套餐对比 | 月流量 ≥500 GB + 每 GB 升序 → 15/31 档，前两位浪网商业、微风御风（¥0.10/GB）；计算器 204 元 / 100 GB / 12 月 / 0.8 折 → 实付 ¥163.2、折合月付 ¥13.6、每 GB ¥0.136 |
| 报告页 | H1 正确、JSON-LD 为 Organization/WebSite/TechArticle/BreadcrumbList、canonical 自引用、证据图 3 档 srcset |
| 控制台 | 所有检查页面无 JS 错误 |

**未做的验证**：Core Web Vitals（LCP / INP / CLS）未在真实设备与线上环境测量，不声称达标；页面无第三方脚本、无网络字体、首屏图为 CSS/SVG，具备良好基础，上线后请用 PageSpeed Insights / Bing Webmaster 的站点扫描复测。

## 7. 构建与检查命令（实际执行记录）

```bash
node scripts/validate-data.mjs
# [validate-data] 统计： {"brands":8,"publishedBrands":8,"planTiers":66,"priceRecords":153,"reports":9,"publishedReports":8,"ownerReports":4,"articles":16}
# [validate-data] 通过：0 个错误，0 个警告。

node scripts/generate-brand-assets.mjs
# 写入 favicon.svg / favicon-32.png / apple-touch-icon.png / images/logo-512.png / images/og-default.png
# 13 张证据图 → src/assets/evidence/*.webp

npx astro check
# Result (49 files): 0 errors, 0 warnings

npm run build
# [build] 50 page(s) built
# [indexnow-key] 未设置 INDEXNOW_KEY，跳过 key 文件
# [seo-audit] 页面 50（可索引 48，noindex 2）；错误 0，警告 0

npm run indexnow:dry
# 干运行：从 dist/sitemap.xml 读取 48 个 URL，打印 payload，不发送
```

## 8. 部署与搜索引擎接入步骤（需站长执行）

### 8.1 Cloudflare Pages

1. 把项目推送到站长自己的 Git 仓库（本次未初始化远端、未推送）。
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → 连接仓库。
3. 构建设置：Framework preset **Astro**；Build command `npm run build`；Output directory `dist`。
4. 环境变量：`NODE_VERSION=22`；按需添加 `INDEXNOW_KEY`、`PUBLIC_CONTACT_EMAIL`、`PUBLIC_BING_SITE_VERIFICATION`、`PUBLIC_GOOGLE_SITE_VERIFICATION`。
5. 首次部署后在 Custom domains 绑定 `jichang-zhinan.blog`（DNS 托管在 Cloudflare 时自动配置），确认 `https://jichang-zhinan.blog/`、`/sitemap.xml`、`/robots.txt`、`/rss.xml`、随机不存在路径返回 404。
6. 若改用 `wrangler pages deploy dist`，同样需要站长登录授权。

### 8.2 Bing Webmaster Tools

1. 登录 bing.com/webmasters → 添加站点 `https://jichang-zhinan.blog`。
2. 验证：选“Meta 标签”时把 `content` 值填入 `PUBLIC_BING_SITE_VERIFICATION` 并重新部署；选“XML 文件”时把 `BingSiteAuth.xml` 放入 `public/` 后部署；选 DNS 时在 Cloudflare 添加 CNAME。验证前 `BaseLayout` 不会输出任何验证标签。
3. Sitemaps → 提交 `https://jichang-zhinan.blog/sitemap.xml`。
4. 可同步在 Google Search Console 完成域名验证与 Sitemap 提交。

### 8.3 IndexNow

1. 在 Bing Webmaster 的 IndexNow 面板生成 Key，或自定义 8–128 位字母数字短横线。
2. Cloudflare Pages 设置 `INDEXNOW_KEY`，重新部署；构建后脚本会生成 `dist/<KEY>.txt`，确认 `https://jichang-zhinan.blog/<KEY>.txt` 可访问且内容为 Key。
3. 首次提交（本地执行）：

```bash
npm run build
```

```bash
set INDEXNOW_KEY=你的Key && node scripts/indexnow.mjs --from-sitemap
```

4. 之后只在真实发布 / 修改 / 删除 URL 时执行 `node scripts/indexnow.mjs --urls <URL1>,<URL2>` 或 `--from-sitemap --since YYYY-MM-DD`；不要重复提交全站，不要在构建里自动提交。
5. 在 Bing Webmaster 观察 IndexNow 接收记录 → URL 检查 → 搜索表现。提交成功只代表收到通知。

## 9. 关于“2027-01-01 登上 Page 1 前三”目标

本次实现做到的是：全部内容为可抓取 HTML、规范 URL 与 canonical 唯一、Sitemap 与 robots 一致、结构化数据真实、每页独立 title/description/H1、内链完整无死链、无虚构数据可被判为低质量。**没有任何技术手段能承诺某个日期的排名**，排名取决于 Bing 的抓取与评估节奏、竞争页面、站点历史与外部引用。建议上线后：尽早完成 Bing Webmaster 验证与 Sitemap 提交；持续补充带时间戳的实测与品牌更新（更新日志已就位）；补齐作者与联系信息以增强可信度；在 2027 年初按方法说明第五节完成同网络、同时段的多品牌重复测试后再发布“实测排名”。

## 10. 文件变更清单（新增）

- 配置：`package.json`、`astro.config.mjs`、`tsconfig.json`、`.gitignore`、`.node-version`、`.env.example`、`.claude/launch.json`、`CLAUDE.md`、`README.md`
- 数据：`src/data/{brands,plans,speed-tests,sources,glossary,changelog,evidence-map}.json`
- 库：`src/lib/{types,site,data,seo,articles,evidence}.ts`、`src/content.config.ts`
- 布局与组件：`src/layouts/{BaseLayout,ArticleLayout,StaticPageLayout}.astro`；`src/components/{Header,Footer,Hero,QuickLinks,RankList,FeatureColumn,Sidebar,ArticleCard,BrandMark,EvidenceBadge,PlanTable,ReportCard,SpeedBars,FAQ,Breadcrumbs,Icon}.astro`
- 页面：`src/pages/{index,compare,search,404,about,methodology,editorial-policy,disclosure,privacy,contact}.astro`、`src/pages/rankings/{index,2027}.astro`、`src/pages/reviews/{index,[slug]}.astro`、`src/pages/speed-tests/{index,[slug]}.astro`、`src/pages/[category]/{index,[slug]}.astro`、`src/pages/{sitemap.xml,rss.xml,search-index.json}.ts`
- 内容：`src/content/articles/{guides×6,tutorials×6,wiki×3,news×1}.md`
- 资产：`src/assets/evidence/*.webp`（13）、`public/{robots.txt,_headers,_redirects,favicon.svg,favicon-32.png,apple-touch-icon.png}`、`public/images/{og-default.png,logo-512.png}`
- 脚本：`scripts/{validate-data,generate-brand-assets,seo-audit,indexnow,write-indexnow-key}.mjs`
- 素材：`source-materials/{brands,evidence,evidence/reports,templates}`（复制自站长目录，原件未改）
