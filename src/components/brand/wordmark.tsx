import Image from "next/image";

import { cn } from "@/lib/utils";

/** Adeli logo mark + "Adeli Chat" in Jersey 10. Used on /login and onboarding only (brand.md §4). */
export function Wordmark({ size = "lg", className }: { size?: "sm" | "lg"; className?: string }) {
  const mark = size === "lg" ? 40 : 28;
  return (
    <div className={cn("flex shrink-0 items-center gap-2.5", className)}>
      <Image className={cn(size === "lg" ? "size-10 rounded-xl" : "size-7 rounded-lg")} src="/brand/adeli-logo.png" alt="" width={mark} height={mark} priority unoptimized />
      {/* Plain string, not cn(): tailwind-merge misreads the custom font and color utilities and drops classes. */}
      <span className={`font-wordmark whitespace-nowrap text-brand-ink ${size === "lg" ? "text-4xl leading-none" : "text-2xl leading-none"}`}>Adeli Chat</span>
    </div>
  );
}
