"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { nextOnboardingPath } from "@/components/guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, readDemoState, useDemoState } from "@/lib/demo/store";

/**
 * Password screen (FR-0.x). In the frontend-only build any password except
 * "wrong" signs you in, so the error state can still be reviewed.
 */
export default function LoginPage() {
  const router = useRouter();
  const state = useDemoState();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (state?.session) router.replace(nextOnboardingPath(state));
  }, [state, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!password) {
      setError("Enter the admin password for this install.");
      return;
    }
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (password === "wrong") {
      setPending(false);
      setError("That password didn't match. Check ADMIN_PASSWORD in your server environment.");
      return;
    }
    actions.login();
    router.replace(nextOnboardingPath(readDemoState()));
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
        <p className="mt-6 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Demo build: any password works. Type <code className="font-mono">wrong</code> to see the error.</p>
      </section>
    </main>
  );
}
