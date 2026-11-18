import { organizationId, softwareId, websiteId, type JsonLdNode } from "@/lib/schema";
import { siteUrl } from "@/lib/site-url";

import { authorId } from "./authors";
import { POST_TYPE_LABELS } from "./frontmatter";
import type { BlogPost } from "./posts";

/**
 * JSON-LD for the blog, composed with the site-wide nodes in `src/lib/schema.ts`
 * so every post references the same Organization, WebSite and
 * SoftwareApplication by `@id` instead of redefining them.
 */

export const blogId = () => `${siteUrl()}/blog#blog`;

export function postUrl(post: BlogPost): string {
  return `${siteUrl()}${post.path}`;
}

/**
 * The post's social card at a stable URL (`src/app/blog/[slug]/og-image.png/route.ts`).
 * Not `/opengraph-image`: Next serves that at a hashed suffix, so the bare path 404s.
 */
export function blogPostImageUrl(post: BlogPost): string {
  return `${postUrl(post)}/og-image.png`;
}

/** `TechArticle` for how-tos, `BlogPosting` for the rest. Google reads both as Article. */
export function blogPosting(post: BlogPost): JsonLdNode {
  const fm = post.frontmatter;
  const url = postUrl(post);
  return {
    "@type": fm.type === "how-to" ? "TechArticle" : "BlogPosting",
    "@id": `${url}#article`,
    headline: fm.title,
    description: fm.description,
    abstract: fm.tldr.trim(),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: blogPostImageUrl(post),
    datePublished: fm.publishedAt,
    dateModified: post.lastModified,
    author: { "@id": authorId(fm.author) },
    publisher: { "@id": organizationId() },
    isPartOf: { "@id": blogId() },
    about: { "@id": softwareId() },
    articleSection: POST_TYPE_LABELS[fm.type],
    keywords: [fm.targetQuery, ...fm.tags].join(", "),
    wordCount: post.wordCount,
    inLanguage: "en-US",
  };
}

export function blogNode(posts: readonly BlogPost[]): JsonLdNode {
  return {
    "@type": "Blog",
    "@id": blogId(),
    name: "The LedaChat blog",
    url: `${siteUrl()}/blog`,
    publisher: { "@id": organizationId() },
    isPartOf: { "@id": websiteId() },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      "@id": `${postUrl(post)}#article`,
      headline: post.frontmatter.title,
      url: postUrl(post),
      datePublished: post.frontmatter.publishedAt,
    })),
  };
}
