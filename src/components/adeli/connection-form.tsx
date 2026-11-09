"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAdeliConnection } from "@/lib/actions";

const DEFAULT_BASE_URL = "https://app.tryadeli.com";

/**
 * The Adeli API key and URL, entered in the app. The key is checked against
 * Adeli before it's saved, and stored encrypted on the server. It's never
 * sent back to the browser, so a saved key shows only as a placeholder.
 */
export function AdeliConnectionForm({ hasKey, baseURL, submitLabel = "Save", onSaved }: { hasKey: boolean; baseURL: string; submitLabel?: string; onSaved?: () => void }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [url, setUrl] = useState(baseURL);
  const [showUrl, setShowUrl] = useState(baseURL !== DEFAULT_BASE_URL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await saveAdeliConnection({ apiKey, baseURL: url });
    setSaving(false);
    if (!result.ok) {
      setError(result.reason === "error" ? result.message : "Adeli didn't accept this key.");
      return;
    }
    setApiKey("");
    toast.success("Connected to Adeli");
    onSaved?.();
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="adeli-api-key">API key</Label>
        <Input
          id="adeli-api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={hasKey ? "Saved. Paste a new key to replace it." : "rk_live_..."}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          className="font-mono"
        />
      </div>
      {showUrl ? (
        <div className="space-y-1.5">
          <Label htmlFor="adeli-base-url">Adeli URL</Label>
          <Input id="adeli-base-url" type="url" spellCheck={false} placeholder={DEFAULT_BASE_URL} value={url} onChange={(event) => setUrl(event.target.value)} className="font-mono" />
          <p className="text-xs text-muted-foreground">Leave it as {DEFAULT_BASE_URL} unless you run your own Adeli.</p>
        </div>
      ) : (
        <button type="button" onClick={() => setShowUrl(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className="size-3.5" /> Use a different Adeli URL
        </button>
      )}
      {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
      <Button type="submit" disabled={saving || (!apiKey.trim() && !hasKey)}>
        {saving ? <Loader2 className="animate-spin" /> : null} {submitLabel}
      </Button>
    </form>
  );
}
