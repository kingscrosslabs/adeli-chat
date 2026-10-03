"use client";

import { Check, ExternalLink, Loader2, Play, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { MEDIA_TYPE_LABEL, MediaTypeIcon, PostThumb } from "@/components/automations/post-thumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adeli } from "@/lib/adeli/mock";
import type { AdeliMedia } from "@/lib/adeli/types";
import type { MediaSnapshot } from "@/lib/automations/schemas";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Grid of the account's posts (FR-5.3 to FR-5.6). Once a post is chosen it
 * collapses to a summary, so the form stays short.
 */
export function PostPicker({ accountId, mediaId, snapshot, onSelect, error }: {
  accountId: string;
  mediaId: string | null;
  snapshot: MediaSnapshot | null;
  onSelect: (media: AdeliMedia) => void;
  error?: string;
}) {
  const [browsing, setBrowsing] = useState(!mediaId);
  const [media, setMedia] = useState<AdeliMedia[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(!mediaId);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await adeli.listMedia(accountId, nextPage);
      setMedia((current) => nextPage === 0 ? result.media : [...current, ...result.media]);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  // First page on mount, when no post is chosen yet. Later pages load from clicks.
  useEffect(() => {
    if (mediaId) return;
    let cancelled = false;
    adeli.listMedia(accountId, 0).then(
      (result) => {
        if (cancelled) return;
        setMedia(result.media);
        setHasMore(result.hasMore);
        setLoading(false);
      },
      () => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      },
    );
    return () => { cancelled = true; };
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function browse() {
    setBrowsing(true);
    if (media.length === 0) void load(0);
  }

  if (!browsing && mediaId && snapshot) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary bg-secondary/40 p-3" data-field="trigger.mediaId">
        <PostThumb src={snapshot.thumbUrl} type={snapshot.mediaType} className="h-20 w-16 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MediaTypeIcon type={snapshot.mediaType} className="size-3.5" /> {MEDIA_TYPE_LABEL[snapshot.mediaType]}
            {snapshot.publishedAt ? <> · {shortDate(snapshot.publishedAt)}</> : null}
          </p>
          <p className="line-clamp-2 text-sm">{snapshot.caption || "No caption"}</p>
          {snapshot.permalink ? (
            <a href={snapshot.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline">View on Instagram <ExternalLink className="size-3" /></a>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={browse}>Change</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-field="trigger.mediaId">
      {failed ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          <span>We couldn&apos;t load your posts from Adeli.</span>
          <Button size="sm" variant="outline" onClick={() => void load(page)}><RefreshCw /> Retry</Button>
        </div>
      ) : null}
      <div className={cn("grid grid-cols-3 gap-2 rounded-lg sm:grid-cols-4", error && "p-1 ring-2 ring-destructive/40")} role="radiogroup" aria-label="Your posts and reels">
        {media.map((item) => (
          <PostTile key={item.id} media={item} selected={item.id === mediaId} onSelect={() => { onSelect(item); setBrowsing(false); }} />
        ))}
        {loading ? Array.from({ length: media.length ? 4 : 8 }, (_, index) => <Skeleton key={index} className="aspect-[4/5] rounded-md" />) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        {mediaId ? <Button variant="ghost" size="sm" onClick={() => setBrowsing(false)}>Cancel</Button> : <span />}
        {hasMore ? (
          <Button variant="secondary" size="sm" onClick={() => void load(page + 1)} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : null} Load more
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PostTile({ media, selected, onSelect }: { media: AdeliMedia; selected: boolean; onSelect: () => void }) {
  const isVideo = media.mediaType === "REEL" || media.mediaType === "VIDEO";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${MEDIA_TYPE_LABEL[media.mediaType]} from ${shortDate(media.publishedAt)}: ${media.caption}`}
      onClick={onSelect}
      className={cn(
        "group relative aspect-[4/5] overflow-hidden rounded-md bg-muted text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "ring-2 ring-primary ring-offset-2",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Instagram CDN and data URIs, not optimizable. */}
      <img src={media.thumbnailUrl} alt="" className={cn("size-full object-cover transition duration-500", isVideo && "group-hover:scale-110")} />
      <span className="absolute top-1 right-1 rounded bg-black/45 p-0.5 text-white"><MediaTypeIcon type={media.mediaType} className="size-3" /></span>
      {isVideo ? (
        <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
          <span className="grid size-8 place-items-center rounded-full bg-black/45 text-white"><Play className="size-4 fill-current" /></span>
        </span>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1">
        <span className="line-clamp-1 text-[0.68rem] leading-tight text-white">{media.caption}</span>
        <span className="text-[0.62rem] text-white/75">{shortDate(media.publishedAt)}</span>
      </span>
      {selected ? <span className="absolute top-1 left-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span> : null}
    </button>
  );
}
