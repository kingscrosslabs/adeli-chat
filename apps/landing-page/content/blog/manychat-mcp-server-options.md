---
title: "ManyChat MCP servers: 5 options compared"
description: "Five ways to get a ManyChat MCP for Claude or ChatGPT, compared on what they can build, what plan they need, who maintains them, and what breaks."
type: listicle
author: mika
publishedAt: 2026-11-18
targetQuery: "manychat mcp server"
tldr: >-
  There are five ways to get a ManyChat-style MCP: community ManyChat servers,
  hosted MCP marketplaces, automation platforms, building your own on
  Instagram's API, or a comment to DM app with an MCP built in. The first three
  can't create ManyChat automations because ManyChat's API can't. LedaChat,
  which is ours, is the last kind.
faqs:
  - question: "Which ManyChat MCP server is the best?"
    answer: >-
      It depends on the job. If you're staying on ManyChat and only need to tag
      contacts or trigger flows you already built, a community server works.
      If you want your AI to create and launch comment to DM automations, use
      an app with an MCP built in, such as LedaChat.
  - question: "Are community ManyChat MCP servers safe?"
    answer: >-
      They need your ManyChat API key, which can read and message your
      contacts, so treat them like any app you give account access to. Read
      the code, check who maintains it, and prefer servers you run yourself
      over hosted ones you can't inspect.
  - question: "Can I move my ManyChat automations to LedaChat?"
    answer: >-
      There's no automatic import, but a comment to DM automation is usually
      a keyword, a reply, a DM and a link. You can describe each one to Claude
      and it will rebuild it in LedaChat as a draft for you to check.
relatedPages:
  - /#compare
  - /#mcp
  - /#options
tags:
  - manychat
  - mcp server
  - manychat alternative
  - instagram automation
cta:
  title: "Skip the workarounds"
  body: "LedaChat is a ManyChat-style comment to DM app with an MCP built in. Your AI can create, launch and pause automations. Free and open source."
---

Most people searching "ManyChat MCP" want what I wanted: their AI handling the boring part of comment to DM, "when someone comments GUIDE on this reel, DM them my link." Some of the options below can do that. Most can only work with automations you already built by hand.

## What should a ManyChat MCP server let me do?

I compared each option on what I'd actually ask it for. Can it create an automation, with a keyword trigger, a reply and a DM, from a prompt? Can it launch and pause one? Can it tell me how they're doing? And what does it take to run: which plan, which setup, and who fixes it when it breaks?

## How do the options compare?

| Option | Creates automations? | Launch and pause? | Stats? | What you need | Maintained by |
| --- | --- | --- | --- | --- | --- |
| 1. Community ManyChat MCP | No | No | Contact data only | ManyChat Pro and an API key | A community developer |
| 2. Hosted MCP marketplace | No | No | Contact data only | ManyChat Pro, plus the marketplace's plan | The marketplace |
| 3. Automation platform | No | No | Limited | ManyChat Pro, plus the platform's plan | The platform |
| 4. Build your own on Instagram's API | Yes, if you build it | Yes, if you build it | Yes, if you build it | A Meta developer app and app review | You |
| 5. Comment to DM app with an MCP (LedaChat) | Yes | Yes | Yes | An Instagram professional account | LedaChat |

The first three share a ceiling: ManyChat's API. It can send messages, trigger existing flows and manage contacts, but it can't create a flow or a keyword trigger, and every MCP built on it has the same gap.

### 1. Community ManyChat MCP servers

These are open-source projects, usually on GitHub or PyPI, that wrap ManyChat's API in MCP tools. They're useful if you live in ManyChat and only need actions on contacts: look one up, add or remove a tag, set a custom field, send a message, or trigger a flow you already built. They can't create flows, set keyword triggers, or turn automations on and off.

You need ManyChat Pro, since the API key is a Pro feature. Each server is run by one person, not ManyChat, so updates depend on their spare time. It also holds an API key that can message your contacts, so read the code before you install it.

### 2. Hosted MCP marketplaces

Several MCP marketplaces list a ManyChat connector you add with a URL and a token. It does the same contact and messaging actions as the community servers, with less setup, and it can't build automations for the same API reason.

You need ManyChat Pro and often the marketplace's own subscription. Your ManyChat API key then lives on a third party's servers, and you can't read their code.

### 3. Automation platforms

No-code automation platforms have ManyChat integrations, and many now let AI agents call their actions over MCP. They're handy if you already run your business on one, because you can chain ManyChat with other apps: "when a contact gets this tag, add a row to my sheet." They still can't create ManyChat automations.

You need ManyChat Pro and a paid plan on the platform, and each step usually counts against a task quota. That's another bill, and another place for things to break.

### 4. Build your own on Instagram's API

You can skip ManyChat and write your own comment to DM service and MCP server on Instagram's official API. That gets you anything Instagram allows: replies to comments, DMs to people who commented, and insights.

It's a real software project. You need a Meta developer app, the right permissions, and Meta's App Review before it works for anyone but you, plus webhooks, token refresh and hosting. Review alone can take weeks.

### 5. A comment to DM app with an MCP built in (LedaChat)

Of the five, this is the only one where your AI builds the automation and you don't write any code. LedaChat is our free, open-source, ManyChat-style app for Instagram comment to DM, and its MCP server ships in the same codebase as the app. Its 12 tools create, edit, launch, pause, duplicate and report on automations.

It covers keyword or any-comment triggers on one post, your next post or every post, plus story replies. Automations can post public replies with random variations, send DMs with a button and up to three links, ask for an email, check that someone follows you, and message each person once.

All you need is an Instagram professional account. There's no developer app or app review, because LedaChat runs on Instagram's official API through Adeli, a Meta Tech Provider. The Free plan runs 10 live automations with the MCP included. Pro is $25 a month for unlimited, and it's never priced by contacts. Self-hosting is free under the MIT license.

The limits: it's Instagram only for now, and it does comment to DM and story replies, not ManyChat's full chatbot builder. The hosted version is opening soon. The [setup guide](/blog/manychat-mcp-claude) covers Claude, ChatGPT, Cursor and Claude Code.

## Which option should I pick?

| If you want to | Pick |
| --- | --- |
| Stay on ManyChat and have your AI tag contacts or trigger existing flows | A community server you can read and run yourself (option 1) |
| Connect ManyChat to the automation platform you already pay for | Its ManyChat integration (option 3) |
| Own every piece, and you're a developer | Build on Instagram's API (option 4), and budget for app review |
| Say "set up a comment to DM on my latest reel" and have it done | An app with an MCP built in, like LedaChat (option 5) |

For more on what ManyChat's API can and can't do, read [Is there a ManyChat MCP?](/blog/manychat-mcp). The [LedaChat vs ManyChat table](/#compare) compares the two apps side by side.
