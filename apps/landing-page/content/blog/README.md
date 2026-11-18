# LedaChat blog posts

One Markdown file per post. The filename is the URL:
`content/blog/manychat-mcp.md` publishes at `ledachat.com/blog/manychat-mcp`.
Ported from Adeli's blog (`adeli/apps/landing-page`), same contract.

```bash
yarn dev:landing      # preview at localhost:3031/blog/<slug>
yarn workspace @adeli-chat/landing-page build   # runs the quality gate and check:seo
```

## What you get automatically

Adding the file is the whole registration step. Each post gets:

- `/blog/<slug>`: the page, with the byline and dates, the short answer, a table of contents, an inline CTA, the author card, related pages and the FAQ
- JSON-LD: BlogPosting (TechArticle for how-tos), Person author, FAQPage, BreadcrumbList
- `/blog/<slug>.md`: a clean Markdown mirror for AI agents
- Entries in `/sitemap.xml`, `/llms.txt` and `/blog/rss.xml`
- A generated Open Graph / X share image, also at `/blog/<slug>/og-image.png`
- An IndexNow ping on the next production deploy (it submits the whole sitemap)

## Frontmatter

See `src/lib/blog/frontmatter.ts` for the full contract.

| Field | Why it exists |
| --- | --- |
| `title` | H1, and `<title>` with " \| LedaChat". At most 49 characters. |
| `description` | Search snippet and llms.txt summary. 110 to 160 characters (the build fails otherwise). |
| `type` | `how-to`, `listicle`, `explainer`, or `changelog` |
| `author` | `mika` or `nick`. Registry in `src/lib/blog/authors.ts` |
| `publishedAt` / `updatedAt` | `YYYY-MM-DD`. Bump `updatedAt` on meaningful edits; freshness is a ranking signal. |
| `targetQuery` | The one search or prompt this post answers |
| `tldr` | 30 to 75 word direct answer, shown above the fold. The line AI engines quote. |
| `faqs` | Q&A pairs, shown on the page and emitted as FAQPage schema |
| `relatedPages` | Site pages this post supports, from `src/lib/site-pages.ts`. At least one. |
| `cta` | Optional title and body for the in-post CTA cards |
| `draft` | `true` hides the post in production. It still renders in `yarn dev`. |

## The quality gate

`src/lib/blog/validate.ts` runs on every build. Errors block it: dead internal
links, a bad date, a second H1, a long title, a description out of range, an em
dash, or a link to a competitor's site. Warnings are a checklist: TL;DR length,
question-shaped headings, FAQ count, thin content.
