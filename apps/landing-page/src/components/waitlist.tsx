"use client";

import { ArrowRight, Check, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { buttonVariants } from "@adeli-chat/ui/components/button";
import { cn } from "@adeli-chat/ui/lib/utils";

import { WAITLIST_FORM_ID, WAITLIST_HASH, WAITLIST_JOINED_PARAM, WAITLIST_URL } from "@/lib/links";

type TallyPopupOptions = { layout?: "modal" | "default"; width?: number; overlay?: boolean; emoji?: { text: string; animation: string } };
declare global {
  interface Window {
    Tally?: { openPopup: (formId: string, options?: TallyPopupOptions) => void };
  }
}

/**
 * Opens the Tally waitlist form as a popup over the page (Tally's embed script,
 * loaded in layout.tsx). Until the script has loaded, or without JavaScript, the
 * link opens the form in a new tab instead. Either way, Tally sends people back
 * to the homepage with `?waitlist=joined` when they submit (the form's
 * "Redirect on completion" setting), where `WaitlistJoinedNotice` thanks them.
 */
export function JoinWaitlist({ size = "lg", variant = "default", className }: { size?: "default" | "lg"; variant?: "default" | "outline"; className?: string }) {
  return (
    <a
      href={WAITLIST_URL}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (!window.Tally) return;
        event.preventDefault();
        openWaitlistPopup();
      }}
      className={cn(buttonVariants({ size, variant }), className)}
    >
      Join waitlist <ArrowRight data-icon="inline-end" />
    </a>
  );
}

function openWaitlistPopup() {
  window.Tally?.openPopup(WAITLIST_FORM_ID, { layout: "modal", width: 560, overlay: true });
}

/**
 * Opens the waitlist popup when the page is visited at `/#waitlist` (or
 * `/waitlist`, which redirects there; next.config.ts), so a shared link lands
 * straight on the form. Waits for Tally's script, then drops the hash so
 * closing the popup leaves a clean homepage URL.
 */
export function WaitlistLinkOpener() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const openFromHash = () => {
      if (window.location.hash !== `#${WAITLIST_HASH}`) return;
      clearInterval(timer);
      let waited = 0;
      timer = setInterval(() => {
        waited += 100;
        if (window.Tally) {
          clearInterval(timer);
          // Drop the hash only once the popup opens, so closing it leaves a clean homepage URL.
          const url = new URL(window.location.href);
          url.hash = "";
          window.history.replaceState(window.history.state, "", url.pathname + url.search);
          openWaitlistPopup();
        } else if (waited >= 10_000) {
          // Tally's script never loaded (blocked or offline): open the form itself instead.
          clearInterval(timer);
          window.location.href = WAITLIST_URL;
        }
      }, 100);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => {
      clearInterval(timer);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);
  return null;
}

/** Whether this visit came back from Tally with `?waitlist=joined`. Read once, then the flag is dropped from the URL so a refresh or a shared link doesn't thank someone again. */
let cameBackJoined: boolean | null = null;
function readCameBackJoined(): boolean {
  if (cameBackJoined === null) {
    const url = new URL(window.location.href);
    cameBackJoined = url.searchParams.get(WAITLIST_JOINED_PARAM.name) === WAITLIST_JOINED_PARAM.value;
    if (cameBackJoined) {
      url.searchParams.delete(WAITLIST_JOINED_PARAM.name);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }
  return cameBackJoined;
}
const noSubscribe = () => () => {};

/** Shown on the homepage after Tally redirects back from a submitted waitlist form. */
export function WaitlistJoinedNotice() {
  const joined = useSyncExternalStore(noSubscribe, readCameBackJoined, () => false);
  const [dismissed, setDismissed] = useState(false);
  const show = joined && !dismissed;

  if (!show) return null;
  return (
    <div role="status" className="border-b border-highlight bg-muted px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center gap-3 text-sm text-foreground">
        <Check className="size-4 shrink-0 text-link" aria-hidden />
        <p className="flex-1"><span className="font-semibold">You&apos;re on the list.</span> Thanks for joining the LedaChat waitlist. We&apos;ll email you as soon as your spot opens up.</p>
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss" className="rounded-sm p-1 hover:bg-background">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
