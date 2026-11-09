import { describe, expect, it } from "vitest";

import { claudeCodeCommand, claudeConnectorLink, manualConfig } from "./install-links";

const URL_ = "https://chat.tryadeli.com/mcp";

describe("install links", () => {
  it("opens Claude's add custom connector dialog with the name and URL filled in", () => {
    const link = new URL(claudeConnectorLink(URL_));
    expect(`${link.origin}${link.pathname}`).toBe("https://claude.ai/customize/connectors");
    expect(link.searchParams.get("modal")).toBe("add-custom-connector");
    expect(link.searchParams.get("connectorName")).toBe("Adeli Chat");
    expect(link.searchParams.get("connectorUrl")).toBe(URL_);
  });

  it("builds the Claude Code command and manual config, with a placeholder or a real token", () => {
    expect(claudeCodeCommand(URL_)).toBe(`claude mcp add --transport http adeli-chat ${URL_} --header "Authorization: Bearer <YOUR_API_TOKEN>"`);
    expect(claudeCodeCommand(URL_, "adc_123")).toContain("Bearer adc_123");
    expect(JSON.parse(manualConfig(URL_, "adc_123"))).toEqual({ mcpServers: { "adeli-chat": { url: URL_, headers: { Authorization: "Bearer adc_123" } } } });
  });
});
