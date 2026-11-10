"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";

import { PostPicker } from "@/components/editor/post-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdeliMedia } from "@/lib/adeli/types";
import { LIMITS, emailCaptureOf, type AutomationContent, type PostScope } from "@/lib/automations/schemas";
import type { FieldErrors } from "@/lib/automations/validate";
import { snapshotOf } from "@/lib/automations/snapshot";
import { cn } from "@/lib/utils";

import { ChoiceRow, Counter, FieldError, Section, TextField, type PreviewTab } from "./fields";
import { KeywordInput } from "./keyword-input";

export type SectionProps = {
  draft: AutomationContent;
  patch: (update: (draft: AutomationContent) => AutomationContent) => void;
  errors: FieldErrors;
  onFocusTab: (tab: PreviewTab) => void;
};

/** A Story Reply has no public reply section, so every later step moves up one. */
function stepOf(draft: AutomationContent, step: number) {
  return draft.type === "story_reply" && step > 3 ? step - 1 : step;
}

const soon = <Badge variant="outline" className="font-medium text-muted-foreground">Coming soon</Badge>;

const SCOPES: Array<{ id: PostScope; title: string; description: string }> = [
  { id: "specific", title: "Comments on a specific post or reel", description: "Pick one post below." },
  { id: "next", title: "Comments on your next post or reel", description: "Starts on the first post you publish after going live." },
  { id: "any", title: "Comments on any post or reel", description: "Every post. A post with its own automation uses that one instead." },
];

/** B. When someone (FR-5.2 to FR-5.6). */
export function PostSection({ draft, patch, errors, onFocusTab, accountId }: SectionProps & { accountId: string }) {
  const errorId = useId();
  if (draft.type === "story_reply") {
    return (
      <Section step={1} title="When someone" info="Replies to any of your stories start this automation, while the story is up. Each person gets the flow once." tab="post" onFocusTab={onFocusTab}>
        <div className="grid gap-2">
          <ChoiceRow name="story-scope" checked onSelect={() => {}} title="Replies to any of your stories" info="Every story you post. Replies are DMs, so there's no public reply." />
          <ChoiceRow name="story-scope" checked={false} disabled title="Replies to a specific story" badge={soon} />
        </div>
      </Section>
    );
  }
  const scope = draft.trigger.postScope;
  const setScope = (postScope: PostScope) => patch((current) => ({
    ...current,
    // Only a specific post keeps its pick. Next post fills it in once that post exists.
    trigger: postScope === "specific" ? { ...current.trigger, postScope } : { ...current.trigger, postScope, mediaId: null, mediaSnapshot: null },
  }));
  return (
    <Section step={1} title="When someone" info="Choose what starts this automation. Each person gets the flow once, whichever post they comment on." tab="post" onFocusTab={onFocusTab}>
      <div className="grid gap-2">
        {SCOPES.map((item) => (
          <ChoiceRow key={item.id} name="post-scope" checked={scope === item.id} onSelect={() => setScope(item.id)} title={item.title} info={item.description} />
        ))}
      </div>
      {scope === "specific" ? (
        <>
          <PostPicker
            accountId={accountId}
            mediaId={draft.trigger.mediaId}
            snapshot={draft.trigger.mediaSnapshot}
            error={errors["trigger.mediaId"]}
            onSelect={(media: AdeliMedia) => patch((current) => ({ ...current, trigger: { ...current.trigger, mediaId: media.id, mediaSnapshot: snapshotOf(media) } }))}
          />
          <FieldError id={errorId} message={errors["trigger.mediaId"]} />
        </>
      ) : null}
    </Section>
  );
}

