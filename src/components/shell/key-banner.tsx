import { AlertTriangle } from "lucide-react";
import Link from "next/link";

/** FR-S.7: shown on every page while the Adeli key is rejected or missing. */
export function KeyBanner({ problem }: { problem: "missing" | "invalid" | null }) {
  if (!problem) return null;
  const message = problem === "missing"
    ? "ADELI_API_KEY isn't set on this server, so your automations can't run."
    : "Adeli stopped accepting the key in ADELI_API_KEY. Set a new one and restart to resume your automations. Nothing is lost while you do.";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-warning-wash px-4 py-2.5 text-sm text-warning md:px-8" role="alert">
      <AlertTriangle className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      <Link href="/settings" className="font-semibold underline underline-offset-4">Check the key</Link>
    </div>
  );
}
