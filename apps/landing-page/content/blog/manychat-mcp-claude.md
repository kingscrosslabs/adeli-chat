---
title: "ManyChat MCP for Claude: a setup guide that works"
description: "No ManyChat MCP can build automations. Connect LedaChat, a ManyChat-style app, to Claude, ChatGPT or Cursor and launch Instagram comment to DMs by chatting."
type: how-to
author: nick
publishedAt: 2026-11-18
targetQuery: "manychat mcp claude"
tldr: >-
  ManyChat has no MCP for Claude, but LedaChat, a ManyChat-style comment to DM
  app, has one built in. Add the server URL, https://app.ledachat.com/mcp,
  to Claude as a custom connector (or run claude mcp add in Claude Code),
  sign in, then ask Claude to set up a comment to DM. It builds a draft, and
  goes live when you say so.
faqs:
  - question: "Does this work with ChatGPT and Cursor too?"
    answer: >-
      Yes. MCP is an open standard, and LedaChat's setup page has a guide for
      Claude, ChatGPT (and Codex), Cursor, Perplexity and any other MCP client.
      Claude, ChatGPT, Cursor and Perplexity sign in with OAuth, so you never
      paste a token.
  - question: "Can Claude send DMs to anyone it wants?"
    answer: >-
      No. LedaChat only messages people who commented on your post or replied
      to your story first, as Instagram's rules require. Claude sets up the
      automation, and the automation decides who gets a DM.
  - question: "Can I stop Claude from changing my automations?"
    answer: >-
      Yes. When you connect, turn off changes for a read-only connection, or
      create a read-only API token. Claude can then list automations and read
      their stats but can't create, launch or pause anything.
  - question: "What's the difference between this and a ManyChat MCP?"
    answer: >-
      Community ManyChat MCP servers wrap ManyChat's API, which can't create
      flows or keyword triggers and needs a Pro plan. LedaChat's MCP can
      create, launch, edit and pause automations, and it's included on the
      Free plan.
relatedPages:
  - /#mcp
  - /#how-it-works
  - /#options
tags:
  - manychat
  - mcp
  - claude
  - chatgpt
  - comment to dm
cta:
  title: "Set up comment to DM by chatting"
  body: "LedaChat's MCP lets Claude, ChatGPT or Cursor create and launch your Instagram comment to DM automations. Free and open source."
---

ManyChat doesn't have an MCP for Claude, and the community servers can't create automations ([here's why](/blog/manychat-mcp)). This guide connects LedaChat, a ManyChat-style comment to DM app with an MCP built in, to your AI assistant. Then we'll build your first automation from a chat.

## What do I need before I start?

1. An Instagram professional account (Business or Creator). Switching a personal account is [free in the Instagram app](https://help.instagram.com/502981923235522).
2. A LedaChat account with your Instagram connected. The hosted version is opening soon, so [join the waitlist](/#options), or self-host it for free from GitHub today.
3. An MCP client: Claude on the web, desktop or Claude Code, ChatGPT, Cursor, Perplexity, or anything else that speaks MCP.

You don't need a Meta developer app, an Instagram API key or a paid plan. MCP access is on the Free plan.

## How do I connect LedaChat to Claude?

Add LedaChat as a custom connector and sign in.

1. In Claude, open the connectors settings and add a custom connector.
2. Paste the server URL, `https://app.ledachat.com/mcp`, and continue. (Self-hosting? Use your own URL, shown under **Connect to AI Agent** in LedaChat.)
3. Sign in to LedaChat when Claude asks, and choose what Claude may do. Turn off **changes** if you want a read-only connection.

Claude can now see LedaChat's tools. Connectors you add on claude.ai also show up in Claude Code when you're signed in with the same account.

## How do I connect it to Claude Code?

It's one command, then a sign-in. These steps follow [Anthropic's Claude Code MCP docs](https://code.claude.com/docs/en/mcp).

1. Add the server:

   ```bash
   claude mcp add --transport http ledachat https://app.ledachat.com/mcp
   ```

2. In a Claude Code session, type `/mcp`, pick `ledachat`, and choose **Authenticate**.
3. To use LedaChat in every project, not only the current one, add `--scope user` to the first command.

Run `claude mcp list` to check it's connected.

## How do I connect Codex?

Two commands, then a new session.

1. Add the server:

   ```bash
   codex mcp add ledachat --url https://app.ledachat.com/mcp
   ```

2. Sign in: run `codex mcp login ledachat` and finish signing in in the browser window it opens.
3. Start a new Codex session. Codex loads MCP tools when a session starts, so a session that was already open won't see LedaChat's tools.

Use `https://app.ledachat.com/mcp` exactly. `ledachat.com/mcp` isn't the server, and Codex rightly refuses to follow a redirect while signing in.

To check it worked, ask Codex to "call LedaChat's get_workspace". It answers with your account, your connected Instagram (or a link to connect one) and your plan.

## How do I connect ChatGPT, Cursor or another client?

ChatGPT, Cursor and Perplexity work like Claude: add LedaChat as a connector or MCP server with the same URL, `https://app.ledachat.com/mcp`, and sign in with OAuth. The **Connect to AI Agent** page has the steps for each one.

Any other MCP client can use the server URL with an `Authorization: Bearer` header and a LedaChat API token. Tokens start with `adc_`. You get a Default token, and you can make more that are read-only or expire after 30, 90 or 365 days.

To disconnect an assistant, remove it under **Connected apps** in LedaChat, or revoke its token.

## How do I create my first automation from a chat?

Describe it in a sentence or two:

> Set up a comment to DM on my latest reel. When someone comments GUIDE, reply publicly and DM them a button that sends my free guide: https://example.com/guide

Claude then calls four tools in a row:

1. `get_workspace` checks which Instagram account is connected and how many live automations your plan allows.
2. `list_posts` finds the reel, newest first.
3. `create_automation` makes a draft with your keyword, a public reply, a DM with a button, and your link. Anything you didn't mention gets LedaChat's defaults.
4. Claude shows you the draft and asks before going further.

When you're happy, say "go live". Claude calls `go_live`, which runs the same checks as the **Go live** button in the app. If something's missing, like a placeholder link, Claude tells you what to fix and the automation stays a draft.

## What else can I ask it to do?

Anything you'd do in the editor. These prompts work well:

- "Add FREE and LINK as keywords on the GUIDE automation."
- "Change the DM to sound more casual, and give the public reply three variations."
- "Ask for their email before sending the link."
- "Only send the link to people who follow me."
- "Set up the same thing for my next post, whatever it is."
- "Reply to anyone who answers my current story with SIGNUP."
- "Pause everything on that reel."
- "How did my automations do this week? Which one got the most taps?"
- "Duplicate the GUIDE automation for my new reel."

Edits to a live automation apply at once, and they have to pass the go live checks too.

## How do I test it without messaging real followers?

Comment on your own post from a second account. LedaChat sends each person the flow once, so after a test, ask Claude to "reset runs on the GUIDE automation". That forgets who was messaged and clears the stats, and you can trigger it again.

## Is it safe to let an AI run my Instagram DMs?

Claude sets up the automations. It never chats with your followers, and a few rules keep it that way. `create_automation` always makes a draft, and nothing runs until someone calls `go_live`. A connection or token only reaches your own automations. For an assistant that should only report, turn off changes or give it a read-only token.

On the Instagram side, LedaChat runs on Instagram's official API through Adeli, a Meta Tech Provider, and only DMs people who commented or replied first.

To see how the rest of LedaChat compares, read [LedaChat vs ManyChat](/#compare).
