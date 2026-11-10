# 机场指南 jichang-zhinan.blog

2026 机场指南大全：机场推荐榜单、品牌资料库、节点测速报告、套餐对比、客户端教程、选购指南与百科。Astro 7 静态站点，部署于 Cloudflare Pages。

- 开发与约束说明：[CLAUDE.md](./CLAUDE.md)
- 实施报告（完成项、数据核验、检查结果、部署步骤）：[IMPLEMENTATION_REPORT.md](./IMPLEMENTATION_REPORT.md)
- 总指令：`airport_guide_claude_2027/CLAUDE_CODE_MASTER_PROMPT.md`

## 快速开始

```bash
npm install
npm run dev
```

```bash
npm run build      # 校验数据 → 生成资产 → 构建 → SEO 审计
npm run preview
```

## 目录

```
src/
  components/   页头、页脚、Hero、榜单、套餐表、报告卡、FAQ 等
  layouts/      BaseLayout / ArticleLayout / StaticPageLayout
  pages/        首页、榜单、评测、测速、对比、栏目、搜索、政策页、sitemap/rss/search-index
  content/      articles/<category>/*.md（教程、指南、百科、资讯）
  data/         brands / plans / speed-tests / sources / glossary / changelog / evidence-map
  lib/          site / data / seo / articles / evidence / types
  assets/       evidence/*.webp（由脚本从 source-materials 生成）
  styles/       global.css（设计令牌）
public/         robots.txt、_headers、_redirects、favicon、OG 图
scripts/        validate-data、generate-brand-assets、seo-audit、indexnow、write-indexnow-key
source-materials/  品牌资料原文、截图、模板（只读）
```

## 数据原则

所有价格、节点、政策与测速数值均来自 `source-materials/` 中的资料并标注来源与核实日期；不显示评分；未完成的测试不标注为已实测。详见站内 `/methodology/` 与 `/editorial-policy/`。
