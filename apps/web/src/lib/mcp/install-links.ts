import { MCP_DISPLAY_NAME, MCP_SERVER_NAME } from "./config";

/**
 * Install snippets for the Settings page. Pure functions of the MCP URL (and a
 * token, when one was just created), so they're easy to test.
 */

export const TOKEN_PLACEHOLDER = "<YOUR_API_TOKEN>";

/**
 * Opens claude.ai's "Add custom connector" dialog with the name and URL filled
 * in. The connector then signs in with OAuth; it can't send an API token.
 */
export function claudeConnectorLink(mcpUrl: string): string {
  const params = new URLSearchParams({ modal: "add-custom-connector", connectorName: MCP_DISPLAY_NAME, connectorUrl: mcpUrl });
  return `https://claude.ai/customize/connectors?${params.toString()}`;
}

/** Claude Code: adds the server with an API token header, or with none (`null`) to sign in through `/mcp`. */
export function claudeCodeCommand(mcpUrl: string, token: string | null = TOKEN_PLACEHOLDER): string {
  const command = `claude mcp add --transport http ${MCP_SERVER_NAME} ${mcpUrl}`;
  return token === null ? command : `${command} --header "Authorization: Bearer ${token}"`;
}

/** Codex CLI: adds the streamable HTTP server, then signs in with OAuth. */
export function codexCommands(mcpUrl: string) {
  return { add: `codex mcp add ${MCP_SERVER_NAME} --url ${mcpUrl}`, login: `codex mcp login ${MCP_SERVER_NAME}` };
}

/** Cursor's mcp.json entry. No headers: Cursor signs in with OAuth. */
export function cursorConfig(mcpUrl: string): string {
  return JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { url: mcpUrl } } }, null, 2);
}

/** Cursor's one-click install deeplink: the server's config, base64 JSON. */
export function cursorInstallLink(mcpUrl: string): string {
  const config = btoa(JSON.stringify({ url: mcpUrl }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?${new URLSearchParams({ name: MCP_SERVER_NAME, config }).toString()}`;
}
