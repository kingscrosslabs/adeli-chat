import { authors } from "@/lib/blog/authors";
import { getAllPosts } from "@/lib/blog/posts";
import { siteUrl } from "@/lib/site-url";

/**
 * RSS 2.0 feed at `/blog/rss.xml`. Feed readers, newsletter tools and some AI
 * crawlers subscribe to feeds rather than re-reading the sitemap, so this is
 * one more way a new post gets picked up the day it ships.
 */
export const dynamic = "force-static";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** YYYY-MM-DD -> RFC 822, pinned to noon UTC so the date never shifts a day. */
function rfc822(date: string): string {
  return new Date(`${date}T12:00:00Z`).toUTCString();
}

export function GET() {
  const site = siteUrl();
  const posts = getAllPosts();
  const items = posts.map((post) => {
    const url = `${site}${post.path}`;
    return [
      "    <item>",
      `      <title>${escapeXml(post.frontmatter.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${rfc822(post.frontmatter.publishedAt)}</pubDate>`,
      `      <dc:creator>${escapeXml(authors[post.frontmatter.author].name)}</dc:creator>`,
      `      <description>${escapeXml(post.frontmatter.description)}</description>`,
      "    </item>",
    ].join("\n");
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    "    <title>The LedaChat blog</title>",
    `    <link>${site}/blog</link>`,
    "    <description>Guides to Instagram comment to DM automation and running it from AI agents through LedaChat's MCP.</description>",
    "    <language>en-us</language>",
    `    <atom:link href="${site}/blog/rss.xml" rel="self" type="application/rss+xml" />`,
    ...(posts[0] ? [`    <lastBuildDate>${rfc822(posts[0].lastModified)}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
