import { authors } from "./authors";
import type { BlogPost } from "./posts";
import { postUrl } from "./schema";
import { formatDate } from "./text";

/**
 * The plain Markdown copy of a post, served at `/blog/<slug>.md` for AI
 * agents and answer engines: title, byline, the short answer first, then the
 * body and the FAQ. Same words as the HTML page, none of the chrome.
 */
export function postMarkdown(post: BlogPost): string {
  const fm = post.frontmatter;
  const author = authors[fm.author];
  const dates = [`Published ${formatDate(fm.publishedAt)}`];
  if (fm.updatedAt && fm.updatedAt !== fm.publishedAt) dates.push(`updated ${formatDate(fm.updatedAt)}`);
  const faq = fm.faqs.length
    ? `\n\n## Frequently asked questions\n\n${fm.faqs.map((item) => `### ${item.question}\n\n${item.answer.trim()}`).join("\n\n")}`
    : "";
  return `# ${fm.title}

By ${author.name}, ${author.role}. ${dates.join(", ")}.
Canonical: ${postUrl(post)}

> ${fm.tldr.trim()}

${post.body}${faq}
`;
}
