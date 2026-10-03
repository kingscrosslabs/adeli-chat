"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { useDemoState } from "@/lib/demo/store";

/** FR-S.7: shown on every page while the Adeli key is rejected or missing. */
export function KeyBanner() {
  const state = useDemoState();
  if (!state) return null;
  const message = !state.adeliKey
    ? "There's no Adeli key on this install, so your automations are paused."
    : state.adeliKey.status === "invalid"
      ? "Your Adeli key stopped working. Add a new one to resume your automations. Nothing is lost while you do."
      : null;
  if (!message) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-warning-wash px-4 py-2.5 text-sm text-warning md:px-8" role="alert">
      <AlertTriangle className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      <Link href="/setup" className="font-semibold underline underline-offset-4">Add a key</Link>
    </div>
  );
}
