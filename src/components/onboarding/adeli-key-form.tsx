"use client";

import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adeli, demoKey } from "@/lib/adeli/mock";
import { AdeliError, ADELI_KEY_PATTERN, adeliKeyPrefix, type AdeliProfile } from "@/lib/adeli/types";
import { actions, readDemoState } from "@/lib/demo/store";

type Phase =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "error"; message: string }
  | { kind: "confirm-profile"; profile: AdeliProfile; key: string }
  | { kind: "saved"; profile: AdeliProfile };

/**
 * Paste, validate and save an Adeli key (FR-S.2 to FR-S.4, FR-S.8). On the
 * real backend this posts to `/api/setup/key`, which calls `GET /profiles`
 * and stores the key encrypted. The plaintext never comes back.
 */
export function AdeliKeyForm({ submitLabel = "Save and continue", onSaved }: { submitLabel?: string; onSaved: (profile: AdeliProfile) => void }) {
  const [key, setKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  function save(trimmed: string, profile: AdeliProfile) {
    actions.saveKey({ prefix: adeliKeyPrefix(trimmed), profileId: profile.id, profileName: profile.name, source: "ui" });
    setPhase({ kind: "saved", profile });
    setKey("");
    setTimeout(() => onSaved(profile), 900);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setPhase({ kind: "error", message: "Paste your Adeli API key first." });
      return;
    }
    if (!trimmed.startsWith("rk_live_")) {
      setPhase({ kind: "error", message: "Adeli keys start with rk_live_. Check you copied the whole key." });
      return;
    }
    if (!ADELI_KEY_PATTERN.test(trimmed)) {
      setPhase({ kind: "error", message: "That key looks incomplete. Adeli keys are rk_live_ followed by 43 characters." });
      return;
    }
    setPhase({ kind: "validating" });
    try {
      const profile = await adeli.validateKey(trimmed);
      const current = readDemoState().adeliKey;
      if (current && current.profileId !== profile.id) {
        setPhase({ kind: "confirm-profile", profile, key: trimmed });
        return;
      }
      save(trimmed, profile);
    } catch (error) {
      setPhase({ kind: "error", message: error instanceof AdeliError ? error.message : "Something went wrong. Try again." });
    }
  }

  const error = phase.kind === "error" ? phase.message : null;
  const busy = phase.kind === "validating" || phase.kind === "saved";

  if (phase.kind === "saved") {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-success-wash px-4 py-3 text-sm text-success" role="status">
        <CheckCircle2 className="size-5 shrink-0" />
        <span>Connected to Adeli profile <span className="font-semibold">{phase.profile.name}</span></span>
      </div>
    );
  }

  if (phase.kind === "confirm-profile") {
    const current = readDemoState().adeliKey;
    return (
      <div className="space-y-3 rounded-lg bg-warning-wash p-4 text-sm text-warning" role="alert">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            This key belongs to a different Adeli profile (<span className="font-semibold">{phase.profile.name}</span>, not {current?.profileName}).
            Your connected Instagram account will be removed and Live automations will be paused.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save(phase.key, phase.profile)}>Use this key anyway</Button>
          <Button size="sm" variant="outline" onClick={() => setPhase({ kind: "idle" })}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="adeli-key">Adeli API key</Label>
          <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => { setKey(demoKey()); setPhase({ kind: "idle" }); }}>
            Fill a demo key
          </button>
        </div>
        <div className="relative">
          <Input
            id="adeli-key"
            type={visible ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder="rk_live_…"
            value={key}
            onChange={(event) => { setKey(event.target.value); if (phase.kind === "error") setPhase({ kind: "idle" }); }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "adeli-key-error" : undefined}
            className="h-9 pr-9 font-mono md:text-[0.82rem]"
            disabled={busy}
          />
          <button type="button" onClick={() => setVisible((value) => !value)} className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground hover:text-foreground" aria-label={visible ? "Hide key" : "Show key"}>
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {error ? <p id="adeli-key-error" className="text-xs text-destructive" role="alert">{error}</p> : null}
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={busy}>
        {phase.kind === "validating" ? <><Loader2 className="animate-spin" /> Checking with Adeli…</> : submitLabel}
      </Button>
    </form>
  );
}
