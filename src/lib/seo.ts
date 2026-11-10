import { SITE, absoluteUrl } from './site';

type JsonLd = Record<string, unknown>;

export function organizationLd(): JsonLd {
  return {
    '@type': 'Organization',
    '@id': `${SITE.url}/#organization`,
    name: SITE.name,
    url: `${SITE.url}/`,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/images/logo-512.png'),
      width: 512,
      height: 512,
    },
    description: SITE.description,
  };
}

export function websiteLd(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    url: `${SITE.url}/`,
    name: SITE.name,
    alternateName: SITE.domain,
    description: SITE.description,
    inLanguage: SITE.locale,
    publisher: { '@id': `${SITE.url}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE.url}/search/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface Crumb {
  name: string;
  href: string;
}

export function breadcrumbLd(crumbs: Crumb[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.href),
    })),
  };
}

export interface ArticleLdInput {
  type?: 'Article' | 'TechArticle' | 'BlogPosting' | 'NewsArticle';
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  image?: string;
  keywords?: string[];
  section?: string;
  wordCount?: number;
}

export function articleLd(input: ArticleLdInput): JsonLd {
  return {
    '@type': input.type ?? 'Article',
    '@id': `${absoluteUrl(input.url)}#article`,
    headline: input.headline,
    description: input.description,
    url: absoluteUrl(input.url),
    mainEntityOfPage: absoluteUrl(input.url),
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    inLanguage: SITE.locale,
    author: {
      '@type': 'Person',
      '@id': absoluteUrl(`${SITE.author.url}#person`),
      name: SITE.author.name,
      alternateName: SITE.author.alias,
      url: absoluteUrl(SITE.author.url),
    },
    publisher: { '@id': `${SITE.url}/#organization` },
    image: absoluteUrl(input.image ?? SITE.defaultOgImage),
    ...(input.keywords?.length ? { keywords: input.keywords.join(', ') } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
    ...(input.wordCount ? { wordCount: input.wordCount } : {}),
  };
}

export interface ItemListEntry {
  name: string;
  url: string;
  description?: string;
}

export function itemListLd(name: string, items: ItemListEntry[], description?: string): JsonLd {
  return {
    '@type': 'ItemList',
    name,
    ...(description ? { description } : {}),
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: absoluteUrl(it.url),
      ...(it.description ? { description: it.description } : {}),
    })),
  };
}

export function faqLd(items: { q: string; a: string }[]): JsonLd {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

export function collectionPageLd(name: string, url: string, description: string): JsonLd {
  return {
    '@type': 'CollectionPage',
    name,
    url: absoluteUrl(url),
    description,
    inLanguage: SITE.locale,
    isPartOf: { '@id': `${SITE.url}/#website` },
  };
}

export function webPageLd(name: string, url: string, description: string, dateModified?: string): JsonLd {
  return {
    '@type': 'WebPage',
    name,
    url: absoluteUrl(url),
    description,
    inLanguage: SITE.locale,
    isPartOf: { '@id': `${SITE.url}/#website` },
    ...(dateModified ? { dateModified } : {}),
  };
}

/** 把多个节点合成一个 @graph */
export function graph(...nodes: JsonLd[]): string {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': nodes,
    },
    null,
    0,
  ).replace(/</g, '\\u003c');
}

/** 标题长度控制（Bing 建议 ≤ 65 字符左右） */
export function buildTitle(pageTitle: string | undefined, withSuffix = true): string {
  if (!pageTitle) return `${SITE.name}｜${SITE.tagline}`;
  return withSuffix ? `${pageTitle}｜${SITE.name}` : pageTitle;
}
