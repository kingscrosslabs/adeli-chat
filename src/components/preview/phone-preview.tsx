"use client";

import { Bookmark, ChevronLeft, ExternalLink, Heart, ImageOff, MessageCircle, MoreHorizontal, Send } from "lucide-react";

import type { PreviewTab } from "@/components/editor/fields";
import type { AdeliAccount } from "@/lib/adeli/types";
import { PREVIEW_FALLBACK_KEYWORD } from "@/lib/automations/defaults";
import { emailCaptureOf, type AutomationContent } from "@/lib/automations/schemas";
import { cn } from "@/lib/utils";

/**
 * iPhone-style preview using Instagram's general visual language, with no
 * Meta logos or assets (FR-6.1). Shown from the commenter's point of view:
 * your messages arrive on the left, their tap shows on the right.
 */
const SAMPLE_COMMENTER = { handle: "sam.creates", initials: "SC" };

const TABS: Array<{ id: PreviewTab; label: string }> = [
  { id: "post", label: "Post" },
  { id: "comments", label: "Comments" },
  { id: "dm", label: "DM" },
];

/** A story reply has no comments: the Post tab shows the story they reply to. */
const STORY_TABS: Array<{ id: PreviewTab; label: string }> = [
  { id: "post", label: "Story" },
  { id: "dm", label: "DM" },
];

/** What the sample person writes, as a comment or a story reply. */
function sampleText(content: AutomationContent) {
  if (content.trigger.match === "any") return content.type === "story_reply" ? "Obsessed with this 🔥" : "Love this!";
  return `${content.trigger.keywords[0] ?? PREVIEW_FALLBACK_KEYWORD} please! 🙏`;
}

