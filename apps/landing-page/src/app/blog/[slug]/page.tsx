import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { cn } from "@adeli-chat/ui/lib/utils";

import { PostCards, PostCta, splitAtSecondH2 } from "@/components/blog";
import { HOVER_UNDERLINE, JoinWaitlist, SiteFooter, SiteHeader, TITLE_UNDERLINE } from "@/components/site-chrome";
import { authorPerson, authors, type Author } from "@/lib/blog/authors";
import { POST_TYPE_LABELS } from "@/lib/blog/frontmatter";
import { getAllPosts, getPost, relatedPosts } from "@/lib/blog/posts";
import { renderMarkdown } from "@/lib/blog/render";
import { blogPosting, postUrl } from "@/lib/blog/schema";
import { formatDate } from "@/lib/blog/text";
import { TITLE_SUFFIX } from "@/lib/blog/validate";
import { breadcrumbs, faqPage, graph, jsonLdScript, organization, website } from "@/lib/schema";
import { SITE_PAGES } from "@/lib/site-pages";

/**
 * /blog/[slug], statically generated from `content/blog/<slug>.md`. Top to
 * bottom, the page follows the order an answer engine reads in:
 *
 *   1. H1, byline, visible dates   (who says so, and how fresh it is)
 *   2. The short answer (`tldr`)   (the quotable 30 to 75 words)
 *   3. The body, with a TOC rail   (question-shaped, anchor-linked H2s, and
 *      and CTAs                     an inline CTA after the first section)
 *   4. Author card and related     (E-E-A-T, and links into pages that convert)
 *   5. FAQ                         (FAQPage JSON-LD mirrors it exactly)
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const fm = post.frontmatter;
  const author = authors[fm.author].name;
  return {
    title: { absolute: `${fm.title}${TITLE_SUFFIX}` },
    description: fm.description,
    keywords: [fm.targetQuery, ...fm.tags],
    authors: [{ name: author }],
    alternates: {
      canonical: post.path,
      types: { "text/markdown": `${post.path}.md`, "application/rss+xml": "/blog/rss.xml" },
    },
    openGraph: {
      type: "article",
      title: fm.title,
      description: fm.description,
      url: post.path,
      siteName: "LedaChat",
      publishedTime: fm.publishedAt,
      modifiedTime: post.lastModified,
      authors: [author],
      section: POST_TYPE_LABELS[fm.type],
      tags: fm.tags,
    },
    twitter: { card: "summary_large_image", title: fm.title, description: fm.description },
    robots: fm.draft ? { index: false, follow: false } : undefined,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const fm = post.frontmatter;
  const author: Author = authors[fm.author];
  const { html, toc } = await renderMarkdown(post.body);
  const split = splitAtSecondH2(html);
  const related = fm.relatedPages.flatMap((path) => SITE_PAGES.filter((page) => page.path === path));
  const morePosts = relatedPosts(post);

  const structuredData = graph([
    organization(),
    website(),
    authorPerson(fm.author),
    blogPosting(post),
    breadcrumbs([
      { name: "LedaChat", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: fm.title, path: post.path },
    ]),
    ...(fm.faqs.length > 0 ? [faqPage(fm.faqs.map((faq) => ({ question: faq.question, answer: faq.answer.trim() })), `${postUrl(post)}#faq`)] : []),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structuredData) }} />
      <SiteHeader />

      <main>
        <article>
          <header className="bg-muted px-4 pt-12 pb-10 sm:px-6 md:pt-16">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Link href="/blog" className={HOVER_UNDERLINE}>Blog</Link>
                <span aria-hidden>/</span>
                <span>{POST_TYPE_LABELS[fm.type]}</span>
              </nav>
              <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">{fm.title}</h1>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  By <a href="#author" className={cn("font-semibold text-foreground", HOVER_UNDERLINE)}>{author.name}</a>, {author.role}
                </span>
                <span>Published <time dateTime={fm.publishedAt}>{formatDate(fm.publishedAt)}</time></span>
                {fm.updatedAt && fm.updatedAt !== fm.publishedAt ? (
                  <span>Updated <time dateTime={fm.updatedAt}>{formatDate(fm.updatedAt)}</time></span>
                ) : null}
                <span>{post.readingMinutes} min read</span>
              </p>
              <div className="mt-2 rounded-xl border bg-card p-5">
                <p className="text-sm font-semibold">The short answer</p>
                <p className="mt-2 text-base">{fm.tldr.trim()}</p>
              </div>
            </div>
          </header>

          <div className="px-4 pt-10 pb-16 sm:px-6">
            <div className="mx-auto grid max-w-2xl gap-12 xl:max-w-none xl:grid-cols-[minmax(0,1fr)_minmax(0,42rem)_minmax(0,1fr)]">
              <div className="min-w-0 xl:col-start-2">
                {split ? (
                  <>
                    <div className="blog-prose" dangerouslySetInnerHTML={{ __html: split[0] }} />
                    <PostCta cta={fm.cta} variant="inline" />
                    <div className="blog-prose" dangerouslySetInnerHTML={{ __html: split[1] }} />
                  </>
                ) : (
                  <div className="blog-prose" dangerouslySetInnerHTML={{ __html: html }} />
                )}

                <section id="author" aria-label="About the author" className="mt-14 scroll-mt-20 rounded-xl border bg-card p-5">
                  <p className="text-xs text-muted-foreground">Written by</p>
                  <p className="mt-1 font-semibold">{author.name}</p>
                  <p className="text-sm text-muted-foreground">{author.role}</p>
                  <p className="mt-3 text-sm">{author.bio}</p>
                </section>

                {related.length > 0 ? (
                  <nav aria-label="Related LedaChat pages" className="mt-10">
                    <p className="mb-3 text-xs font-semibold text-muted-foreground">Related</p>
                    <ul className="flex flex-col gap-2">
                      {related.map((page) => (
                        <li key={page.path}>
                          <Link href={page.path} className={cn("font-medium text-link", HOVER_UNDERLINE)}>{page.title}</Link>
                        </li>
                      ))}
                    </ul>
                  </nav>
                ) : null}
              </div>

              <div className="hidden xl:col-start-3 xl:block">
                <div className="sticky top-20 flex w-56 flex-col gap-8">
                  {toc.filter((entry) => entry.depth === 2).length >= 3 ? (
                    <nav aria-label="On this page" className="text-sm">
                      <ul className="flex flex-col gap-3 border-l pl-4">
                        {toc.filter((entry) => entry.depth === 2).map((entry) => (
                          <li key={entry.id}>
                            <a href={`#${entry.id}`} className="leading-snug text-muted-foreground hover:text-foreground">{entry.text}</a>
                          </li>
                        ))}
                      </ul>
                    </nav>
                  ) : null}
                  <PostCta cta={fm.cta} variant="sidebar" />
                </div>
              </div>
            </div>
          </div>
        </article>

        {fm.faqs.length > 0 ? (
          <section id="faq" className="scroll-mt-16 border-t bg-muted px-4 py-14 sm:px-6">
            <div className="mx-auto max-w-2xl">
              <h2 className={cn("mb-8 text-center text-2xl font-semibold tracking-tight", TITLE_UNDERLINE)}>Frequently asked questions</h2>
              <div className="divide-y rounded-xl border bg-card">
                {fm.faqs.map((faq) => (
                  <details key={faq.question} className="group px-5 py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                      {faq.question}
                      <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" aria-hidden />
                    </summary>
                    <p className="mt-2.5 text-sm">{faq.answer.trim()}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {morePosts.length > 0 ? (
          <section className="border-t px-4 py-14 sm:px-6">
            <div className="mx-auto max-w-5xl">
              <h2 className={cn("mb-8 text-center text-2xl font-semibold tracking-tight", TITLE_UNDERLINE)}>More from the blog</h2>
              <PostCards posts={morePosts} showMeta={false} />
            </div>
          </section>
        ) : null}

        <section className="border-t px-4 py-16 text-center sm:px-6">
          <h2 className={cn("text-2xl font-semibold tracking-tight md:text-3xl", TITLE_UNDERLINE)}>Your next comment could be a lead</h2>
          <p className="mt-3 text-base">Join the waitlist and be first in when we open. Free and open source.</p>
          <div className="mt-7 flex justify-center"><JoinWaitlist /></div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
