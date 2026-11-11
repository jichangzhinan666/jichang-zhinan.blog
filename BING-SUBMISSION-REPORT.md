# Bing 提交报告：Sitemap 与 IndexNow 的配置和提交状态

- 报告日期：2026-11-11
- 正式域名：`https://jichang-zhinan.blog/`
- 配套文件：[SEO-AUDIT-REPORT.md](SEO-AUDIT-REPORT.md)、[SEO-FINAL-CHECKLIST.md](SEO-FINAL-CHECKLIST.md)

---

## 1. 现在的状态

**网站已于 2026-11-11 傍晚上线，但还没有向 Bing 提交任何东西。** 没有提交 Sitemap，也没有做过任何真实的 IndexNow 提交。

下面四件事是先后关系，前一件成了不代表后一件成了。本报告分开记录。

| 阶段 | 状态 | 怎么确认 |
| --- | --- | --- |
| 1. 部署成功，网站能访问 | **已完成（2026-11-11）**。Cloudflare Pages 构建成功；`npm run seo:live` 实测 50 个地址全部返回 200，HTTPS 证书有效，HTTP 以 301 跳到 HTTPS。还差一项：`www` 目前直接返回 200，没有跳到主域名 | 同左 |
| 2. Bing 收到了通知（Sitemap 已提交、IndexNow 已接收） | **未进行** | Bing 站长工具的“站点地图”显示成功；`.indexnow/log.jsonl` 里有 200 或 202 的记录 |
| 3. Bing 收录了页面 | **还没有开始**。上线当天中午（上线前）用 `site:jichang-zhinan.blog` 查询是 0 条，上线后没有再查 | Bing 站长工具的“URL 检查”显示已编入索引 |
| 4. 页面有了排名 | **无法验证** | Bing 站长工具的“搜索表现”出现曝光、点击和平均排名 |

第 2 步成功通常是即时的。第 3 步要几天到几周，新域名往往更慢。第 4 步没有保证。

---

## 2. Sitemap

地址是 `https://jichang-zhinan.blog/sitemap.xml`，单个文件，不是索引文件。由 `src/pages/sitemap.xml.ts` 在构建时生成，每个地址只有 `<loc>` 和 `<lastmod>` 两项。

下面的数字是 2026-11-11 傍晚上线时的状态（50 个地址）。当天晚些时候新增了 1 篇教程《海外 Apple ID 指南》并推送上线，线上的 Sitemap 现在是 51 个地址：教程由 6 篇变为 7 篇，更新日期为 35 个 2026-11-10、16 个 2026-11-11。上线后逐个请求，51 个全部返回 200。

| # | 检查项 | 结果 | 说明 |
| --- | --- | --- | --- |
| 1 | 重要页面都在 Sitemap 里 | 通过 | 50 个可索引页面全部在内，一一对应 |
| 2 | 地址是有效的规范地址 | 通过 | 全部是 `https://jichang-zhinan.blog/` 开头、带尾部斜杠，与各页的 canonical 完全相同 |
| 3 | 没有重复地址 | 通过 | 50 个互不相同 |
| 4 | 没有不存在或会跳转的地址 | 通过 | 每个地址在构建结果里都有对应页面。会跳转的别名 `/rankings/latest/` 和测速教程的旧地址都不在其中 |
| 5 | 品牌、文章、榜单、教程无遗漏 | 通过 | 见下方分类 |
| 6 | 更新日期真实 | 修复后通过 | 38 个是 2026-11-10，12 个是 2026-11-11。日期来自内容本身，不随构建变化 |
| 7 | XML 结构有效 | 通过 | 能被标准解析器解析，命名空间正确 |
| 8 | robots.txt 声明了 Sitemap | 通过 | 最后一行是 `Sitemap: https://jichang-zhinan.blog/sitemap.xml` |
| — | 线上能否访问 | 通过 | 2026-11-11 上线后实测：线上的 sitemap.xml 与本机构建逐字节相同；50 个地址逐个请求全部返回 200，canonical 都指向自身 |

50 个地址的构成：首页 1；榜单 2；品牌资料库 1 与品牌页 8；测速索引 1 与测速记录 8；套餐对比 1；教程栏目 1 与教程 6；指南栏目 1 与指南 7；百科栏目 1 与百科文章 3；资讯栏目 1 与资讯 1；作者介绍 1；关于、方法、编辑政策、推广披露、隐私、联系 6。

不在 Sitemap 里的 3 个页面是有意排除的：404 页、站内搜索、个人中心，它们都带 `noindex`。

### 关于更新日期

修复前，暮光加速、微风网络、飞猫云三个品牌页的更新日期停在 2026-11-09，比页面的发布日期还早。现在品牌页的日期取三个日期里最晚的一个：资料核实日期、该品牌来源文件的登记日期、已发布测速记录的更新日期。给品牌页加内容时，只要在 `sources.json` 登记来源，日期会自动跟上，不需要手改。