/** C. And this comment has (FR-5.7 to FR-5.11). */
export function TriggerSection({ draft, patch, errors, onFocusTab }: SectionProps) {
  const errorId = useId();
  const match = draft.trigger.match;
  const setMatch = (value: "keywords" | "any") => patch((current) => ({ ...current, trigger: { ...current.trigger, match: value } }));
  const noun = draft.type === "story_reply" ? "reply" : "comment";
  return (
    <Section
      step={2}
      title={`And this ${noun} has`}
      info={<>A specific keyword: only {noun === "reply" ? "replies" : "comments"} containing one of your words, not case-sensitive. Press Enter or comma to add each one.<br /><br />Any {noun}: everyone who {noun === "reply" ? "replies" : "comments"} gets your DM. Either way, each person gets it once.</>}
      tab={noun === "reply" ? "post" : "comments"}
      onFocusTab={onFocusTab}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <ChoiceRow name="match" checked={match === "keywords"} onSelect={() => setMatch("keywords")} title="A specific keyword" />
        <ChoiceRow name="match" checked={match === "any"} onSelect={() => setMatch("any")} title={`Any ${noun}`} />
      </div>
      {match === "keywords" ? (
        <div className="space-y-1.5" data-field="trigger.keywords">
          <div className="flex items-center justify-between">
            <Label>Keywords</Label>
            <Counter value={draft.trigger.keywords.length} max={LIMITS.keywords} />
          </div>
          <KeywordInput
            keywords={draft.trigger.keywords}
            onChange={(keywords) => patch((current) => ({ ...current, trigger: { ...current.trigger, keywords } }))}
            error={errors["trigger.keywords"]}
            describedBy={errors["trigger.keywords"] ? errorId : undefined}
          />
          <FieldError id={errorId} message={errors["trigger.keywords"]} />
        </div>
      ) : null}
    </Section>
  );
}

