// @ts-check
import { defineConfig } from 'astro/config';

/**
 * 机场指南 jichang-zhinan.blog
 * - 纯静态预渲染，部署到 Cloudflare Pages（构建命令 npm run build，输出目录 dist）
 * - URL 策略：统一 https + 目录式 URL + 尾部斜杠（/rankings/2027/）
 * - Sitemap 由 src/pages/sitemap.xml.ts 自行生成（只包含可索引页面，lastmod 取自真实内容日期）
 */
export default defineConfig({
  site: 'https://jichang-zhinan.blog',
  trailingSlash: 'always',
  output: 'static',
  // 保留行内元素之间的空白，避免中英文混排时被 'jsx' 压缩模式吞掉空格
  compressHTML: true,
  build: {
    format: 'directory',
    assets: '_astro',
    inlineStylesheets: 'auto',
  },
  image: {
    // 默认 sharp 服务；证据截图统一输出 webp，宽度由组件按需指定
    responsiveStyles: true,
  },
  devToolbar: { enabled: false },
  server: { host: true },
});