### robots.txt

```
User-agent: *
Allow: /

Sitemap: https://jichang-zhinan.blog/sitemap.xml
```

没有屏蔽任何路径。样式和脚本所在的 `/_astro/` 可以抓取。站内搜索页用页面里的 `noindex` 处理，没有写进 robots.txt，因为爬虫得先能读到页面才看得见 `noindex`。

---

## 3. IndexNow

### 工作方式

1. 你生成一个 key，放进 Cloudflare Pages 的环境变量 `INDEXNOW_KEY`。key 不写进仓库。
2. 每次构建后，`scripts/write-indexnow-key.mjs` 在网站根目录写出 `<key>.txt`，内容就是 key。Bing 靠这个文件确认提交者拥有这个域名。
3. 部署完成后，在本机运行 `npm run indexnow`。脚本对比当前的 Sitemap 和上次提交的记录，只提交有变化的地址。

提交发往 `https://api.indexnow.org/indexnow`。按 IndexNow 的官方说明，提交给任何一个入口的地址都会自动分享给所有参与的搜索引擎，Bing 是其中之一。单次最多 10,000 个地址。

### 八项要求对照

| # | 要求 | 状态 | 说明 |
| --- | --- | --- | --- |
| 1 | 生成有效的 key | **待你操作** | 还没有 key。两个脚本都会检查格式：8–128 位，只含字母、数字和短横线 |
| 2 | key 文件可以公开访问 | **未进行** | 站点已上线，但还没有生成 key。机制已就绪：提交前脚本会先请求 `https://jichang-zhinan.blog/<key>.txt`，返回的不是 200 或内容对不上，就不提交 |
| 3 | 提交的地址与验证域名一致 | 已实现 | 不属于 `jichang-zhinan.blog` 的地址会被跳过 |
| 4 | 新增文章时提交 | 已实现，需手动运行 | 新地址出现在 Sitemap 里，下次运行时归入“新增” |
| 5 | 已有文章实质更新时提交 | 已实现，需手动运行 | 更新日期比上次提交时晚，归入“更新” |
| 6 | 处理已删除或移动的页面 | 已实现，需手动运行 | 上次提交过、现在不在 Sitemap 里的地址归入“移除”，同样提交，让搜索引擎重新抓取并看到 404 或跳转 |
| 7 | 记录提交时间、响应码、失败原因 | 已实现 | 每次真实提交追加一行到 `.indexnow/log.jsonl`。key 文件校验失败、网络失败也会记录 |
| 8 | 不重复提交没有变化的页面 | 已实现 | 没有变化时脚本直接退出，不发送。全量提交必须显式加 `--from-sitemap --all` |

第 4–6 项写的是“需手动运行”，不是全自动。这是有意的：项目规定真实提交要经你批准，而且构建和部署之间有时间差，在构建时提交会让 Bing 来抓一个还没更新的页面。想要全自动，见第 5 节的 Crawler Hints。

### 已做的验证

- 干运行（不发送）：当前构建有 50 个地址，因为还没有提交记录，全部归入“新增”。
- 用一份临时的提交记录模拟：正确识别出新增 1、更新 1、移除 1；内容没变时提示“没有发生变化的 URL，不提交”。临时记录已删除。
- 没有做真实提交。仓库里目前没有 `.indexnow/` 目录，第一次真实提交成功后才会出现。

### 响应码的含义

| 响应码 | 含义 | 该怎么办 |
| --- | --- | --- |
| 200 | 已收到 | 无 |
| 202 | 已收到，key 稍后校验 | 过一会儿在 Bing 站长工具里确认 |
| 400 | 请求格式不对 | 把输出发给我排查 |
| 403 | key 无效 | 检查 `<key>.txt` 能不能打开、内容对不对 |
| 422 | 地址不属于这个域名，或 key 与域名不匹配 | 检查域名和 key |
| 429 | 提交太频繁 | 过一段时间再试 |

200 和 202 只表示 Bing **收到了通知**，不表示已经抓取，更不表示已经收录。

---

## 4. 上线当天的步骤

以下都需要你操作，我没有权限也不应该代做。

### 4.1 Cloudflare

2026-11-11 的进度：第 1、3 步已完成（主域名已绑定，HTTP 实测以 301 跳到 HTTPS）。第 2 步未完成，`www` 目前直接返回 200。第 4 步里的 `INDEXNOW_KEY` 与 Bing 验证值还没有设置；`NODE_VERSION` 是否填了我没有看到，构建已经成功（仓库里的 `.node-version` 文件也能指定版本）。Cloudflare 后台是你自己操作的，以上是我从线上响应推断的。

