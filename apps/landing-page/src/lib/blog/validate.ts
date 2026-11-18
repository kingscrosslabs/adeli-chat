import { SITE_PAGES } from "@/lib/site-pages";

import type { ParsedPost } from "./posts";
import { BLOG_BASE_PATH, countWords, postPath, stripCode } from "./text";

/**
 * The SEO/AEO quality gate, ported from Adeli's blog. `next build` runs it
 * over every post it's about to publish (through `getAllPosts()`).
 *
 * ERRORS block the build: bad dates, dead internal links, a second H1,
 * duplicate titles, a `<title>` too long to show whole in search results,
 * and any link to a competitor's site.
 *
 * WARNINGS never block. They're editorial nudges toward what gets a page
 * ranked and cited: a TL;DR too long to quote, no question-shaped heading.
 */

export type Issue = {
  slug: string;
  level: "error" | "warning";
  message: string;
};

/** Appended to every post's `<title>` by `src/app/blog/[slug]/page.tsx`. */
export const TITLE_SUFFIX = " | LedaChat";
/** Google shows about 60 characters of a title. */
export const TITLE_MAX = 60;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Same range scripts/check-seo.mjs enforces on the built page. */
const DESCRIPTION_MIN = 110;
const DESCRIPTION_MAX = 160;
const TLDR_MIN_WORDS = 30;
const TLDR_MAX_WORDS = 75;
const THIN_CONTENT_WORDS = 500;

/**
 * Competitors, by domain. Posts never link to these (an error). Naming them
 * is fine: LedaChat is positioned against ManyChat by name, on the homepage too.
 */
export const COMPETITOR_DOMAINS: readonly string[] = [
  "manychat.com",
  "creatorflow.so",
  "linkdm.com",
  "inro.social",
  "zernio.com",
  "vinkius.com",
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `/#mcp?x=1` -> `/#mcp`; `/blog/` -> `/blog`. Keeps the hash: homepage sections are pages here. */
function normalizePath(href: string): string {
  const [beforeQuery] = href.split("?");
  const [path, hash] = (beforeQuery ?? href).split("#");
  const clean = path.length > 1 ? path.replace(/\/$/, "") : path;
  return hash !== undefined && clean === "/" ? `/#${hash}` : clean;
}

function headings(body: string, depth: number): string[] {
  const marker = "#".repeat(depth);
  const pattern = new RegExp(`^${marker} (.+)$`, "gm");
  return [...stripCode(body).matchAll(pattern)].map((match) => match[1].trim());
}

function internalLinks(body: string): string[] {
  return [...stripCode(body).matchAll(/(?<!!)\[[^\]]*\]\((\/[^)\s]*)/g)].map((match) => match[1]);
}

function externalHosts(body: string): string[] {
  return [...body.matchAll(/\]\((https?:\/\/[^)\s]+)/g)].flatMap((match) => {
    try {
      return [new URL(match[1]).hostname.replace(/^www\./, "")];
    } catch {
      return [];
    }
  });
}

export function validatePosts(posts: readonly ParsedPost[]): Issue[] {
  const issues: Issue[] = [];
  const knownPaths = new Set<string>([
    ...SITE_PAGES.map((page) => page.path),
    BLOG_BASE_PATH,
    ...posts.map((post) => postPath(post.slug)),
  ]);
  const titles = new Map<string, string>();

  for (const post of posts) {
    const error = (message: string) => issues.push({ slug: post.slug, level: "error", message });
    const warn = (message: string) => issues.push({ slug: post.slug, level: "warning", message });

    if (!SLUG_PATTERN.test(post.slug)) error(`filename must be lowercase-kebab-case (got "${post.slug}.md")`);
    if (stripCode(post.body).includes("<!--")) error("leftover <!-- --> comments in the body");

    for (const message of post.schemaErrors) error(message);
    const fm = post.frontmatter;
    if (!fm) continue;

    const titleKey = fm.title.toLowerCase();
    const clash = titles.get(titleKey);
    if (clash) error(`duplicate title, same as "${clash}"`);
    titles.set(titleKey, post.slug);

    const renderedTitleLength = fm.title.length + TITLE_SUFFIX.length;
    if (renderedTitleLength > TITLE_MAX) {
      error(`title is ${String(renderedTitleLength)} chars with "${TITLE_SUFFIX}"; keep the title to ${String(TITLE_MAX - TITLE_SUFFIX.length)}`);
    }
    // A hard error, not a warning: scripts/check-seo.mjs fails the build on it anyway.
    if (fm.description.length < DESCRIPTION_MIN || fm.description.length > DESCRIPTION_MAX) {
      error(`description is ${String(fm.description.length)} chars; needs ${String(DESCRIPTION_MIN)} to ${String(DESCRIPTION_MAX)}`);
    }
    if (/—/.test(JSON.stringify(post.data) + post.body)) {
      error("contains an em dash; the copy rule is no em dashes (docs/brand.md)");
    }

    if (fm.updatedAt && fm.updatedAt < fm.publishedAt) error(`updatedAt (${fm.updatedAt}) is before publishedAt (${fm.publishedAt})`);
    if (!fm.draft && fm.publishedAt > today()) warn(`publishedAt ${fm.publishedAt} is in the future but the post isn't a draft`);

    const tldrWords = countWords(fm.tldr);
    if (tldrWords < TLDR_MIN_WORDS || tldrWords > TLDR_MAX_WORDS) {
      warn(`tldr is ${String(tldrWords)} words; ${String(TLDR_MIN_WORDS)} to ${String(TLDR_MAX_WORDS)} is the range AI answers quote whole`);
    }
    if (fm.type !== "changelog" && fm.faqs.length < 2) warn("fewer than 2 FAQs; each one is another question this page can be cited for");

    if (headings(post.body, 1).length > 0) error("body contains an H1 (`# `); the title is the H1, so start sections at `## `");
    const h2s = headings(post.body, 2);
    if (fm.type !== "changelog" && h2s.length < 2) warn(`only ${String(h2s.length)} H2 section(s)`);
    if (fm.type !== "changelog" && !h2s.some((heading) => heading.endsWith("?"))) {
      warn("no H2 is phrased as a question; question headings match how people search and prompt");
    }
    const words = countWords(post.body);
    if (fm.type !== "changelog" && words < THIN_CONTENT_WORDS) warn(`body is ${String(words)} words; under ${String(THIN_CONTENT_WORDS)} reads as thin`);
    if (/!\[\s*\]\(/.test(post.body)) warn("an image has empty alt text");

    for (const page of fm.relatedPages) {
      if (!knownPaths.has(normalizePath(page))) error(`relatedPages: "${page}" is not a page on the site (see src/lib/site-pages.ts)`);
    }
    for (const href of internalLinks(post.body)) {
      if (!knownPaths.has(normalizePath(href))) error(`broken internal link: ${href}`);
    }
    for (const host of externalHosts(post.body)) {
      if (COMPETITOR_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
        error(`links to a competitor (${host}); posts never link to competitors`);
      }
    }
  }

  return issues;
}

export function formatIssues(issues: readonly Issue[]): string {
  return issues.map((issue) => `  ${issue.level === "error" ? "✖" : "⚠"} ${issue.slug}: ${issue.message}`).join("\n");
}
