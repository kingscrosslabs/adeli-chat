"use client";

import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@adeli-chat/ui/components/button";
import { revealApiToken } from "@/lib/actions";
import { cn } from "@adeli-chat/ui/lib/utils";

/** The token's prefix, then dots: enough to recognise it without exposing it (as Adeli's `maskApiKey`). */
export function maskToken(prefix: string, dots = 16) {
  return `${prefix}${"•".repeat(dots)}`;
}

/**
 * One token's secret, fetched with `revealApiToken` on first need and then
 * held in memory only. Mirrors Adeli's `useApiKeySecret`.
 */
export function useTokenSecret(tokenId: string | null) {
  const [loaded, setLoaded] = useState<{ tokenId: string; secret: string } | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef<Promise<string | null> | null>(null);
  const secret = loaded && loaded.tokenId === tokenId ? loaded.secret : null;

  const load = useCallback(async () => {
    if (!tokenId) return null;
    if (secret) return secret;
    if (inFlight.current) return inFlight.current;
    inFlight.current = (async () => {
      setPending(true);
      try {
        const result = await revealApiToken(tokenId);
        if (!result.ok) {
          toast.error(result.reason === "error" ? result.message : "Could not reveal this token.");
          return null;
        }
        setLoaded({ tokenId, secret: result.token });
        return result.token;
      } finally {
        setPending(false);
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, [tokenId, secret]);

  return { secret, pending, load };
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    toast.error("Couldn't copy. Reveal it and copy it by hand.");
    return false;
  }
}

/**
 * Text with a token in it, shown masked, with reveal and copy. Copy always
 * copies the real token. `format` wraps it, for a header or a command.
 */
export function RevealableToken({ prefix, tokenSecret, format = (token) => token, block, className }: {
  prefix: string;
  tokenSecret: ReturnType<typeof useTokenSecret>;
  format?: (token: string) => string;
  /** Shows it as a dark code panel (commands), rather than inline. */
  block?: boolean;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const { secret, pending, load } = tokenSecret;
  const shown = format(revealed && secret ? secret : maskToken(prefix));

  async function toggle() {
    if (revealed) return setRevealed(false);
    if (await load()) setRevealed(true);
  }

  async function copy() {
    const value = await load();
    if (!value) return;
    if (!(await copyText(format(value)))) return setRevealed(true);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const buttons = (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={revealed ? "Hide token" : "Show token"} disabled={pending} onClick={() => void toggle()}>
        {pending ? <Loader2 className="animate-spin" /> : revealed ? <EyeOff /> : <Eye />}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Copy" disabled={pending} onClick={() => void copy()}>
        {copied ? <Check /> : <Copy />}
      </Button>
    </>
  );

  if (block) {
    return (
      <div className={cn("relative rounded-lg bg-code-background", className)}>
        <pre className="p-4 pr-20 font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap break-all text-[#E6EEF8]"><code>{shown}</code></pre>
        <span className="absolute top-2 right-2 flex text-[#E6EEF8]">{buttons}</span>
      </div>
    );
  }
  return (
    <span className={cn("inline-flex max-w-full items-center gap-0.5 align-middle", className)}>
      <code className="min-w-0 truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.8rem] text-foreground" aria-label="API token">{shown}</code>
      {buttons}
    </span>
  );
}
