import { Badge } from "@adeli-chat/ui/components/badge";
import { cn } from "@adeli-chat/ui/lib/utils";
import { STAGE_LABELS, type RunStage } from "@/lib/audience-stages";

/** How far someone got in one automation, coloured like the status pills. */
export function StagePill({ stage, className }: { stage: RunStage; className?: string }) {
  const tone = stage === "final_sent"
    ? "bg-success-wash text-success"
    : stage === "failed"
      ? "bg-destructive/10 text-destructive"
      : stage === "awaiting_follow" || stage === "awaiting_email"
        ? "bg-warning-wash text-warning"
        : "bg-muted text-muted-foreground";
  return <Badge className={cn(tone, className)}>{STAGE_LABELS[stage]}</Badge>;
}
