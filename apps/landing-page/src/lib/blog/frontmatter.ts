import { z } from "zod";

import { AUTHOR_IDS } from "./authors";

/**
 * The frontmatter contract for every post in `content/blog/*.md`.
 *
 * Each field exists because one of three consumers reads it:
 *   - the rendered page (`src/app/blog/[slug]/page.tsx`)
 *   - the JSON-LD graph (BlogPosting, Person, FAQPage, BreadcrumbList)
 *   - the AI surfaces (`/blog/<slug>.md`, `/llms.txt`, the RSS feed)
 *
 * A post that doesn't parse fails the build. Softer editorial rules (title
 * length, question-shaped headings) live in `validate.ts` as warnings.
 */

export const POST_TYPES = ["how-to", "listicle", "explainer", "changelog"] as const;
export type PostType = (typeof POST_TYPES)[number];

/** Human label for each type: the post's breadcrumb and its schema section. */
export const POST_TYPE_LABELS: Record<PostType, string> = {
  "how-to": "How-to",
  listicle: "Roundup",
  explainer: "Explainer",
  changelog: "Changelog",
};

/** YAML turns an unquoted date into a Date. Accept both and normalise to `YYYY-MM-DD`. */
const isoDate = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a YYYY-MM-DD date"),
);

const faq = z.object({
  question: z.string().min(5).refine((q) => q.trim().endsWith("?"), "must end with a question mark"),
  answer: z.string().min(20),
});

export const frontmatterSchema = z
  .object({
    /** The H1. The `<title>` appends " | LedaChat", so keep it to 49 characters (validate.ts enforces it). */
    title: z.string().min(10),
    /** Meta description, OG description, and the llms.txt summary line. 110 to 160 characters. */
    description: z.string().min(50),
    type: z.enum(POST_TYPES),
    author: z.enum(AUTHOR_IDS),
    publishedAt: isoDate,
    /** Set whenever the content changes meaningfully. Drives dateModified and the sitemap. */
    updatedAt: isoDate.optional(),
    /** The one search or prompt this post exists to answer. Leads the JSON-LD keywords. */
    targetQuery: z.string().min(5),
    /** 30 to 75 words that answer `targetQuery` outright, shown above the fold. The line AI engines quote. */
    tldr: z.string().min(80),
    /** Shown as the FAQ section and emitted as FAQPage JSON-LD. */
    faqs: z.array(faq).default([]),
    /** Site pages this post supports (`src/lib/site-pages.ts`). At least one. */
    relatedPages: z.array(z.string().startsWith("/")).min(1),
    tags: z.array(z.string()).default([]),
    /** Optional copy for the in-post CTA cards. Falls back to DEFAULT_POST_CTA. */
    cta: z
      .object({
        title: z.string().min(5).max(60),
        body: z.string().min(20).max(200),
      })
      .strict()
      .optional(),
    /** Hidden in production builds. Still visible in `next dev`. */
    draft: z.boolean().default(false),
  })
  .strict();

export type Frontmatter = z.infer<typeof frontmatterSchema>;

export const DEFAULT_POST_CTA = {
  title: "Comment to DM, run from your AI",
  body: "LedaChat turns Instagram comments into DMs, and its built-in MCP lets Claude, ChatGPT or Cursor set up your automations for you. Free and open source.",
} as const;
