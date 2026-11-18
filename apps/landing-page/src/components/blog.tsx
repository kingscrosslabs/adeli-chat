import Link from "next/link";

import { cn } from "@adeli-chat/ui/lib/utils";

import { DEFAULT_POST_CTA, type Frontmatter } from "@/lib/blog/frontmatter";
import type { BlogPost } from "@/lib/blog/posts";
import { formatDate } from "@/lib/blog/text";

import { HOVER_BORDER, JoinWaitlist } from "./site-chrome";

/** One card per post: the blog index and "More from the blog" share it, so a post looks the same wherever it's listed. */
export function PostCards({ posts, showMeta = true }: { posts: readonly BlogPost[]; showMeta?: boolean }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {posts.map((post) => (
        <li key={post.slug}>
          <Link href={post.path} className={cn("flex h-full flex-col rounded-xl border bg-card p-5", HOVER_BORDER)}>
            {showMeta ? (
              <span className="text-xs text-muted-foreground">
                {formatDate(post.frontmatter.publishedAt)} · {post.readingMinutes} min read
              </span>
            ) : null}
            <span className="mt-1.5 text-lg font-semibold tracking-tight text-balance">{post.frontmatter.title}</span>
            <span className="mt-2 text-sm text-foreground">{post.frontmatter.description}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

type Cta = NonNullable<Frontmatter["cta"]>;

/**
 * The CTA inside a post: `inline` after the first section, where the reader
 * has just had their problem confirmed, and `sidebar` under the table of
 * contents on wide screens. Copy comes from the post's `cta` frontmatter.
 */
export function PostCta({ cta, variant }: { cta?: Cta; variant: "inline" | "sidebar" }) {
  const { title, body } = cta ?? DEFAULT_POST_CTA;
  return (
    <aside className={cn("rounded-xl border-2 border-highlight bg-card", variant === "inline" ? "my-10 p-6" : "p-4")}>
      <p className={cn("font-semibold tracking-tight", variant === "inline" ? "text-lg" : "text-sm")}>{title}</p>
      <p className={cn("mt-2 text-foreground", variant === "inline" ? "text-base" : "text-sm")}>{body}</p>
      <JoinWaitlist size={variant === "inline" ? "lg" : "default"} className="mt-4" />
    </aside>
  );
}

/**
 * Splits rendered post HTML just before its second H2, so the inline CTA
 * lands after the first section. Posts with fewer than three H2s aren't split.
 */
export function splitAtSecondH2(html: string): [string, string] | null {
  const first = html.indexOf("<h2");
  if (first === -1) return null;
  const second = html.indexOf("<h2", first + 3);
  if (second === -1 || !html.includes("<h2", second + 3)) return null;
  return [html.slice(0, second), html.slice(second)];
}
