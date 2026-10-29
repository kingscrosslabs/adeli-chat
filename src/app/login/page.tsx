"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Password screen (FR-0.x). The server checks it against ADMIN_PASSWORD. */
export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!password) {
      setError("Enter the admin password for this install.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        setError(result.error?.message ?? "Login failed. Try again.");
        return;
      }
      // `/` and the proxy send you on to the first unfinished onboarding step.
      router.replace("/");
    } catch {
      setError("We couldn't reach this Adeli Chat server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-fog/60 p-4">
      <section className="w-full max-w-sm rounded-xl bg-card p-8 ring-1 ring-foreground/10">
        <Wordmark />
        <h1 className="mt-6 text-xl font-semibold">Log in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Comment to DM automations for your Instagram.</p>
        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="password">Admin password</Label>
            <div className="relative">
              <Input
                id="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "password-error" : "password-help"}
                className="h-9 pr-9"
              />
              <button type="button" onClick={() => setVisible((value) => !value)} className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground hover:text-foreground" aria-label={visible ? "Hide password" : "Show password"}>
                {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {error ? (
              <p id="password-error" className="text-xs text-destructive">{error}</p>
            ) : (
              <p id="password-help" className="text-xs text-muted-foreground">Set as <code className="font-mono">ADMIN_PASSWORD</code> on your server.</p>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null} Log in
          </Button>
        </form>
      </section>
    </main>
  );
}
