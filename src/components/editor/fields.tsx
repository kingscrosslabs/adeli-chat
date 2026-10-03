"use client";

import { Info } from "lucide-react";
import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FieldPath } from "@/lib/automations/validate";
import { cn } from "@/lib/utils";

export type PreviewTab = "post" | "comments" | "dm";

/**
 * One editor section (B to F). Focusing anything inside switches the phone
 * preview to the matching tab (FR-6.3).
 */
export function Section({ step, title, description, tab, onFocusTab, children, action }: {
  step: number;
  title: string;
  description?: React.ReactNode;
  tab: PreviewTab;
  onFocusTab: (tab: PreviewTab) => void;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      onFocusCapture={() => onFocusTab(tab)}
      onPointerDownCapture={() => onFocusTab(tab)}
      className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{step}</span>
          <div>
            <h2 id={headingId} className="text-base font-semibold leading-6">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function InfoTip({ children, label = "More info" }: { children: React.ReactNode; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<button type="button" className="inline-grid size-4 place-items-center rounded-full text-muted-foreground hover:text-foreground" aria-label={label} />}>
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{children}</TooltipContent>
    </Tooltip>
  );
}

export function Counter({ value, max }: { value: number; max: number }) {
  const near = value > max * 0.9;
  return <span className={cn("text-xs tabular-nums", value > max ? "text-destructive" : near ? "text-warning" : "text-muted-foreground")} aria-live={near ? "polite" : undefined}>{value}/{max}</span>;
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="text-xs text-destructive">{message}</p>;
}

type TextFieldProps = {
  field: FieldPath;
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  max: number;
  error?: string;
  multiline?: boolean;
  placeholder?: string;
  hint?: React.ReactNode;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  showCounter?: boolean;
};

/** Label, input or textarea, character counter and error, wired for a11y. */
export function TextField({ field, label, value, onChange, max, error, multiline, placeholder, hint, type, inputMode, showCounter = true }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5" data-field={field}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="gap-1.5">{label}</Label>
        {showCounter ? <Counter value={value.length} max={max} /> : null}
      </div>
      {multiline ? (
        <Textarea id={id} value={value} placeholder={placeholder} maxLength={max} rows={3} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
      ) : (
        <Input id={id} type={type} inputMode={inputMode} value={value} placeholder={placeholder} maxLength={max} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy} className="h-9" />
      )}
      {hint && !error ? <p id={hintId} className="text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

/** A selectable option row used for radios that include "Coming soon" choices. */
export function ChoiceRow({ checked, disabled, onSelect, title, description, badge, name }: {
  checked: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  name: string;
}) {
  return (
    <label className={cn("flex items-start gap-3 rounded-lg border p-3 transition", checked ? "border-primary bg-secondary/40" : "hover:bg-muted/60", disabled && "pointer-events-none opacity-60")}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={() => onSelect?.()} className="mt-0.5 size-4 accent-[var(--primary)]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-sm font-medium">{title}{badge}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}
