import { describe, expect, it } from "vitest";

import { defaultAutomationContent, newDraftAutomation } from "./defaults";
import type { Automation } from "./schemas";
import { findConflict, triggerSummary, validateForLive } from "./validate";

function live(id: string, content: Partial<Automation>): Automation {
  return { ...newDraftAutomation(id, 0), status: "live", ...content };
}

describe("Story Reply validation", () => {
  it("needs no post and ignores the public reply", () => {
    const content = defaultAutomationContent(0, "story_reply");
    content.trigger.keywords = ["guide"];
    content.commentReply.variants = [""];
    expect(validateForLive(content)).toEqual({});
  });

  it("asks for a keyword or Any reply", () => {
    expect(validateForLive(defaultAutomationContent(0, "story_reply"))["trigger.keywords"]).toBe("Add at least one keyword, or choose Any reply.");
  });

  it("only conflicts with other Story Reply automations", () => {
    const content = defaultAutomationContent(0, "story_reply");
    content.trigger.match = "any";
    const story = defaultAutomationContent(1, "story_reply");
    const comment = defaultAutomationContent(2);
    const others = [
      live("comment", { ...comment, trigger: { ...comment.trigger, postScope: "any", match: "any" } }),
    ];
    expect(findConflict(content, "self", others)).toBeNull();
    others.push(live("story", { ...story, trigger: { ...story.trigger, keywords: ["guide"] } }));
    expect(findConflict(content, "self", others)?.automation.id).toBe("story");
  });

  it("summarizes the trigger", () => {
    const content = defaultAutomationContent(0, "story_reply");
    expect(triggerSummary({ type: content.type, trigger: { ...content.trigger, keywords: ["guide"] } })).toBe("Any story · GUIDE");
    expect(triggerSummary({ type: content.type, trigger: { ...content.trigger, match: "any" } })).toBe("Any story · Any reply");
  });
});
