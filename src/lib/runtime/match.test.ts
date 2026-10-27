import { describe, expect, it } from "vitest";

import { newDraftAutomation } from "@/lib/automations/defaults";
import type { Automation } from "@/lib/automations/schemas";

import { matchComment, matchesKeywords } from "./match";

function automation(overrides: Partial<Automation["trigger"]> = {}, status: Automation["status"] = "live"): Automation {
  const base = newDraftAutomation("auto_1", 0);
  return { ...base, status, trigger: { ...base.trigger, mediaId: "media_1", match: "keywords", keywords: ["guide"], ...overrides } };
}

const comment = { mediaId: "media_1", text: "Guide please!", fromId: "ig_fan", isSelf: false };

describe("matchesKeywords", () => {
  it("ignores case and matches inside longer text", () => {
    expect(matchesKeywords("can I get the GUIDE?", ["guide"])).toBe(true);
    expect(matchesKeywords("guidebook", ["Guide"])).toBe(true);
    expect(matchesKeywords("hello", ["guide"])).toBe(false);
  });

  it("matches emoji and accented keywords", () => {
    expect(matchesKeywords("yes 🔥🔥", ["🔥"])).toBe(true);
    expect(matchesKeywords("CAFÉ time", ["café"])).toBe(true);
    // Composed and decomposed forms of é are the same keyword.
    expect(matchesKeywords("café", ["café"])).toBe(true);
  });

  it("ignores blank keywords", () => {
    expect(matchesKeywords("anything", ["  "])).toBe(false);
  });
});

describe("matchComment", () => {
  it("matches a keyword on the automation's post", () => {
    const live = automation();
    expect(matchComment(comment, "ig_self", [live])).toBe(live);
  });

  it("matches any comment", () => {
    const live = automation({ match: "any", keywords: [] });
    expect(matchComment({ ...comment, text: "nice" }, "ig_self", [live])).toBe(live);
  });

  it("ignores self-comments, by flag or by the account's own id", () => {
    const live = automation({ match: "any", keywords: [] });
    expect(matchComment({ ...comment, isSelf: true }, "ig_self", [live])).toBeNull();
    expect(matchComment({ ...comment, fromId: "ig_self" }, "ig_self", [live])).toBeNull();
  });

  it("ignores posts with no live automation", () => {
    expect(matchComment({ ...comment, mediaId: "media_2" }, "ig_self", [automation()])).toBeNull();
    expect(matchComment(comment, "ig_self", [automation({}, "paused")])).toBeNull();
    expect(matchComment(comment, "ig_self", [automation({}, "draft")])).toBeNull();
  });

  it("ignores comments without a keyword", () => {
    expect(matchComment({ ...comment, text: "love this" }, "ig_self", [automation()])).toBeNull();
  });
});
