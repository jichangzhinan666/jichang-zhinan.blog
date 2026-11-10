#!/usr/bin/env node
/**
 * 构建后：若环境变量 INDEXNOW_KEY 存在，则在 dist 根目录写入 <KEY>.txt（内容为 key 本身），
 * 使 https://jichang-zhinan.blog/<KEY>.txt 可访问，满足 IndexNow 的 key 校验。
 * 未设置时只提示，不影响构建；绝不把 key 写入仓库。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const key = (process.env.INDEXNOW_KEY ?? '').trim();

if (!fs.existsSync(dist)) {
  console.warn('[indexnow-key] dist 目录不存在，跳过');
  process.exit(0);
}
if (!key) {
  console.log('[indexnow-key] 未设置 INDEXNOW_KEY，跳过 key 文件（部署前请在 Cloudflare Pages 环境变量中配置）');
  process.exit(0);
}
if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  console.error('[indexnow-key] INDEXNOW_KEY 格式非法：需 8–128 位，仅含字母、数字与短横线');
  process.exit(1);
}
fs.writeFileSync(path.join(dist, `${key}.txt`), key, 'utf8');
console.log(`[indexnow-key] 已写入 dist/${key.slice(0, 4)}…${key.slice(-4)}.txt`);
