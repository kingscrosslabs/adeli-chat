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
import { LIMITS, type AutomationContent } from "@/lib/automations/schemas";
import type { FieldErrors } from "@/lib/automations/validate";
import { snapshotOf } from "@/lib/demo/samples";
import { cn } from "@/lib/utils";

import { ChoiceRow, Counter, FieldError, Section, TextField, type PreviewTab } from "./fields";
import { KeywordInput } from "./keyword-input";

export type SectionProps = {
  draft: AutomationContent;
  patch: (update: (draft: AutomationContent) => AutomationContent) => void;
  errors: FieldErrors;
  onFocusTab: (tab: PreviewTab) => void;
};

const soon = <Badge variant="outline" className="font-medium text-muted-foreground">Coming soon</Badge>;

/** B. When someone comments on (FR-5.2 to FR-5.6). */
export function PostSection({ draft, patch, errors, onFocusTab, accountId }: SectionProps & { accountId: string }) {
  const errorId = useId();
  return (
    <Section step={1} title="When someone comments on" info="Pick the post or reel people will comment on. Each automation watches one post." tab="post" onFocusTab={onFocusTab}>
      <div className="grid gap-2">
        <ChoiceRow name="post-scope" checked title="A specific post or reel" />
        <ChoiceRow name="post-scope" checked={false} disabled title="Any post or reel" badge={soon} />
        <ChoiceRow name="post-scope" checked={false} disabled title="Next post or reel" badge={soon} />
      </div>
      <PostPicker
        accountId={accountId}
        mediaId={draft.trigger.mediaId}
        snapshot={draft.trigger.mediaSnapshot}
        error={errors["trigger.mediaId"]}
        onSelect={(media: AdeliMedia) => patch((current) => ({ ...current, trigger: { ...current.trigger, mediaId: media.id, mediaSnapshot: snapshotOf(media) } }))}
      />
      <FieldError id={errorId} message={errors["trigger.mediaId"]} />
    </Section>
  );
}

/** C. And this comment has (FR-5.7 to FR-5.11). */
export function TriggerSection({ draft, patch, errors, onFocusTab }: SectionProps) {
  const errorId = useId();
  const match = draft.trigger.match;
  const setMatch = (value: "keywords" | "any") => patch((current) => ({ ...current, trigger: { ...current.trigger, match: value } }));
  return (
    <Section
      step={2}
      title="And this comment has"
      info={<>A specific keyword: only comments containing one of your words, not case-sensitive. Press Enter or comma to add each one.<br /><br />Any comment: everyone who comments gets your DM. Either way, each person gets it once.</>}
      tab="comments"
      onFocusTab={onFocusTab}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <ChoiceRow name="match" checked={match === "keywords"} onSelect={() => setMatch("keywords")} title="A specific keyword" />
        <ChoiceRow name="match" checked={match === "any"} onSelect={() => setMatch("any")} title="Any comment" />
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
      step={4}
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
    <Section step={5} title="Final DM" info="Sent when they tap the button. This is where your link goes." tab="dm" onFocusTab={onFocusTab}>
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