1. 在 Cloudflare Pages 项目的“自定义域”里添加 `jichang-zhinan.blog`。
2. 让 `www.jichang-zhinan.blog` 跳转到根域名：先给 `www` 加一条经过代理的 DNS 记录，再建一条重定向规则，把 `www.jichang-zhinan.blog/*` 以 301 跳到 `https://jichang-zhinan.blog/`并保留路径。
3. 打开“始终使用 HTTPS”。
4. 在环境变量里设置 `NODE_VERSION=22`、`INDEXNOW_KEY`，拿到 Bing 的验证值后再加 `PUBLIC_BING_SITE_VERIFICATION`。
5. 检查安全设置：不要有会拦截或质询搜索引擎爬虫的自定义规则。

生成 key 可以用这条命令，得到 32 位的字母数字串：

```powershell
[guid]::NewGuid().ToString("N")
```

### 4.2 Bing 站长工具

下面用到的菜单，括号里是英文界面的名称。中文界面的叫法可能略有不同，以实际显示为准：站点地图（Sitemaps）、URL 检查（URL Inspection）、网站资源管理器（Site Explorer）、搜索表现（Search Performance）、IndexNow。

1. 打开 `https://www.bing.com/webmasters`，用微软账号登录。
2. 添加站点 `https://jichang-zhinan.blog/`。
3. 验证所有权。三种方式选一种：
   - **meta 标签**（本项目已支持）：把 Bing 给的 `content` 值填进 Cloudflare Pages 的环境变量 `PUBLIC_BING_SITE_VERIFICATION`，重新部署，再回 Bing 点验证。
   - **DNS 记录**：按 Bing 的提示在 Cloudflare 加一条 CNAME，不需要重新部署。
   - **XML 文件**：把 Bing 给的 `BingSiteAuth.xml` 放进项目的 `public/` 目录，重新部署。
4. 在“站点地图”里提交 `https://jichang-zhinan.blog/sitemap.xml`。提交后确认状态是成功，发现的地址数是 50。
5. 用“URL 检查”查这几个地址：首页、`/rankings/2026/`、`/reviews/lingdongyun/`、`/tutorials/clash-verge-rev-jiaocheng/`。确认 Bing 能抓取、没有被 robots.txt 或 `noindex` 挡住、canonical 是页面自己。这一步同时验证了 Cloudflare 没有拦截真正的 Bingbot。

### 4.3 第一次 IndexNow 提交

确认网站能访问、`https://jichang-zhinan.blog/<key>.txt` 能打开之后，在项目目录里依次运行。先在当前终端设置 key：

```powershell
$env:INDEXNOW_KEY = "你的 key"
```

构建，让本机的 Sitemap 与线上一致：

```bash
npm run build
```

先看一眼将要提交什么：

```bash
npm run indexnow:dry
```

确认无误后真实提交：

```bash
npm run indexnow
```

第一次会提交全部 50 个地址。成功后仓库里会多出 `.indexnow/state.json` 和 `.indexnow/log.jsonl`，请把它们提交进仓库，作为提交记录。之后每次发布新内容，重复“构建、干运行、提交”三步，脚本只会提交有变化的地址。

---

## 5. 可选：Cloudflare Crawler Hints

Cloudflare 有一个叫 Crawler Hints 的功能。按 Cloudflare 的文档，它根据缓存状态判断页面内容可能变了，然后通过 IndexNow 通知搜索引擎。只需要在后台打开开关，文档没有要求自己生成或托管 key，也不需要运行脚本。所有套餐都能用，包括免费版。

- 好处：全自动。
- 代价：提交哪些地址、什么时候提交由 Cloudflare 决定，仓库里不会有提交记录。
- 建议：二选一。要可追溯的记录就用脚本；想省事就开 Crawler Hints。两个都开不会出错，但没有必要。

文档写的开关位置是缓存（Caching）下的“配置”（Configuration）页。后台菜单可能调整，以实际显示为准。

---

## 6. 上线后一到四周的观察

| 时间 | 看什么 | 在哪里看 |
| --- | --- | --- |
| 当天 | 50 个地址都返回 200，`www` 和 `http` 都跳到正式地址 | `npm run seo:live` |
| 当天 | Sitemap 状态成功；IndexNow 收到了地址 | Bing 站长工具的“站点地图”和“IndexNow” |
| 3–7 天 | 首页和主要页面开始被抓取、收录 | “URL 检查”“网站资源管理器” |
| 2–4 周 | 出现曝光和点击数据 | “搜索表现” |

有了“搜索表现”的真实数据后，请把导出的关键词表发给我。[KEYWORD-MAPPING.csv](KEYWORD-MAPPING.csv) 里现在的判断都没有用到搜索量，届时应以真实的曝光和点击为准重新排优先级。

如果两周后主要页面仍未收录，先查三件事：“URL 检查”有没有报抓取错误；Cloudflare 的安全事件里有没有拦截 Bingbot 的记录；Bing 站长工具有没有给这个站点发过警告或通知。
