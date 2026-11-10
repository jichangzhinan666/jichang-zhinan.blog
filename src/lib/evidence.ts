import type { ImageMetadata } from 'astro';
import evidenceMap from '../data/evidence-map.json';

/**
 * 证据图片解析：source-materials 中的原图由 scripts/generate-brand-assets.mjs
 * 转为 ≤1600px 的 webp 存入 src/assets/evidence/，这里按映射表查找。
 */
const assets = import.meta.glob<{ default: ImageMetadata }>('/src/assets/evidence/*.webp', {
  eager: true,
});

const map = evidenceMap as Record<string, string>;

export function resolveEvidenceImage(sourceFile: string): ImageMetadata | null {
  const name = map[sourceFile];
  if (!name) return null;
  const mod = assets[`/src/assets/evidence/${name}`];
  return mod?.default ?? null;
}

export function hasEvidenceImage(sourceFile: string): boolean {
  return resolveEvidenceImage(sourceFile) !== null;
}
