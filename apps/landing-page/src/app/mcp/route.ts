import { APP_URL } from "@/lib/links";

/**
 * `ledachat.com/mcp` is a natural guess for LedaChat's MCP server, but the
 * server lives on the app (`app.ledachat.com/mcp`). Redirecting or proxying
 * can't work: MCP clients refuse OAuth discovery that changes origin, and the
 * server's OAuth metadata names its own URL. So this answers every method with
 * a 404 that says where to go, which an agent reads and follows.
 */
const SERVER = `${APP_URL}/mcp`;
const MESSAGE = `LedaChat's MCP server isn't on this domain. Use ${SERVER} (Streamable HTTP, OAuth sign-in, no token needed). Codex: codex mcp add ledachat --url ${SERVER}, then codex mcp login ledachat, then start a new Codex session. Claude Code: /plugin install ledachat --marketplace kingscrosslabs/ledachat, or claude mcp add --transport http ledachat ${SERVER}. Setup guide: https://www.ledachat.com/docs/mcp.`;

function notHere(json: boolean): Response {
  if (!json) return new Response(`${MESSAGE}\n`, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", Link: `<${SERVER}>; rel="alternate"` } });
  return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32601, message: MESSAGE, data: { mcpServerUrl: SERVER } } }, { status: 404, headers: { Link: `<${SERVER}>; rel="alternate"` } });
}

export function GET(): Response {
  return notHere(false);
}

export function POST(): Response {
  return notHere(true);
}
