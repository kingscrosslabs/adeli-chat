import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import matter from "gray-matter";

import { frontmatterSchema, type Frontmatter } from "./frontmatter";
import { BLOG_BASE_PATH, countWords, postPath } from "./text";
import { formatIssues, validatePosts, type Issue } from "./validate";

export { BLOG_BASE_PATH, postPath };

/**
 * The blog's single source of truth: one markdown file per post in
 * `apps/landing-page/content/blog/`. The filename is the slug, so
 * `content/blog/manychat-mcp.md` publishes at `/blog/manychat-mcp`.
 *
 * Everything downstream reads from `getAllPosts()`: the rendered pages, the
 * JSON-LD, the sitemap, `/llms.txt`, the `.md` mirrors and the RSS feed.
 * Adding a post means adding a file. Nothing gets registered by hand.
 *
 * Files starting with `_` (templates) and `README.md` are ignored.
 */

export const BLOG_DIR = join(process.cwd(), "content", "blog");

export type ParsedPost = {
  slug: string;
  file: string;
  /** Raw frontmatter, before validation. */
  data: Record<string, unknown>;
  /** Markdown body, frontmatter stripped. */
  body: string;
  /** Present only when the frontmatter parsed against the schema. */
  frontmatter?: Frontmatter;
  /** Schema errors, one per field, already formatted. */
  schemaErrors: string[];
};

export type BlogPost = {
  slug: string;
  /** Root-relative path, e.g. `/blog/manychat-mcp`. */
  path: string;
  file: string;
  frontmatter: Frontmatter;
  body: string;
  wordCount: number;
  readingMinutes: number;
  /** `updatedAt ?? publishedAt`. Feeds the sitemap, dateModified and the visible "Updated" line. */
  lastModified: string;
};

export function isPostFile(name: string): boolean {
  return name.endsWith(".md") && !name.startsWith("_") && name !== "README.md";
}

/** Reads and schema-checks every post file. Does not filter drafts. */
export function parsePostFiles(dir: string = BLOG_DIR): ParsedPost[] {
  let names: string[];
  try {
    names = readdirSync(dir).filter(isPostFile).sort();
  } catch {
    return [];
  }

  return names.map((name) => {
    const file = join(dir, name);
    const { data, content } = matter(readFileSync(file, "utf8"));
    const result = frontmatterSchema.safeParse(data);

    return {
      slug: name.replace(/\.md$/, ""),
      file,
      data,
      body: content.trim(),
      frontmatter: result.success ? result.data : undefined,
      schemaErrors: result.success
        ? []
        : result.error.issues.map(
            (issue) => `frontmatter.${issue.path.join(".") || "(root)"}: ${issue.message}`,
          ),
    };
  });
}

export function toBlogPost(parsed: ParsedPost & { frontmatter: Frontmatter }): BlogPost {
  const wordCount = countWords(parsed.body);
  return {
    slug: parsed.slug,
    path: postPath(parsed.slug),
    file: parsed.file,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    wordCount,
    readingMinutes: Math.max(1, Math.round(wordCount / 230)),
    lastModified: parsed.frontmatter.updatedAt ?? parsed.frontmatter.publishedAt,
  };
}

/**
 * Drafts render in `next dev` so you can preview them, and never ship to
 * production. `BLOG_INCLUDE_DRAFTS=true` forces them on for a preview deploy.
 */
function includeDrafts(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.BLOG_INCLUDE_DRAFTS === "true"
  );
}

let cache: BlogPost[] | undefined;
const reported = new Set<string>();

/**
 * Every publishable post, newest first.
 *
 * Throws, and so fails `next build`, if any publishable post breaks a hard
 * rule in `validate.ts`: a malformed date, a link to a page that doesn't
 * exist, a duplicate title. Warnings are logged once and never block.
 */
export function getAllPosts(): BlogPost[] {
  if (cache && process.env.NODE_ENV === "production") return cache;

  const drafts = includeDrafts();
  const parsed = parsePostFiles().filter(
    (post) => drafts || post.frontmatter?.draft !== true,
  );

  const issues: Issue[] = validatePosts(parsed);
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  if (errors.length > 0) {
    throw new Error(`[blog] ${String(errors.length)} post error(s):\n${formatIssues(errors)}`);
  }
  for (const warning of warnings) {
    const key = `${warning.slug}:${warning.message}`;
    if (reported.has(key)) continue;
    reported.add(key);
    console.warn(`[blog] warning ${warning.slug}: ${warning.message}`);
  }

  cache = parsed
    .filter((post): post is ParsedPost & { frontmatter: Frontmatter } => Boolean(post.frontmatter))
    .map(toBlogPost)
    .sort((a, b) =>
      b.frontmatter.publishedAt.localeCompare(a.frontmatter.publishedAt) ||
      a.slug.localeCompare(b.slug),
    );
  return cache;
}

export function getPost(slug: string): BlogPost | undefined {
  return getAllPosts().find((post) => post.slug === slug);
}

/** Up to `limit` other posts, same type first, then newest. */
export function relatedPosts(post: BlogPost, limit = 3): BlogPost[] {
  const others = getAllPosts().filter((other) => other.slug !== post.slug);
  const sameType = others.filter((other) => other.frontmatter.type === post.frontmatter.type);
  const rest = others.filter((other) => other.frontmatter.type !== post.frontmatter.type);
  return [...sameType, ...rest].slice(0, limit);
}
