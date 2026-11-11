import { describe, expect, it } from "vitest";

import { claudeCodeCommand, claudeConnectorLink, codexCommands, cursorConfig, cursorInstallLink } from "./install-links";

const URL_ = "https://chat.tryadeli.com/mcp";

describe("install links", () => {
  it("opens Claude's add custom connector dialog with the name and URL filled in", () => {
    const link = new URL(claudeConnectorLink(URL_));
    expect(`${link.origin}${link.pathname}`).toBe("https://claude.ai/customize/connectors");
    expect(link.searchParams.get("modal")).toBe("add-custom-connector");
    expect(link.searchParams.get("connectorName")).toBe("Adeli Chat");
    expect(link.searchParams.get("connectorUrl")).toBe(URL_);
  });

  it("builds the Claude Code command with a placeholder, a real token, or none for sign-in", () => {
    expect(claudeCodeCommand(URL_)).toBe(`claude mcp add --transport http adeli-chat ${URL_} --header "Authorization: Bearer <YOUR_API_TOKEN>"`);
    expect(claudeCodeCommand(URL_, "adc_123")).toContain("Bearer adc_123");
    expect(claudeCodeCommand(URL_, null)).toBe(`claude mcp add --transport http adeli-chat ${URL_}`);
  });

  it("builds the Codex commands and Cursor config and deeplink", () => {
    expect(codexCommands(URL_)).toEqual({ add: `codex mcp add adeli-chat --url ${URL_}`, login: "codex mcp login adeli-chat" });
    expect(JSON.parse(cursorConfig(URL_))).toEqual({ mcpServers: { "adeli-chat": { url: URL_ } } });
    const link = new URL(cursorInstallLink(URL_));
    expect(link.searchParams.get("name")).toBe("adeli-chat");
    expect(JSON.parse(atob(link.searchParams.get("config") ?? ""))).toEqual({ url: URL_ });
  });
});
