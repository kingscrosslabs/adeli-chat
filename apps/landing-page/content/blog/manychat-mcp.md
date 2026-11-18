---
title: "Is there a ManyChat MCP? What to use instead"
description: "ManyChat has no official MCP server, and its API can't create automations. Here's what a ManyChat MCP can really do, and a comment to DM app with one built in."
type: explainer
author: mika
publishedAt: 2026-11-18
targetQuery: "manychat mcp"
tldr: >-
  No. As of November 2026, ManyChat doesn't publish an official MCP server.
  Community servers wrap ManyChat's API, which needs a Pro plan and can't
  create flows or keyword triggers, so Claude can't build automations through
  them. LedaChat, which is ours, is a ManyChat-style comment to DM app with an
  MCP built in: Claude, ChatGPT or Cursor can create, launch and pause your
  automations.
faqs:
  - question: "Does ManyChat have an official MCP server?"
    answer: >-
      Not that we could find as of November 2026. ManyChat has a public API,
      and a few community projects wrap it in an MCP server, but ManyChat
      doesn't make or support any of them. Check ManyChat's own site in case
      that changes.
  - question: "Can Claude create a ManyChat automation?"
    answer: >-
      Not through ManyChat's API. The API can send an existing flow to a
      contact and manage tags and fields, but it has no endpoint to create a
      flow or a keyword trigger. You still build those by hand in ManyChat's
      flow builder.
  - question: "Is LedaChat affiliated with ManyChat?"
    answer: >-
      No. LedaChat is an independent, open-source comment to DM app built by
      King's Cross Labs. It does a similar job on Instagram, has an MCP server
      built in, and doesn't connect to your ManyChat account.
  - question: "Is LedaChat's MCP free?"
    answer: >-
      Yes. MCP access is included on the Free plan, which runs 10 live
      automations. Pro is $25 a month for unlimited automations, and the
      self-hosted version is free under the MIT license.
relatedPages:
  - /#mcp
  - /#compare
  - /#options
tags:
  - manychat
  - mcp
  - instagram automation
  - comment to dm
cta:
  title: "Want comment to DM you can run from Claude?"
  body: "LedaChat is a free, open-source ManyChat alternative with an MCP built in. Ask your AI to set up, launch or pause your Instagram automations."
---

I wanted a ManyChat MCP myself. Every reel I post comes with a guide, and I wanted to set each one up by typing "comment GUIDE, get the link" into Claude instead of clicking through a flow builder. ManyChat doesn't offer that, and the community servers that wrap its API can't build automations either.

## Is there a ManyChat MCP?

Not an official one. As of November 2026, ManyChat doesn't publish an MCP server. You'll find three things instead:

- Community MCP servers on GitHub and PyPI that wrap ManyChat's public API, each maintained by an individual developer
- Hosted MCP marketplaces that list a ManyChat connector built on the same API
- Automation platforms with a ManyChat integration you can reach from an agent

All three sit on ManyChat's API, so they share its limits.

## What is an MCP server, in plain terms?

An MCP server lets an AI assistant use an app. The [Model Context Protocol](https://modelcontextprotocol.io/docs/getting-started/intro) is an open standard that Claude, ChatGPT, Cursor and others support. Each server gives the assistant a list of tools, like "list my posts" or "create an automation", and the assistant calls them when you ask.

A server can only do what the app's API allows. If the API has no way to create an automation, no MCP server built on it can create one.

## What can a ManyChat MCP actually do?

It can work with automations you already built, but it can't build new ones. ManyChat's API is made for sending messages and managing contacts, so community servers usually let your AI look up a contact, read and set custom fields, add or remove tags, send a message, trigger an existing flow, and list your flows by name.

The API can't create, edit or delete a flow, and ManyChat users have asked for that in ManyChat's community forum. It has no endpoint for keyword triggers, so "when someone comments GUIDE, send this DM" is out. And you need a paid Pro account to get an API key at all, so none of these servers run on ManyChat's free plan.

So with a ManyChat MCP, you still open the flow builder, click through the setup, and only then let the AI poke at it.

## Why can't ManyChat's API build automations?

It was built for a different job. ManyChat's API lets your other software (a store, a CRM, a booking tool) talk to contacts who are already in ManyChat. You build automations in the visual flow builder, and the API was never meant to replace it.

That made sense before AI agents. Now the fastest way to set up a simple comment to DM is to describe it in a sentence, and that only works if the app lets you create and launch automations through its API.

## What's a ManyChat-style app with an MCP built in?

That's why we built LedaChat: a free, open-source comment to DM app for Instagram, with an MCP server in the same codebase as the app. Your AI can do the whole job:

| What you ask your AI | ManyChat MCP (community) | LedaChat MCP |
| --- | --- | --- |
| "Set up a comment to DM on my latest reel" | No, flows are built by hand | Yes |
| "Make it go live" | No | Yes, with the same checks as the editor |
| "Pause everything on that post" | No | Yes |
| "How did last week's automations do?" | Contact data only | Yes, stats and button taps per automation |
| "Reply to story replies too" | No | Yes |
| Needs a paid plan for the API | Yes, Pro | No, MCP is on the Free plan |
| Who maintains the server | A community developer | LedaChat |

The MCP has 12 tools, from `list_posts` and `create_automation` to `go_live` and `pause_automation`. They call the same code as the buttons in the app, so an automation Claude launches passes the same checks as one you launch by hand.

## What does it look like in practice?

You type something like this into Claude:

> Set up a comment to DM on my latest reel. When someone comments GUIDE, reply publicly and DM them my free guide link.

Claude finds your latest reel, creates a draft automation with your keyword, a public reply and a DM with a button, and shows you what it made. Say "looks good, go live" and it launches. From then on, everyone who comments GUIDE gets a public reply and a DM, and the link arrives when they tap the button.

Every automation starts as a draft, so nothing runs until you say so. You can also connect an assistant read-only, so it can report on your automations without changing them.

The [setup guide](/blog/manychat-mcp-claude) walks through connecting Claude, ChatGPT, Cursor and Claude Code.

## Is it allowed by Instagram?

Yes. LedaChat runs on Instagram's official API through Adeli, a Meta Tech Provider. It never asks for your password, doesn't scrape and doesn't use browser bots, and it only messages people who commented on your post or replied to your story first. You need an Instagram professional account (Business or Creator), and [switching](https://help.instagram.com/502981923235522) is free.

## How much does it cost?

I moved off ManyChat after upgrading to Pro at $29 a month and then getting a bill for over $100, because ManyChat prices by active contacts. LedaChat doesn't:

| Plan | Price | What you get |
| --- | --- | --- |
| Free | $0 | 10 live automations and every feature, MCP included, with "Powered by LedaChat" after the last DM |
| Pro | $25 a month | Unlimited automations, no branding, the same price whether 50 or 50,000 people comment |
| Self-host | Free, MIT license | Unlimited automations on your own Vercel account |

The hosted version is opening soon. [Join the waitlist](/#options) to be first in.
