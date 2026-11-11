import { AdeliError } from "./types";

export function adeliErrorResponse(error: unknown) {
  if (error instanceof AdeliError) {
    const status = error.status ?? (error.code === "unauthorized" ? 401 : error.code === "network" ? 502 : 400);
    return Response.json({ error: { code: error.code, message: error.message } }, { status });
  }
  return Response.json({ error: { code: "internal_error", message: "Something went wrong while talking to Adeli." } }, { status: 500 });
}
