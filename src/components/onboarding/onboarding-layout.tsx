import { Check } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "key", label: "Adeli key" },
  { id: "account", label: "Instagram account" },
  { id: "automation", label: "First automation" },
] as const;

export type OnboardingStep = (typeof STEPS)[number]["id"];

/** The 3-step checklist shown on /setup and /connect (PRD §4). */
export function OnboardingChecklist({ current }: { current: OnboardingStep }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Setup progress">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            {index > 0 ? <span aria-hidden className={cn("h-px w-4 sm:w-8", done || active ? "bg-primary" : "bg-border")} /> : null}
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                done && "bg-primary text-primary-foreground",
                active && "bg-secondary text-secondary-foreground ring-2 ring-primary",
                !done && !active && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className={cn("hidden whitespace-nowrap sm:inline", active ? "font-medium text-foreground" : "text-muted-foreground")}>{step.label}</span>
            <span className="sr-only">{done ? "(done)" : active ? "(current)" : "(next)"}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function OnboardingLayout({ step, children }: { step: OnboardingStep; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-brand-fog/60 px-4 py-8 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
          <Wordmark />
          <OnboardingChecklist current={step} />
        </div>
        {children}
      </div>
    </main>
  );
}
