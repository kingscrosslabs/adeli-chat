import { handleMcpRequest } from "@/lib/mcp/handler";

export const dynamic = "force-dynamic";
// Message earlier comments sends after the response, within this limit.
export const maxDuration = 300;

/** The MCP endpoint (Streamable HTTP, stateless). See `src/lib/mcp/handler.ts`. */
export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
