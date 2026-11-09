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

/** Claude Code: adds the server with an API token header. */
export function claudeCodeCommand(mcpUrl: string, token = TOKEN_PLACEHOLDER): string {
  return `claude mcp add --transport http ${MCP_SERVER_NAME} ${mcpUrl} --header "Authorization: Bearer ${token}"`;
}

/** The `mcpServers` JSON most clients (Cursor, Claude Desktop config, Windsurf) accept. */
export function manualConfig(mcpUrl: string, token = TOKEN_PLACEHOLDER): string {
  return JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { url: mcpUrl, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);
}
