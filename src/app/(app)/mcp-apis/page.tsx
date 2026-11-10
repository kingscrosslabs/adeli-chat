import { PageHeading } from "@/components/page-heading";
import { McpSettings } from "@/components/settings/mcp-settings";
import { authEnabled } from "@/lib/auth/config";
import { requireUserPage } from "@/lib/auth/session";
import { mcpResourceUrl } from "@/lib/mcp/config";
import { listConnectedApps } from "@/lib/mcp/connections";
import { ensureDefaultToken, listTokens } from "@/lib/mcp/tokens";

export const dynamic = "force-dynamic";

/** Connect to AI Agent: connect Claude or another MCP client, API tokens and connected apps. */
export default async function McpSettingsPage() {
  const user = await requireUserPage();
  // Every user has a Default token, so the guides can show a real one.
  const defaultToken = await ensureDefaultToken(user.id);
  const [tokens, apps] = await Promise.all([listTokens(user.id), listConnectedApps(user.id)]);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeading title="Connect to AI Agent" description="Let Claude, ChatGPT, Cursor or any MCP client list, create and manage your automations." />
      <div className="grid gap-4">
        <McpSettings mcpUrl={mcpResourceUrl()} oauthEnabled={authEnabled()} defaultToken={defaultToken} tokens={tokens} apps={apps} />
      </div>
    </div>
  );
}
