import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须为 YYYY-MM-DD 格式');

/**
 * 文章集合：教程 / 指南 / 百科 / 资讯
 * 文件位于 src/content/articles/<category>/<slug>.md，id = <category>/<slug>
 */
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string().min(6).max(80),
    description: z.string().min(40).max(220),
    category: z.enum(['tutorials', 'guides', 'wiki', 'news']),
    primaryKeyword: z.string().optional(),
    tags: z.array(z.string()).default([]),
    author: z.string().default('机场阿南'),
    publishedAt: dateString,
    updatedAt: dateString,
    coverImage: z.string().nullable().default(null),
    coverAlt: z.string().nullable().default(null),
    references: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().optional(),
        }),
      )
      .default([]),
    status: z.enum(['draft', 'review', 'published', 'archived']).default('draft'),
    featured: z.boolean().default(false),
    /** 栏目内排序（越小越靠前），新手快速上手列表使用 */
    order: z.number().int().default(100),
    relatedBrands: z.array(z.string()).default([]),
    faq: z
      .array(
        z.object({
          q: z.string(),
          a: z.string(),
        }),
      )
      .default([]),
  }),
});

export const collections = { articles };
