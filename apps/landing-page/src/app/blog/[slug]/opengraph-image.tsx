import { ImageResponse } from "next/og";

import { authors } from "@/lib/blog/authors";
import { getAllPosts, getPost } from "@/lib/blog/posts";

/**
 * Per-post share card, 1200x630, built at build time from the post's
 * frontmatter. Same frame as the site card (src/app/opengraph-image.tsx),
 * with the post title as the headline and the author underneath.
 * ImageResponse can't read CSS variables, so the brand hex values are written out (docs/brand.md section 3).
 */
const LEDA_PURPLE = "#702EC7";
const LEDA_PINK = "#F90EF5";
const LEDA_INK = "#1C1426";
const PURPLE_50 = "#F6F2FC";

export const alt = "An article on the LedaChat blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

/** Shrink the headline as titles get longer, so 49 characters still fit in three lines. */
function headlineSize(title: string): number {
  if (title.length <= 30) return 76;
  if (title.length <= 42) return 68;
  return 60;
}

export default async function PostOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  const title = post?.frontmatter.title ?? "The LedaChat blog";
  const byline = post ? authors[post.frontmatter.author].name : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", background: PURPLE_50, color: LEDA_INK }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: LEDA_PURPLE, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 700 }}>L</div>
          <div style={{ fontSize: 48, fontWeight: 700, color: LEDA_PURPLE }}>LedaChat</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: headlineSize(title), fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1040 }}>{title}</div>
          <div style={{ width: 160, height: 10, borderRadius: 5, background: LEDA_PINK }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, color: "#625A70" }}>
          <span>{byline}</span>
          <span style={{ color: LEDA_PURPLE }}>ledachat.com/blog</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
