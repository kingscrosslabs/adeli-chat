"use client";

import { X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { LIMITS } from "@/lib/automations/schemas";
import { cn } from "@/lib/utils";

/**
 * Chip input (FR-5.8): Enter, comma or Tab turns text into a chip, × removes,
 * Backspace on an empty input removes the last chip, duplicates are blocked
 * case-insensitively.
 */
export function KeywordInput({ keywords, onChange, error, describedBy }: { keywords: string[]; onChange: (keywords: string[]) => void; error?: string; describedBy?: string }) {
  const id = useId();
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  /** Adds one or more keywords in a single update, so a pasted "a, b, c" keeps all three. */
  function commit(raws: string[]) {
    const next = [...keywords];
    let message: string | null = null;
    for (const raw of raws) {
      const keyword = raw.trim().slice(0, LIMITS.keyword);
      if (!keyword) continue;
      if (next.length >= LIMITS.keywords) {
        message = `You can add up to ${LIMITS.keywords} keywords.`;
        break;
      }
      if (next.some((existing) => existing.toLowerCase() === keyword.toLowerCase())) {
        message = `"${keyword}" is already on the list.`;
        continue;
      }
      next.push(keyword);
    }
    if (next.length !== keywords.length) onChange(next);
    setNotice(message);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit([text]);
    } else if (event.key === "Tab" && text.trim()) {
      event.preventDefault();
      commit([text]);
    } else if (event.key === "Backspace" && !text && keywords.length) {
      onChange(keywords.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          error && "border-destructive ring-3 ring-destructive/20",
        )}
        onClick={() => document.getElementById(id)?.focus()}
      >
        {keywords.map((keyword, index) => (
          <Badge key={`${keyword}-${index}`} variant="secondary" className="h-6 gap-1 pr-1 text-xs">
            {keyword}
            <button
              type="button"
              className="grid size-4 place-items-center rounded-full hover:bg-secondary-foreground/15"
              aria-label={`Remove ${keyword}`}
              onClick={(event) => { event.stopPropagation(); onChange(keywords.filter((_, i) => i !== index)); }}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          id={id}
          value={text}
          maxLength={LIMITS.keyword}
          onChange={(event) => {
            const value = event.target.value;
            if (value.includes(",")) {
              const parts = value.split(",");
              commit(parts.slice(0, -1));
              setText(parts.at(-1) ?? "");
            } else {
              setText(value);
            }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => { if (text.trim()) commit([text]); }}
          placeholder={keywords.length ? "Add another" : "e.g. GUIDE"}
          aria-label="Keywords"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="h-6 min-w-24 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
      </div>
      {notice ? <p className="text-xs text-warning" role="status">{notice}</p> : null}
    </div>
  );
}
