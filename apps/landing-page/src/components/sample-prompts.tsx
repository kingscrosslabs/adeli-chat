"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { cn } from "@adeli-chat/ui/lib/utils";

/** Things to ask an agent once LedaChat's MCP is connected. Each one copies with a click. */
const PROMPTS = [
  "Set up a comment to DM on my latest reel. When someone comments GUIDE, send them my AI guide link.",
  "Which of my live automations sent the most DMs this week?",
  "Pause every automation on last week's carousel.",
  "Make a story reply automation that sends my booking link to anyone who replies to today's story.",
  "Turn my GUIDE automation into a skill, so I can set up the same flow on every new reel.",
];

export function SamplePrompts({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">Try asking</p>
      <ul className="flex flex-col gap-2.5">
        {PROMPTS.map((prompt) => <PromptRow key={prompt} prompt={prompt} />)}
      </ul>
    </div>
  );
}

function PromptRow({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the text is still selectable.
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => void copy()}
        className="group flex w-full items-start gap-3 rounded-xl border bg-card px-3.5 py-3 text-left text-sm transition-colors outline-none hover:border-link focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex-1 select-text">{prompt}</span>
        <span className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-link">
          {copied ? <Check className="size-4 text-link" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </span>
        <span className="sr-only" aria-live="polite">{copied ? "Copied" : "Copy prompt"}</span>
      </button>
    </li>
  );
}
