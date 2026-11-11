import { appUrl } from "@/lib/app-url";

/** What LedaChat calls itself in MCP clients and install links. */
export const MCP_SERVER_NAME = "ledachat";
export const MCP_DISPLAY_NAME = "LedaChat";

/**
 * OAuth scopes for the MCP endpoint. Read lets Claude list and inspect
 * automations; write lets it create, change, go live, pause and delete.
 */
export const MCP_READ_SCOPE = "automations:read";
export const MCP_WRITE_SCOPE = "automations:write";
export const MCP_SCOPES = [MCP_READ_SCOPE, MCP_WRITE_SCOPE] as const;

/** The MCP endpoint, which is also the OAuth resource its access tokens are bound to. */
export function mcpResourceUrl(): string {
  return `${appUrl()}/mcp`;
}