/** D. Reply to their comment (FR-5.12 to FR-5.14). */
export function ReplySection({ draft, patch, errors, onFocusTab }: SectionProps) {
  const switchId = useId();
  const errorId = useId();
  if (draft.type === "story_reply") return null;
  const { enabled, variants } = draft.commentReply;
  const setVariants = (next: string[]) => patch((current) => ({ ...current, commentReply: { ...current.commentReply, variants: next } }));
  return (
    <Section
      step={3}
      title="Reply to their comment"
      info="A public reply under their comment, so they know to check their DMs. Write 3 or more. We'll send them in a random order so replies look natural."
      tab="comments"
      onFocusTab={onFocusTab}
      action={
        <span className="flex items-center gap-2">
          <Label htmlFor={switchId} className="text-xs text-muted-foreground">{enabled ? "On" : "Off"}</Label>
          <Switch id={switchId} checked={enabled} onCheckedChange={(checked) => patch((current) => ({ ...current, commentReply: { ...current.commentReply, enabled: checked } }))} aria-label="Reply to their comment" />
        </span>
      }
    >
      {enabled ? (
        <div className="space-y-2" data-field="commentReply.variants">
          <ul className="space-y-2">
            {variants.map((variant, index) => (
              <li key={index} className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Input
                    value={variant}
                    maxLength={LIMITS.replyVariant}
                    onChange={(event) => setVariants(variants.map((item, i) => i === index ? event.target.value : item))}
                    aria-label={`Reply ${index + 1}`}
                    aria-invalid={Boolean(errors["commentReply.variants"]) && !variant.trim()}
                    className="h-9 pr-16"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center"><Counter value={variant.length} max={LIMITS.replyVariant} /></span>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Delete reply ${index + 1}`} onClick={() => setVariants(variants.filter((_, i) => i !== index))} disabled={variants.length <= 1}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" onClick={() => setVariants([...variants, ""])} disabled={variants.length >= LIMITS.replyVariants}>
              <Plus /> Add reply
            </Button>
            <span className="text-xs text-muted-foreground">{variants.length} of {LIMITS.replyVariants}</span>
          </div>
          <FieldError id={errorId} message={errors["commentReply.variants"]} />
        </div>
      ) : null}
    </Section>
  );
}

/** E. Opening DM (FR-5.15 to FR-5.17). */
export function OpeningDmSection({ draft, patch, errors, onFocusTab }: SectionProps) {
  return (
    <Section
      step={stepOf(draft, 4)}
      title="Opening DM"
      info="The first message they get, and it needs a button. Instagram only lets you send one message until the person taps. The button opens the conversation so we can send your link."
      tab="dm"
      onFocusTab={onFocusTab}
    >
      <TextField field="openingDm.text" label="Message" multiline value={draft.openingDm.text} max={LIMITS.dmText} error={errors["openingDm.text"]} onChange={(text) => patch((current) => ({ ...current, openingDm: { ...current.openingDm, text } }))} />
      <TextField field="openingDm.buttonLabel" label="Button label" value={draft.openingDm.buttonLabel} max={LIMITS.buttonLabel} error={errors["openingDm.buttonLabel"]} onChange={(buttonLabel) => patch((current) => ({ ...current, openingDm: { ...current.openingDm, buttonLabel } }))} />
    </Section>
  );
}

/** Follow gate. Needs a follow check in the Adeli API first, so it can't be turned on yet. */
export function FollowSection({ draft, onFocusTab }: SectionProps) {
  const switchId = useId();
  return (
    <Section
      step={stepOf(draft, 5)}
      title="Ask them to follow you"
      info="Before sending the link, ask them to follow your account and check that they did."
      tab="dm"
      onFocusTab={onFocusTab}
      action={
        <span className="flex items-center gap-2">
          {soon}
          <Switch id={switchId} checked={false} disabled aria-label="Ask them to follow you" />
        </span>
      }
    >
      <p className="text-sm text-muted-foreground">Optional. Turn it on to only send your link to followers.</p>
    </Section>
  );
}

/** Email step: asked after the tap; the Final DM waits for a valid email, which is saved as a lead. */
export function EmailSection({ draft, patch, errors, onFocusTab }: SectionProps) {
  const switchId = useId();
  const email = emailCaptureOf(draft);
  const setEmail = (next: Partial<typeof email>) => patch((current) => ({ ...current, emailCapture: { ...emailCaptureOf(current), ...next } }));
  return (
    <Section
      step={stepOf(draft, 6)}
      title="Ask for their email"
      info="After they tap, we ask for their email. Your link goes out once they reply with one, and it's saved to your leads. Export them from the menu at the top."
      tab="dm"
      onFocusTab={onFocusTab}
      action={
        <span className="flex items-center gap-2">
          <Label htmlFor={switchId} className="text-xs text-muted-foreground">{email.enabled ? "On" : "Off"}</Label>
          <Switch id={switchId} checked={email.enabled} onCheckedChange={(enabled) => setEmail({ enabled })} aria-label="Ask for their email" />
        </span>
      }
    >
      {email.enabled ? (
        <>
          <TextField field="emailCapture.text" label="Message" multiline value={email.text} max={LIMITS.dmText} error={errors["emailCapture.text"]} onChange={(text) => setEmail({ text })} />
          <TextField field="emailCapture.retryText" label="If it's not an email" hint="Sent once if their reply doesn't contain an email." value={email.retryText} max={LIMITS.dmText} error={errors["emailCapture.retryText"]} onChange={(retryText) => setEmail({ retryText })} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Optional. Turn it on to collect emails before sending your link.</p>
      )}
    </Section>
  );
}

const DM_TYPES = [
  { id: "text_buttons", label: "Text + Buttons", enabled: true },
  { id: "image", label: "Image", enabled: false },
  { id: "video", label: "Video", enabled: false },
  { id: "card", label: "Card", enabled: false },
] as const;

/** F. Final DM (FR-5.18 to FR-5.21). The model allows 3 buttons; v1 edits one. */
export function FinalDmSection({ draft, patch, errors, onFocusTab }: SectionProps) {
  const button = draft.finalDm.buttons[0] ?? { label: "", url: "" };
  const setButton = (next: Partial<typeof button>) => patch((current) => ({
    ...current,
    finalDm: { ...current.finalDm, buttons: [{ ...button, ...next }, ...current.finalDm.buttons.slice(1)] },
  }));
  return (
    <Section step={stepOf(draft, 7)} title="Final DM" info="Sent when they tap the button, or once they send their email. This is where your link goes." tab="dm" onFocusTab={onFocusTab}>
      <div className="space-y-1.5">
        <Label>DM type</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="DM type">
          {DM_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              role="radio"
              aria-checked={type.id === draft.finalDm.type}
              disabled={!type.enabled}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                type.id === draft.finalDm.type ? "border-primary bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground",
                !type.enabled && "cursor-not-allowed opacity-60",
              )}
            >
              {type.label}
              {!type.enabled ? <span className="text-[0.65rem] uppercase tracking-wide">Soon</span> : null}
            </button>
          ))}
        </div>
      </div>
      <TextField field="finalDm.text" label="Message" multiline value={draft.finalDm.text} max={LIMITS.dmText} error={errors["finalDm.text"]} onChange={(text) => patch((current) => ({ ...current, finalDm: { ...current.finalDm, text } }))} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <TextField field="finalDm.buttons.0.label" label="Button label" value={button.label} max={LIMITS.buttonLabel} error={errors["finalDm.buttons.0.label"]} onChange={(label) => setButton({ label })} />
        <TextField field="finalDm.buttons.0.url" label="Link" type="url" inputMode="url" placeholder="https://" value={button.url} max={LIMITS.url} showCounter={false} error={errors["finalDm.buttons.0.url"]} onChange={(url) => setButton({ url })} />
      </div>
    </Section>
  );
}
