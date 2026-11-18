import PostOpengraphImage from "@/app/blog/[slug]/opengraph-image";
import { getAllPosts } from "@/lib/blog/posts";

/**
 * A post's share card at a stable URL, `/blog/<slug>/og-image.png`, for the
 * `image` in its JSON-LD. The file-based `opengraph-image` next to this is
 * served at a build-specific suffix, so it can't be named from structured data.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return PostOpengraphImage({ params });
}
