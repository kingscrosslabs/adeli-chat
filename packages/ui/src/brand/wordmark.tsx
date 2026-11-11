import { cn } from "../lib/utils";
import { LedaChatLogo } from "./ledachat-logo";

/** LedaChat mark + name in Inter semibold (docs/brand.md section 4). */
export function Wordmark({ size = "lg", className }: { size?: "sm" | "lg"; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-2.5", className)}>
      <LedaChatLogo className={size === "lg" ? "size-10" : "size-8"} />
      <span className={cn("font-semibold tracking-tight whitespace-nowrap text-foreground", size === "lg" ? "text-2xl" : "text-base")}>LedaChat</span>
    </div>
  );
}
