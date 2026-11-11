import { describe, expect, it } from "vitest";

import { defaultAutomationContent, newDraftAutomation } from "@adeli-chat/ui/automation/defaults";
import { STORY_LIFETIME_MS, storyExpired, type Automation } from "@adeli-chat/ui/automation/schemas";
import { findConflict, triggerSummary, validateForLive } from "./validate";

function live(id: string, content: Partial<Automation>): Automation {
  return { ...newDraftAutomation(id, 0), status: "live", ...content };
}

describe("Story Reply validation", () => {
  it("starts on a specific story and needs one picked", () => {
    const content = defaultAutomationContent(0, "story_reply");
    content.trigger.keywords = ["guide"];
    expect(content.trigger.postScope).toBe("specific");
    expect(validateForLive(content)).toEqual({ "trigger.mediaId": "Pick the story people will reply to." });
    content.trigger.mediaId = "story_1";
    expect(validateForLive(content)).toEqual({});
  });

  it("needs no story on Any story, and ignores the public reply", () => {
    const content = defaultAutomationContent(0, "story_reply");
    content.trigger = { ...content.trigger, postScope: "any", keywords: ["guide"] };
    content.commentReply.variants = [""];
    expect(validateForLive(content)).toEqual({});
  });

  it("asks for a keyword or Any reply", () => {
    expect(validateForLive(defaultAutomationContent(0, "story_reply"))["trigger.keywords"]).toBe("Add at least one keyword, or choose Any reply.");
  });

  it("only conflicts with other Story Reply automations", () => {
    const content = defaultAutomationContent(0, "story_reply");
    content.trigger = { ...content.trigger, postScope: "any", match: "any" };
    const story = defaultAutomationContent(1, "story_reply");
    const comment = defaultAutomationContent(2);
    const others = [
      live("comment", { ...comment, trigger: { ...comment.trigger, postScope: "any", match: "any" } }),
    ];
    expect(findConflict(content, "self", others)).toBeNull();
    others.push(live("story", { ...story, trigger: { ...story.trigger, postScope: "any", keywords: ["guide"] } }));
    expect(findConflict(content, "self", others)?.automation.id).toBe("story");
  });

  it("only conflicts on the same story when one is picked", () => {
    const content = defaultAutomationContent(0, "story_reply");
    content.trigger = { ...content.trigger, mediaId: "story_a", keywords: ["guide"] };
    const other = defaultAutomationContent(1, "story_reply");
    const onB = live("b", { ...other, trigger: { ...other.trigger, mediaId: "story_b", keywords: ["guide"] } });
    const onA = live("a", { ...other, trigger: { ...other.trigger, mediaId: "story_a", keywords: ["guide"] } });
    const anyStory = live("any", { ...other, trigger: { ...other.trigger, postScope: "any", match: "any" } });
    expect(findConflict(content, "self", [onB, anyStory])).toBeNull();
    expect(findConflict(content, "self", [onA])?.automation.id).toBe("a");
  });

  it("summarizes the trigger, including an expired story", () => {
    const content = defaultAutomationContent(0, "story_reply");
    const anyStory = { ...content.trigger, postScope: "any" as const };
    expect(triggerSummary({ type: content.type, trigger: { ...anyStory, keywords: ["guide"] } })).toBe("Any story · GUIDE");
    expect(triggerSummary({ type: content.type, trigger: { ...anyStory, match: "any" } })).toBe("Any story · Any reply");
    expect(triggerSummary({ type: content.type, trigger: { ...content.trigger, keywords: ["guide"] } })).toBe("No story yet · GUIDE");
    const snapshot = (publishedAt: string) => ({ thumbUrl: null, mediaType: "IMAGE" as const, caption: "", permalink: null, publishedAt });
    const fresh = { ...content.trigger, mediaId: "s", mediaSnapshot: snapshot(new Date(Date.now() - 60_000).toISOString()), keywords: ["guide"] };
    expect(triggerSummary({ type: content.type, trigger: fresh })).toBe("One story · GUIDE");
    const old = { ...fresh, mediaSnapshot: snapshot(new Date(Date.now() - STORY_LIFETIME_MS - 1).toISOString()) };
    expect(triggerSummary({ type: content.type, trigger: old })).toBe("Expired story · GUIDE");
    expect(storyExpired({ type: content.type, trigger: old })).toBe(true);
    expect(storyExpired({ type: "comment_to_dm", trigger: old })).toBe(false);
  });
});

describe("follow gate validation", () => {
  function ready(type: "comment_to_dm" | "story_reply" = "comment_to_dm") {
    const content = defaultAutomationContent(0, type);
    content.trigger = { ...content.trigger, postScope: "any", keywords: ["guide"] };
    return content;
  }

  it("needs every follow message and a button label only when it's on", () => {
    const content = ready();
    content.followGate = { enabled: false, text: "", buttonLabel: "", retryText: "" };
    expect(validateForLive(content)).toEqual({});
    content.followGate.enabled = true;
    expect(Object.keys(validateForLive(content))).toEqual(["followGate.text", "followGate.buttonLabel", "followGate.retryText"]);
  });

  it("limits the button label even in a draft", () => {
    const content = ready();
    content.followGate = { ...content.followGate!, buttonLabel: "x".repeat(21) };
    expect(validateForLive(content)["followGate.buttonLabel"]).toBe("Button labels can be up to 20 characters.");
  });

  it("ignores the follow gate on a Story Reply", () => {
    const content = ready("story_reply");
    content.followGate = { enabled: true, text: "", buttonLabel: "", retryText: "" };
    expect(validateForLive(content)).toEqual({});
  });
});