export function PhonePreview({ content, account, tab: requested, onTabChange, disclaimer = true }: { content: AutomationContent; account: AdeliAccount | null; tab: PreviewTab; onTabChange: (tab: PreviewTab) => void; disclaimer?: boolean }) {
  const story = content.type === "story_reply";
  const tabs = story ? STORY_TABS : TABS;
  const tab = tabs.some((item) => item.id === requested) ? requested : "post";
  return (
    <div className="flex flex-col items-center gap-4">
      <div role="tablist" aria-label="Preview" className="inline-flex rounded-lg bg-muted p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            onClick={() => onTabChange(item.id)}
            className={cn("rounded-md px-3 py-1 text-sm font-medium transition", tab === item.id ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/10" : "text-muted-foreground hover:text-foreground")}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="phone-preview w-[300px] shrink-0 rounded-[2.75rem] bg-[var(--pv-frame)] p-2.5 shadow-xl">
        <div className="relative flex h-[600px] flex-col overflow-hidden rounded-[2.2rem] bg-[var(--pv-bg)] text-[var(--pv-text)]">
          <StatusBar />
          <div role="tabpanel" aria-label={`${tabs.find((item) => item.id === tab)?.label} preview`} className="flex min-h-0 flex-1 flex-col">
            {tab === "post" ? story ? <StoryView content={content} account={account} /> : <PostView content={content} account={account} /> : null}
            {tab === "comments" ? <CommentsView content={content} account={account} /> : null}
            {tab === "dm" ? <DmView content={content} account={account} /> : null}
          </div>
          <div className="mx-auto mb-2 h-1 w-28 shrink-0 rounded-full bg-black/80" aria-hidden />
        </div>
      </div>
      {disclaimer ? <p className="max-w-[300px] text-center text-xs text-muted-foreground">Preview only. Instagram&apos;s real layout may differ slightly.</p> : null}
    </div>
  );
}

function StatusBar() {
  return (
    <div className="relative flex h-10 shrink-0 items-center justify-between px-7 text-[0.7rem] font-semibold" aria-hidden>
      <span>9:41</span>
      <span className="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
      <span className="flex items-center gap-1">
        <span className="h-2 w-3 rounded-[2px] bg-current" />
        <span className="h-2.5 w-5 rounded-[3px] border border-current p-px"><span className="block h-full w-3/4 rounded-[1px] bg-current" /></span>
      </span>
    </div>
  );
}

function Handle({ account }: { account: AdeliAccount | null }) {
  return <>{account?.displayIdentifier ?? "yourhandle"}</>;
}

function MiniAvatar({ account, size = "size-7" }: { account: AdeliAccount | null; size?: string }) {
  if (account?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- data URI / Instagram CDN avatar.
    return <img src={account.avatarUrl} alt="" className={cn(size, "shrink-0 rounded-full object-cover")} />;
  }
  return <span className={cn(size, "shrink-0 rounded-full bg-[var(--pv-divider)]")} />;
}

function CommenterAvatar({ size = "size-7" }: { size?: string }) {
  return <span className={cn(size, "grid shrink-0 place-items-center rounded-full bg-[#E0E7FF] text-[0.6rem] font-semibold text-[#3730A3]")}>{SAMPLE_COMMENTER.initials}</span>;
}

const PLACEHOLDER = {
  specific: "Pick a post to see it here",
  next: "Your next post or reel",
  any: "Any of your posts or reels",
} as const;

/** `compact` is the small thumbnail beside the comments: an icon only, since the label can't fit. */
function PostImage({ content, className, compact = false }: { content: AutomationContent; className?: string; compact?: boolean }) {
  const thumb = content.trigger.mediaSnapshot?.thumbUrl;
  if (!thumb) {
    return (
      <div className={cn("grid shrink-0 place-items-center bg-[var(--pv-divider)] text-[var(--pv-subtle)]", className)}>
        {compact ? <ImageOff className="size-4" /> : <span className="flex flex-col items-center gap-2 px-6 text-center text-xs"><ImageOff className="size-6" /> {PLACEHOLDER[content.trigger.postScope]}</span>}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- snapshot thumbnail.
  return <img src={thumb} alt="" className={cn("object-cover", className)} />;
}

function PostView({ content, account }: { content: AutomationContent; account: AdeliAccount | null }) {
  const caption = content.trigger.mediaSnapshot?.caption;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex items-center gap-2 px-3 py-2">
        <MiniAvatar account={account} />
        <span className="flex-1 truncate text-[0.78rem] font-semibold"><Handle account={account} /></span>
        <MoreHorizontal className="size-4" />
      </div>
      <PostImage content={content} className="aspect-[4/5] w-full" />
      <div className="flex items-center gap-3.5 px-3 pt-2.5 pb-1.5">
        <Heart className="size-5" /><MessageCircle className="size-5 -scale-x-100" /><Send className="size-5" />
        <Bookmark className="ml-auto size-5" />
      </div>
      <p className="px-3 text-[0.75rem] font-semibold">2,481 likes</p>
      <p className="line-clamp-3 px-3 pt-1 text-[0.75rem] leading-snug">
        <span className="font-semibold"><Handle account={account} /></span> {caption ?? "Your caption shows here."}
      </p>
      <p className="px-3 pt-1 pb-3 text-[0.72rem] text-[var(--pv-subtle)]">View all 184 comments</p>
    </div>
  );
}

function StoryView({ content, account }: { content: AutomationContent; account: AdeliAccount | null }) {
  const thumb = content.trigger.postScope === "specific" ? content.trigger.mediaSnapshot?.thumbUrl : null;
  return (
    <div className="relative mx-1.5 mb-1.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-[#52525B] to-[#18181B] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- snapshot thumbnail. */}
      {thumb ? <img src={thumb} alt="" className="absolute inset-0 size-full object-cover" /> : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50" aria-hidden />
      <div className="relative flex gap-1 px-3 pt-2.5" aria-hidden>
        <span className="h-0.5 flex-1 rounded-full bg-white" /><span className="h-0.5 flex-1 rounded-full bg-white/40" />
      </div>
      <div className="relative flex items-center gap-2 px-3 py-2 text-[0.75rem]">
        <MiniAvatar account={account} size="size-6" />
        <span className="truncate font-semibold"><Handle account={account} /></span>
        <span className="text-white/70">2h</span>
        <MoreHorizontal className="ml-auto size-4" />
      </div>
      <div className="relative grid flex-1 place-items-center px-8 text-center text-xs text-white/80">
        {thumb ? null : <span className="flex flex-col items-center gap-2"><ImageOff className="size-6" /> {content.trigger.postScope === "specific" ? "Pick a story to see it here" : "Any of your stories"}</span>}
      </div>
      <div className="relative flex items-center gap-2 px-3 pb-3 text-[0.75rem]">
        <span className="flex-1 truncate rounded-full border border-white/70 px-3 py-2">{sampleText(content)}</span>
        <Heart className="size-5 shrink-0" /><Send className="size-5 shrink-0" />
      </div>
    </div>
  );
}

function CommentsView({ content, account }: { content: AutomationContent; account: AdeliAccount | null }) {
  const comment = sampleText(content);
  const reply = content.commentReply.enabled ? content.commentReply.variants.find((variant) => variant.trim()) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--pv-divider)] px-3 pb-2">
        <PostImage content={content} className="size-9 shrink-0 rounded" compact />
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-semibold">Comments</p>
          <p className="truncate text-[0.68rem] text-[var(--pv-subtle)]">{content.trigger.mediaSnapshot?.caption ?? "Your post"}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 text-[0.75rem]">
        <OtherComment handle="maya.builds" text="This is so helpful 😍" time="2h" />
        <div className="space-y-3">
          <div className="flex gap-2">
            <CommenterAvatar />
            <div className="min-w-0 flex-1">
              <p><span className="font-semibold">{SAMPLE_COMMENTER.handle}</span> <span className="text-[var(--pv-subtle)]">1m</span></p>
              <p className="break-words">{comment}</p>
              <p className="mt-0.5 text-[0.68rem] font-semibold text-[var(--pv-subtle)]">Reply</p>
            </div>
            <Heart className="mt-1 size-3 text-[var(--pv-subtle)]" />
          </div>
          {reply ? (
            <div className="ml-9 flex gap-2">
              <MiniAvatar account={account} size="size-6" />
              <div className="min-w-0 flex-1">
                <p><span className="font-semibold"><Handle account={account} /></span> <span className="text-[var(--pv-subtle)]">now</span></p>
                <p className="break-words"><span className="text-[#3B5BDB]">@{SAMPLE_COMMENTER.handle}</span> {reply}</p>
              </div>
            </div>
          ) : (
            <p className="ml-9 rounded-md bg-[var(--pv-divider)] px-2 py-1.5 text-[0.68rem] text-[var(--pv-subtle)]">No public reply. They only get the DM.</p>
          )}
        </div>
        <OtherComment handle="jordan.ops" text="Saving this for later" time="3h" />
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--pv-divider)] px-3 py-2">
        <MiniAvatar account={account} size="size-6" />
        <span className="flex-1 rounded-full border border-[var(--pv-divider)] px-3 py-1.5 text-[0.7rem] text-[var(--pv-subtle)]">Add a comment…</span>
      </div>
    </div>
  );
}

