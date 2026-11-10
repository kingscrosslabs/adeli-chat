import { AlertTriangle } from "lucide-react";

/**
 * FR-S.7: shown on every page while the server's Adeli key is missing or
 * rejected. Only whoever runs the install can fix it (`ADELI_API_KEY`).
 */
export function KeyBanner({ problem }: { problem: "missing" | "invalid" | null }) {
  if (!problem) return null;
  const message = problem === "missing"
    ? "This server has no Adeli API key, so automations can't run. Set ADELI_API_KEY (see the README) and restart."
    : "Adeli stopped accepting this server's API key, so automations are stopped. Replace ADELI_API_KEY and restart. Nothing is lost while you do.";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-warning-wash px-4 py-2.5 text-sm text-warning md:px-8" role="alert">
      <AlertTriangle className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
    </div>
  );
}
