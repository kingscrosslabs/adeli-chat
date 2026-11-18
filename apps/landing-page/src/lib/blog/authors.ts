import { organizationId, type JsonLdNode } from "@/lib/schema";
import { siteUrl } from "@/lib/site-url";

/**
 * The people who can sign a post. A post's `author` must be a key of
 * `authors`, which the frontmatter schema enforces.
 *
 * A named author is the strongest trust signal a post carries, both for
 * Google's E-E-A-T reading and for AI engines choosing which source to cite.
 * The bio and `sameAs` are identity claims: list a profile only once it
 * exists and is public, and only the profile, never a post permalink.
 */

export type Author = {
  name: string;
  /** Short role line shown under the byline. */
  role: string;
  /** Two or three sentences. Rendered on every post and in the Person JSON-LD. */
  bio: string;
  /** Canonical public profile URLs. The E-E-A-T identity claim. */
  sameAs: readonly string[];
};

export const authors = {
  mika: {
    name: "Mika Reyes",
    role: "Co-founder, LedaChat",
    bio: "Mika Reyes is a co-founder of LedaChat and the CEO of Adeli, the social media API it runs on. She is a tech and AI content creator with 50k+ followers, was previously co-founder and CEO of a fintech startup sold to a $3B company and a product lead at LinkedIn, and is a Forbes 30 Under 30 honoree.",
    sameAs: [
      "https://www.mikareyes.com",
      "https://www.linkedin.com/in/itsmikareyes",
      "https://www.instagram.com/its.mikareyes/",
    ],
  },
  nick: {
    name: "Nick Reyes",
    role: "Co-founder and CTO, LedaChat",
    bio: "Nick Reyes is a co-founder of LedaChat and the CTO of Adeli, and built LedaChat's MCP server. Before that he spent 10 years on security, cryptography and authentication systems at Google, Airbnb and Phantom.",
    sameAs: [
      "https://www.nickreyes.dev",
      "https://www.linkedin.com/in/nicolasreyes26",
      "https://github.com/nickcruz",
    ],
  },
} as const satisfies Record<string, Author>;

export type AuthorId = keyof typeof authors;

export const AUTHOR_IDS = Object.keys(authors) as [AuthorId, ...AuthorId[]];

/** Stable `@id`, so every post's BlogPosting references one Person node. */
export function authorId(id: AuthorId): string {
  return `${siteUrl()}/blog#author-${id}`;
}

export function authorPerson(id: AuthorId): JsonLdNode {
  const author: Author = authors[id];
  return {
    "@type": "Person",
    "@id": authorId(id),
    name: author.name,
    jobTitle: author.role,
    description: author.bio,
    sameAs: author.sameAs,
    worksFor: { "@id": organizationId() },
  };
}
