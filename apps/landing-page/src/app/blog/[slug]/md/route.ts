import { postMarkdown } from "@/lib/blog/markdown";
import { getAllPosts, getPost } from "@/lib/blog/posts";
import { postUrl } from "@/lib/blog/schema";

/**
 * The Markdown mirror of one post, served at `/blog/<slug>.md` (next.config.ts
 * rewrites it here, since `/blog/<slug>.md` would otherwise match `[slug]`).
 * The `Link: rel=canonical` header points search engines at the HTML page, so
 * the two never compete as duplicates.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(postMarkdown(post), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex",
      Link: `<${postUrl(post)}>; rel="canonical"`,
    },
  });
}
