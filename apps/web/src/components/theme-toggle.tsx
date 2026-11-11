"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

const noopSubscribe = () => () => undefined;

/**
 * Light / Dark / System, as a segmented control. The selected state waits for
 * the client, since the server can't know the stored choice (see DESIGN.md,
 * "Theming").
 */
export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  return (
    <div role="radiogroup" aria-label="Color theme" className={cn("inline-flex rounded-lg border bg-background p-0.5", className)}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              selected && "bg-accent text-accent-foreground shadow-xs",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {compact ? null : label}
          </button>
        );
      })}
    </div>
  );
}
