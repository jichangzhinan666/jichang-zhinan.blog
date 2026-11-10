import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORY_META, type CategoryKey } from './site';

export type Article = CollectionEntry<'articles'>;

export function articleSlug(entry: Article): string {
  return entry.id.split('/').pop() ?? entry.id;
}

export function articleUrl(entry: Article): string {
  return `/${entry.data.category}/${articleSlug(entry)}/`;
}

export function categoryLabel(category: CategoryKey): string {
  return CATEGORY_META[category].label;
}

export async function getPublishedArticles(category?: CategoryKey): Promise<Article[]> {
  const all = await getCollection('articles', (e) => e.data.status === 'published');
  const filtered = category ? all.filter((e) => e.data.category === category) : all;
  return filtered.sort(
    (a, b) =>
      b.data.publishedAt.localeCompare(a.data.publishedAt) || a.data.order - b.data.order || a.data.title.localeCompare(b.data.title, 'zh-CN'),
  );
}

export async function getFeaturedArticles(): Promise<Article[]> {
  const all = await getPublishedArticles();
  return all.filter((e) => e.data.featured).sort((a, b) => a.data.order - b.data.order);
}

/** 新手快速上手：按 order 升序的前 N 篇（教程 + 指南 + 百科） */
export async function getQuickStart(limit = 5): Promise<Article[]> {
  const all = await getPublishedArticles();
  return all
    .filter((e) => e.data.category !== 'news')
    .sort((a, b) => a.data.order - b.data.order)
    .slice(0, limit);
}

/** 粗略字数（中文按字符计） */
export function wordCount(body: string | undefined): number {
  if (!body) return 0;
  return body.replace(/\s+/g, '').length;
}

/** 预计阅读时间（分钟，按每分钟 400 字） */
export function readingMinutes(body: string | undefined): number {
  return Math.max(1, Math.round(wordCount(body) / 400));
}
