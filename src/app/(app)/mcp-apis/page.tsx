import { PageHeading } from "@/components/page-heading";
import { McpSettings } from "@/components/settings/mcp-settings";
import { authEnabled } from "@/lib/auth/config";
import { requireUserPage } from "@/lib/auth/session";
import { mcpResourceUrl } from "@/lib/mcp/config";
import { listConnectedApps } from "@/lib/mcp/connections";
import { listTokens } from "@/lib/mcp/tokens";

export const dynamic = "force-dynamic";

/** MCP & APIs: connect Claude or another MCP client, API tokens and connected apps. */
export default async function McpSettingsPage() {
  const user = await requireUserPage();
  const [tokens, apps] = await Promise.all([listTokens(user.id), listConnectedApps(user.id)]);
  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeading title="MCP & APIs" description="Let Claude, or any MCP client, list, create and manage your automations." />
      <div className="grid max-w-3xl gap-4">
        <McpSettings mcpUrl={mcpResourceUrl()} oauthEnabled={authEnabled()} tokens={tokens} apps={apps} />
      </div>
    </div>
  );
}
