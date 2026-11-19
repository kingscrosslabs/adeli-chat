import { FREE_LIVE_AUTOMATIONS, PRO_MONTHLY_DOLLARS } from "@adeli-chat/ui/billing/plans";

import { faqs } from "@/components/landing-page";
import { getAllPosts } from "@/lib/blog/posts";
import { APP_URL, GITHUB_URL, WAITLIST_URL } from "@/lib/links";
import { siteUrl } from "@/lib/site-url";

/** /llms.txt (llmstxt.org): the landing page's own copy as plain Markdown for AI agents and answer engines. Built once at build time. */
export const dynamic = "force-static";

function body(): string {
  const posts = getAllPosts()
    .map((post) => `- [${post.frontmatter.title}](${siteUrl()}${post.path}.md): ${post.frontmatter.description}`)
    .join("\n");
  const faq = faqs.map((item) => `### ${item.question}\n\n${item.text}`).join("\n\n");
  return `# LedaChat

> LedaChat is a free, open-source Instagram comment to DM tool with a built-in MCP, so you can set up automations by asking Claude, ChatGPT, Cursor or another AI agent.

LedaChat is opening soon. Join the waitlist to be first in.

## What it does

- Someone comments your keyword on a post or reel. Story replies work too.
- LedaChat posts a public reply under their comment and sends them a DM with a button.
- They tap and get your link. Want the lead? Ask for their email before the link goes out.
- It runs on Instagram's official API through Adeli, a Meta Tech Provider. No passwords, no scraping, no browser bots.
- Features: keyword and any-comment triggers; one post, next post or every post; story replies; public comment replies with random variations; DMs with a button; email capture and lead export to CSV; once per person; stats and tap tracking; draft, live and pause; read-only and expiring API tokens.

## Plans

- Free: $0 forever. ${FREE_LIVE_AUTOMATIONS} live automations, every feature, MCP access, and LedaChat branding in the last DM.
- Pro: $${PRO_MONTHLY_DOLLARS} per month. Unlimited automations and no branding. One flat price whether 50 or 50,000 people comment, never priced by active contacts.
- Self-host: free under the MIT license. Unlimited automations, deploy to Vercel in a few steps, and bring your own Adeli API key (Adeli's free plan covers your own account).

## MCP

LedaChat has an MCP built in. Ask your AI agent (Claude, ChatGPT, Cursor, Perplexity or Grok Bot) to set up, put live or pause your comment to DM automations instead of clicking through a flow builder. For example: "Set up a comment to DM on my latest reel. When someone comments GUIDE, send them my AI guide link."

- Hosted MCP server: ${APP_URL}/mcp (Streamable HTTP). Sign-in is OAuth, so there's no token to paste: the agent's client opens a sign-in window, and signing in with Google creates the account. Then the server tells the agent to connect Instagram with a one-time link.
- Use this exact URL. \`ledachat.com/mcp\` is not the server, and MCP clients won't follow a redirect to it during sign-in.
- Setup guide for every client, with the tool list: ${siteUrl()}/docs/mcp
- Claude (claude.ai and Claude Desktop): Settings, Connectors, Add custom connector, with the server URL.
- Claude Code plugin: \`/plugin install ledachat --marketplace kingscrosslabs/ledachat\` (or \`/plugin marketplace add kingscrosslabs/ledachat\`, then \`/plugin install ledachat@ledachat\`), then \`/mcp\` and Authenticate.
- Claude Code without the plugin: \`claude mcp add --transport http ledachat ${APP_URL}/mcp\`
- Codex: \`codex mcp add ledachat --url ${APP_URL}/mcp\`, then \`codex mcp login ledachat\`. Codex loads MCP tools when a session starts, so start a new Codex session after signing in.
- To check the connection, ask the agent to call \`get_workspace\`: it says who is signed in, which Instagram account is connected (or how to connect one), and the plan.
- Clients that can't do OAuth can send \`Authorization: Bearer adc_...\` with an API token from ${APP_URL}/settings.

## FAQ

${faq}

## Blog

Each post as plain Markdown:

${posts}

## Links

- [LedaChat](${siteUrl()}): the homepage
- [Source code on GitHub](${GITHUB_URL}): MIT licensed, with self-hosting instructions
- [MCP setup guide](${siteUrl()}/docs/mcp): Claude, the Claude Code plugin, Codex, Cursor and other clients
- [Blog](${siteUrl()}/blog): guides, with an RSS feed at ${siteUrl()}/blog/rss.xml
- [Join the waitlist](${WAITLIST_URL})
`;
}

export function GET(): Response {
  return new Response(body(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
