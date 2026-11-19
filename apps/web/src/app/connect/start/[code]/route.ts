import { track } from "@/lib/analytics/server";
import { appUrl } from "@/lib/app-url";
import { authEnabled } from "@/lib/auth/config";
import { sessionCookieFor } from "@/lib/auth/link-session";
import { connectPath, redeemConnectLink } from "@/lib/connect-links";

export const dynamic = "force-dynamic";

/**
 * A one-time link from the MCP `connect_instagram` tool: signs the user in on
 * this browser and opens `/connect`. Unknown, used or expired codes just open
 * `/connect`, which asks for sign-in as usual. It only ever redirects to
 * `/connect`. `src/proxy.ts` lets it through without a session.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await redeemConnectLink(code);
  if (!link) return redirect("/connect");
  track(link.userId, "mcp_connect_link_opened", { method: link.method ?? "none" });
  if (!authEnabled()) return redirect(connectPath(link.method));
  const cookie = await sessionCookieFor(link.userId, request);
  if (!cookie) return redirect("/connect");
  return redirect(connectPath(link.method), cookie);
}

function redirect(path: string, cookie?: string) {
  const headers = new Headers({ Location: `${appUrl()}${path}`, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
