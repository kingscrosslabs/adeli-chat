import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Better Auth's endpoints: Google sign-in, its callback, session and sign-out. */
export const GET = (request: Request) => auth().handler(request);
export const POST = (request: Request) => auth().handler(request);
