import type { Metadata } from "next";

import { cn } from "@adeli-chat/ui/lib/utils";

import { PostCards } from "@/components/blog";
import { SiteFooter, SiteHeader, TITLE_UNDERLINE } from "@/components/site-chrome";
import { getAllPosts } from "@/lib/blog/posts";
import { blogNode } from "@/lib/blog/schema";
import { breadcrumbs, graph, jsonLdScript, organization, website } from "@/lib/schema";

/**
 * /blog: every published post, newest first, read from `content/blog/` by
 * `getAllPosts()`, so this page never needs editing when a post ships.
 */

const TITLE = "The LedaChat blog";
const DESCRIPTION =
  "Guides to Instagram comment to DM automation, ManyChat-style workflows, and running them from Claude, ChatGPT or Cursor through LedaChat's MCP.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | LedaChat` },
  description: DESCRIPTION,
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
  openGraph: { type: "website", url: "/blog", siteName: "LedaChat", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function BlogIndex() {
  const posts = getAllPosts();
  const structuredData = graph([
    organization(),
    website(),
    blogNode(posts),
    breadcrumbs([
      { name: "LedaChat", path: "/" },
      { name: "Blog", path: "/blog" },
    ]),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structuredData) }} />
      <SiteHeader />
      <main>
        <section className="px-4 pt-14 pb-10 text-center sm:px-6 md:pt-20">
          <div className="mx-auto max-w-2xl">
            <h1 className={cn("text-4xl font-semibold tracking-tight text-balance md:text-5xl", TITLE_UNDERLINE)}>The LedaChat blog</h1>
            <p className="mt-6 text-lg text-foreground">{DESCRIPTION}</p>
          </div>
        </section>
        <section className="border-t px-4 py-12 sm:px-6 md:py-16">
          <div className="mx-auto max-w-5xl">
            {posts.length === 0 ? <p className="text-center">The first post is on its way.</p> : <PostCards posts={posts} />}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
