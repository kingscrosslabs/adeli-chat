import { Badge } from "@/components/ui/badge";
import type { AutomationStatus } from "@/lib/automations/schemas";
import { cn } from "@/lib/utils";

/** Status pills per brand.md §6. */
export function StatusPill({ status, className }: { status: AutomationStatus; className?: string }) {
  if (status === "live") {
    return (
      <Badge variant="secondary" className={cn("gap-1.5", className)}>
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
        Live
      </Badge>
    );
  }
  if (status === "paused") return <Badge className={cn("bg-warning-wash text-warning", className)}>Paused</Badge>;
  return <Badge className={cn("bg-muted text-muted-foreground", className)}>Draft</Badge>;
}

/** Compact status for tight spaces like the sidebar list. */
export function StatusDot({ status }: { status: AutomationStatus }) {
  const label = status === "live" ? "Live" : status === "paused" ? "Paused" : "Draft";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("size-1.5 shrink-0 rounded-full", status === "live" ? "bg-primary" : status === "paused" ? "bg-warning" : "bg-muted-foreground/40")}
    />
  );
}
