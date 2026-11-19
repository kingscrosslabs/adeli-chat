/**
 * The site's linkable pages, for blog posts' `relatedPages` and in-body links.
 * The homepage's sections count as pages here: until LedaChat has dedicated
 * product pages, they are where a post sends readers to convert. A post that
 * links anywhere else on the site fails the build (`lib/blog/validate.ts`).
 */
export const SITE_PAGES: ReadonlyArray<{ path: string; title: string }> = [
  { path: "/", title: "LedaChat: free, open-source comment to DM for Instagram" },
  { path: "/#how-it-works", title: "How LedaChat's comment to DM works" },
  { path: "/#mcp", title: "Create automations with AI: LedaChat's MCP" },
  { path: "/#compare", title: "LedaChat vs ManyChat" },
  { path: "/#options", title: "Plans: Free, Pro and self-hosted" },
  { path: "/#faq", title: "LedaChat FAQ" },
  { path: "/docs/mcp", title: "Connect LedaChat to Claude and other AI agents" },
  { path: "/blog", title: "The LedaChat blog" },
];
