import { sessionCookie, verifyAdminPassword } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { password?: unknown };
    if (typeof body.password !== "string" || !verifyAdminPassword(body.password)) {
      return Response.json({ error: { code: "unauthorized", message: "That password didn't match. Check ADMIN_PASSWORD in your server environment." } }, { status: 401 });
    }
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(request) } });
  } catch (error) {
    return Response.json({ error: { code: "server_not_configured", message: error instanceof Error ? error.message : "Server authentication is not configured." } }, { status: 503 });
  }
}