function OtherComment({ handle, text, time }: { handle: string; text: string; time: string }) {
  return (
    <div className="flex gap-2 opacity-70">
      <span className="size-7 shrink-0 rounded-full bg-[var(--pv-divider)]" />
      <div className="min-w-0 flex-1">
        <p><span className="font-semibold">{handle}</span> <span className="text-[var(--pv-subtle)]">{time}</span></p>
        <p>{text}</p>
      </div>
    </div>
  );
}

function DmView({ content, account }: { content: AutomationContent; account: AdeliAccount | null }) {
  const finalButton = content.finalDm.buttons[0];
  const email = emailCaptureOf(content);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--pv-divider)] px-3 pb-2">
        <ChevronLeft className="size-5" />
        <MiniAvatar account={account} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.75rem] font-semibold">{account?.displayName ?? "Your name"}</p>
          <p className="truncate text-[0.66rem] text-[var(--pv-subtle)]"><Handle account={account} /></p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 text-[0.75rem]">
        {content.type === "story_reply" ? (
          <>
            <p className="pb-1 text-center text-[0.62rem] text-[var(--pv-subtle)]">You replied to their story</p>
            <OutgoingBubble text={sampleText(content)} />
          </>
        ) : (
          <p className="pb-1 text-center text-[0.62rem] text-[var(--pv-subtle)]">Replied to your comment</p>
        )}
        <IncomingBubble account={account} text={content.openingDm.text || "Your opening message"} button={content.openingDm.buttonLabel || "Button"} />
        <OutgoingBubble text={content.openingDm.buttonLabel || "Button"} />
        {email.enabled ? (
          <>
            <IncomingBubble account={account} text={email.text || "Your email question"} />
            <OutgoingBubble text="alex@example.com" />
          </>
        ) : null}
        <IncomingBubble account={account} text={content.finalDm.text || "Your final message"} button={finalButton?.label || "Button"} link={finalButton?.url} />
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--pv-divider)] px-3 py-2">
        <span className="flex-1 rounded-full bg-[var(--pv-divider)] px-3 py-1.5 text-[0.7rem] text-[var(--pv-subtle)]">Message…</span>
      </div>
    </div>
  );
}

function OutgoingBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <span className="max-w-[75%] rounded-2xl rounded-br-md bg-[var(--pv-bubble-out)] px-3 py-2 break-words text-[var(--pv-bubble-out-text)]">{text}</span>
    </div>
  );
}

function IncomingBubble({ account, text, button, link }: { account: AdeliAccount | null; text: string; button?: string; link?: string }) {
  let host: string | null = null;
  if (link) {
    try {
      host = new URL(link).hostname;
    } catch {
      host = null;
    }
  }
  return (
    <div className="flex items-end gap-1.5">
      <MiniAvatar account={account} size="size-5" />
      <div className="max-w-[78%] overflow-hidden rounded-2xl rounded-bl-md border border-[var(--pv-bubble-in)] bg-[var(--pv-bubble-in)]">
        <p className="px-3 py-2 break-words whitespace-pre-wrap">{text}</p>
        {button ? (
          <div className="border-t border-black/5 bg-[var(--pv-button)] px-3 py-2 text-center font-semibold text-[#3B5BDB]">
            <span className="inline-flex items-center gap-1 break-all">{button}{link ? <ExternalLink className="size-3 shrink-0" /> : null}</span>
            {host ? <span className="block text-[0.6rem] font-normal text-[var(--pv-subtle)]">{host}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
