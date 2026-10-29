import type { AdeliMedia } from "@/lib/adeli/types";

import type { MediaSnapshot } from "./schemas";

/** What an automation keeps about its post, so lists render without calling Adeli. */
export function snapshotOf(media: AdeliMedia): MediaSnapshot {
  return { thumbUrl: media.thumbnailUrl, mediaType: media.mediaType, caption: media.caption, permalink: media.permalink, publishedAt: media.publishedAt };
}
