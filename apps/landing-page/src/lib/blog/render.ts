import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

/**
 * Markdown body -> HTML, at build time only. Posts are statically generated,
 * so none of this ships to the browser.
 *
 * - GFM: tables, task lists, strikethrough, autolinks.
 * - Slugged headings with anchor links, so every section is deep-linkable.
 *   AI answers and "People also ask" boxes link to `#section` fragments.
 * - External links open in a new tab.
 */

export type TocEntry = { id: string; text: string; depth: 2 | 3 };

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

function walk(node: HastNode, visit: (node: HastNode) => void) {
  visit(node);
  node.children?.forEach((child) => walk(child, visit));
}

/** Collects H2/H3 ids after `rehype-slug` has assigned them. */
function collectToc(toc: TocEntry[]) {
  return () => (tree: HastNode) =>
    walk(tree, (node) => {
      if (node.type === "element" && (node.tagName === "h2" || node.tagName === "h3")) {
        const id = node.properties?.id;
        if (typeof id === "string") toc.push({ id, text: textOf(node).trim(), depth: node.tagName === "h2" ? 2 : 3 });
      }
    });
}

function externalLinks() {
  return (tree: HastNode) =>
    walk(tree, (node) => {
      if (node.type === "element" && node.tagName === "a") {
        const href = node.properties?.href;
        if (typeof href === "string" && /^https?:\/\//.test(href)) {
          node.properties = { ...node.properties, target: "_blank", rel: ["noopener", "noreferrer"] };
        }
      }
    });
}

export async function renderMarkdown(markdown: string): Promise<{ html: string; toc: TocEntry[] }> {
  const toc: TocEntry[] = [];
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(collectToc(toc))
    .use(rehypeAutolinkHeadings, {
      behavior: "append",
      properties: { className: ["heading-anchor"], ariaHidden: "true", tabIndex: -1 },
      content: { type: "text", value: "#" },
    })
    .use(externalLinks)
    .use(rehypeStringify)
    .process(markdown);
  return { html: String(file), toc };
}
