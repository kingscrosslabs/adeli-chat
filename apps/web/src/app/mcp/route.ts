import { handleMcpRequest } from "@/lib/mcp/handler";

export const dynamic = "force-dynamic";

/** The MCP endpoint (Streamable HTTP, stateless). See `src/lib/mcp/handler.ts`. */
export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
