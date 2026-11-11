import { Clapperboard, Copy, Film, ImageIcon, ImageOff } from "lucide-react";

import type { MediaType } from "@/lib/automations/schemas";
import { cn } from "@/lib/utils";

export const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
  IMAGE: "Photo",
  VIDEO: "Video",
  REEL: "Reel",
  CAROUSEL_ALBUM: "Carousel",
};

export function MediaTypeIcon({ type, className }: { type: MediaType; className?: string }) {
  const Icon = type === "REEL" ? Clapperboard : type === "VIDEO" ? Film : type === "CAROUSEL_ALBUM" ? Copy : ImageIcon;
  return <Icon aria-label={MEDIA_TYPE_LABEL[type]} className={className} />;
}

/** A post thumbnail, or a quiet placeholder when there is none yet. */
export function PostThumb({ src, type, className }: { src: string | null | undefined; type?: MediaType; className?: string }) {
  if (!src) {
    return (
      <div className={cn("grid place-items-center bg-muted text-muted-foreground", className)}>
        <ImageOff className="size-4" />
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Instagram CDN and data URIs, not optimizable. */}
      <img src={src} alt="" className="size-full object-cover" />
      {type ? (
        <span className="absolute top-1 right-1 rounded bg-black/45 p-0.5 text-white">
          <MediaTypeIcon type={type} className="size-3" />
        </span>
      ) : null}
    </div>
  );
}
