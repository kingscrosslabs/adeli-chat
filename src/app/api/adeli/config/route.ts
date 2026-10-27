import { adeliErrorResponse } from "@/lib/adeli/http";
import { listProfiles, usesAdeliMock } from "@/lib/adeli/server";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireSession(request);
  if (unauthorized) return unauthorized;
  try {
    return Response.json({ mode: usesAdeliMock() ? "mock" : "real", profiles: await listProfiles() });
  } catch (error) {
    return adeliErrorResponse(error);
  }
}
