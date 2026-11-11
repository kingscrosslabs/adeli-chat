import { describe, expect, it } from "vitest";

import { leadsCsv } from "./service";

describe("leadsCsv", () => {
  it("writes a header and one row per lead", () => {
    const csv = leadsCsv([{ email: "a@b.co", igUsername: "fan", igUserId: "ig_1", createdAt: "2026-11-09T10:00:00.000Z" }]);
    expect(csv).toBe("Email,Instagram username,Instagram user id,Captured at\r\na@b.co,fan,ig_1,2026-11-09T10:00:00.000Z\r\n");
  });

  it("quotes commas and defuses spreadsheet formulas", () => {
    const csv = leadsCsv([{ email: "=cmd@x.co", igUsername: "a,b", igUserId: "ig_1", createdAt: "t" }]);
    expect(csv.split("\r\n")[1]).toBe(`'=cmd@x.co,"a,b",ig_1,t`);
  });
});
