#!/usr/bin/env node
/**
 * 生成站点资产（构建前自动执行）：
 * 1) favicon.svg / favicon-32.png / apple-touch-icon.png / images/logo-512.png
 * 2) images/og-default.png（1200×630 分享图）
 * 3) 证据图片：source-materials 原图 → src/assets/evidence/*.webp（≤1600px），并刷新 evidence-map.json
 *
 * 已存在且不旧于源文件的输出会被跳过；传入 --force 强制重建。
 * PNG/OG 图在本地生成后随仓库提交，避免云端构建机缺少中文字体。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const abs = (p) => path.join(root, p);
const isFresh = (dest, src) => {
  if (force) return false;
  if (!fs.existsSync(dest)) return false;
  if (!src) return true;
  return fs.statSync(dest).mtimeMs >= fs.statSync(src).mtimeMs;
};

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (e) {
  console.warn('[assets] 未找到 sharp，跳过位图生成：', e.message);
}

/* ---------------- 1. favicon ---------------- */
const planeSvg = (size, radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#155eef"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="${radius}" fill="url(#g)"/>
  <path d="M54 12 10 30l19 6.5L36 54z" fill="rgba(255,255,255,0.22)" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
  <path d="M29 36.5 54 12" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
</svg>`;

ensureDir(abs('public/images'));
const faviconSvgPath = abs('public/favicon.svg');
if (!isFresh(faviconSvgPath)) {
  fs.writeFileSync(faviconSvgPath, planeSvg(64, 14), 'utf8');
  console.log('[assets] 写入 public/favicon.svg');
}

if (sharp) {
  const targets = [
    ['public/favicon-32.png', 32, 7],
    ['public/apple-touch-icon.png', 180, 36],
    ['public/images/logo-512.png', 512, 110],
  ];
  for (const [rel, size, radius] of targets) {
    const dest = abs(rel);
    if (isFresh(dest)) continue;
    await sharp(Buffer.from(planeSvg(size, radius))).png().toFile(dest);
    console.log(`[assets] 写入 ${rel}`);
  }

  /* ---------------- 2. OG 图 ---------------- */
  const ogDest = abs('public/images/og-default.png');
  if (!isFresh(ogDest)) {
    const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0c2a68"/>
      <stop offset="1" stop-color="#0a1e4d"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.2" r="0.6">
      <stop offset="0" stop-color="#3b82f6" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#3b82f6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="btn" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#155eef"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <g opacity="0.35" fill="none" stroke="#93c5fd" stroke-width="2">
    <circle cx="960" cy="330" r="190"/>
    <ellipse cx="960" cy="330" rx="190" ry="70"/>
    <ellipse cx="960" cy="330" rx="70" ry="190"/>
    <ellipse cx="960" cy="330" rx="250" ry="90" transform="rotate(-20 960 330)" stroke-dasharray="6 10"/>
  </g>
  <rect x="72" y="72" width="72" height="72" rx="18" fill="url(#btn)"/>
  <path d="M130 90 84 109l20 7 7 19z" fill="rgba(255,255,255,0.25)" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
  <path d="M104 116l26-26" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <text x="164" y="120" font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Noto Sans SC, sans-serif" font-size="40" font-weight="700" fill="#ffffff">机场指南</text>
  <text x="164" y="150" font-family="Segoe UI, Roboto, sans-serif" font-size="22" fill="#b7c7ea">jichang-zhinan.blog</text>
  <text x="72" y="300" font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Noto Sans SC, sans-serif" font-size="78" font-weight="800" fill="#ffffff">2027 机场指南大全</text>
  <text x="72" y="370" font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Noto Sans SC, sans-serif" font-size="34" font-weight="600" fill="#e4edff">机场推荐 · 真实测评 · 使用教程 · 排行榜 · 一站式指南</text>
  <text x="72" y="430" font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Noto Sans SC, sans-serif" font-size="24" fill="#b7c7ea">所有价格、节点与测速数据注明来源与核实时间 · 不虚构评分</text>
  <rect x="72" y="500" width="330" height="60" rx="14" fill="url(#btn)"/>
  <text x="237" y="539" text-anchor="middle" font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Noto Sans SC, sans-serif" font-size="24" font-weight="700" fill="#ffffff">查看 2027 机场推荐榜单</text>
</svg>`;
    await sharp(Buffer.from(ogSvg)).png().toFile(ogDest);
    console.log('[assets] 写入 public/images/og-default.png');
  }

  /* ---------------- 3. 证据图片 ---------------- */
  const evidenceMap = {
    'source-materials/evidence/reports/隐形人_香港节点_实测报告.png': 'invisible-hongkong03-report-2026-11-10.webp',
    'source-materials/evidence/reports/FlyV_新加坡节点_实测报告.png': 'flyv-singapore-report-2026-11-10.webp',
    'source-materials/evidence/reports/浪网_香港节点_实测报告.png': 'langwang-hongkong-report-2026-11-10.webp',
    'source-materials/evidence/reports/灵动云_实测报告_浅色版.png': 'lingdongyun-japan5-report-2026-11-10-light.webp',
    'source-materials/evidence/reports/灵动云_实测报告_深色版.png': 'lingdongyun-japan5-report-2026-11-10-dark.webp',
    'source-materials/evidence/浪网测速图.jpg': 'langwang-miaoko-speed-2026-07-19.webp',
    'source-materials/evidence/微风测速图.webp': 'breezenet-miaoko-speed-undated.webp',
    'source-materials/evidence/微风节点图.webp': 'breezenet-miaoko-streaming-undated.webp',
    'source-materials/evidence/飞猫测速图.webp': 'flycat-speedcentre-topology-undated.webp',
    'source-materials/evidence/飞猫测速图 (2).webp': 'flycat-miaoko-speed-cc1744-undated.webp',
    'source-materials/evidence/飞猫测速图 (3).webp': 'flycat-speedcentre-speed-undated.webp',
    'source-materials/evidence/飞猫测速图 (4).webp': 'flycat-unlock-matrix-undated.webp',
    'source-materials/evidence/飞猫测速图 (5).webp': 'flycat-pricing-table.webp',
  };
  ensureDir(abs('src/assets/evidence'));
  const present = {};
  for (const [src, name] of Object.entries(evidenceMap)) {
    const srcAbs = abs(src);
    if (!fs.existsSync(srcAbs)) {
      console.warn(`[assets] 原图缺失，跳过：${src}`);
      continue;
    }
    present[src] = name;
    const dest = abs(`src/assets/evidence/${name}`);
    if (isFresh(dest, srcAbs)) continue;
    await sharp(srcAbs).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest);
    console.log(`[assets] 证据图 → src/assets/evidence/${name}`);
  }
  const mapPath = abs('src/data/evidence-map.json');
  const next = JSON.stringify(present, null, 2) + '\n';
  if (!fs.existsSync(mapPath) || fs.readFileSync(mapPath, 'utf8') !== next) {
    fs.writeFileSync(mapPath, next, 'utf8');
    console.log('[assets] 更新 src/data/evidence-map.json');
  }
}

console.log('[assets] 完成');
