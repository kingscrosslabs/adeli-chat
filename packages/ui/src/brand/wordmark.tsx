import Image from "next/image";

import { cn } from "../lib/utils";

/** Adeli logo mark + "Adeli Chat", set like the Adeli dashboard's sidebar header (brand.md §4). */
export function Wordmark({ size = "lg", className }: { size?: "sm" | "lg"; className?: string }) {
  const mark = size === "lg" ? 40 : 32;
  return (
    <div className={cn("flex shrink-0 items-center gap-2.5", className)}>
      <Image className={cn(size === "lg" ? "size-10 rounded-md" : "size-8 rounded-md")} src="/brand/adeli-logo.png" alt="" width={mark} height={mark} priority unoptimized />
      <span className={cn("font-semibold tracking-tight whitespace-nowrap text-foreground", size === "lg" ? "text-2xl" : "text-base")}>Adeli Chat</span>
    </div>
  );
}
