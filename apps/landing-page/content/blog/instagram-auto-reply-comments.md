---
title: "How to auto-reply to Instagram comments"
description: "Auto-reply to Instagram comments and DM each commenter your link: keywords, public replies, the DM button, follow checks and testing, step by step."
type: how-to
author: mika
publishedAt: 2026-11-19
targetQuery: "instagram auto reply comments"
tldr: >-
  Instagram has no built-in way to auto-reply to comments with a DM, so you
  use a comment to DM tool on Instagram's official API. Pick the post, set a
  keyword like GUIDE, write a public reply, send a DM with a button, then send
  your link when they tap. In LedaChat that takes about five minutes, or one
  sentence to Claude.
faqs:
  - question: "Can Instagram auto-reply to comments by itself?"
    answer: >-
      Not with a DM to each commenter. Instagram's own tools cover saved
      replies and some business inbox features, but sending a DM when someone
      comments a keyword needs an app built on Instagram's official API, like
      LedaChat or ManyChat.
  - question: "Do I need a business account to auto-reply to comments?"
    answer: >-
      You need an Instagram professional account, which is either a creator or
      a business account. Switching is free in Instagram's settings, and it
      doesn't change how your profile looks to followers.
  - question: "Will auto-replying to comments get my account banned?"
    answer: >-
      Not when it runs on Instagram's official API and only messages people
      who commented first, which is what Instagram allows. LedaChat connects
      through Adeli, an official Meta Tech Provider. Keep replies
      relevant, don't promise things you don't send, and avoid any tool that
      asks for your Instagram password.
  - question: "Why does the DM have a button instead of the link?"
    answer: >-
      Instagram only lets a business send one message to someone who
      commented until they respond. The button is that response: one tap opens
      the conversation, and then the link can go out.
relatedPages:
  - /#how-it-works
  - /#mcp
  - /#options
tags:
  - instagram auto reply comments
  - comment to dm
  - instagram automation
  - auto dm
cta:
  title: "Auto-reply to every comment"
  body: "LedaChat replies to comments and DMs your link the moment someone comments your keyword. Free for 10 live automations, and Claude can set it up for you."
---

Every time I post a reel with a free guide, the comments fill up with GUIDE. Replying to each one by hand, then DMing each person the link, ate my evenings. An auto-reply does both the moment the comment lands, which is also when the person is most interested.

Here's how to set it up so it works and stays inside Instagram's rules.

## Can Instagram auto-reply to comments on its own?

Not in the way most people mean. Instagram lets you save quick replies and manage messages in the inbox, but it won't watch a post for a keyword and DM everyone who comments it. For that you need a comment to DM app connected through Instagram's official API.

The rules those apps work under are worth knowing, because they shape every setup:

- **You can only DM people who interacted first.** A comment on your post or a reply to your story counts. Cold DMs to strangers don't.
- **You get one message until they respond.** So the first DM carries a button, and your link goes out after they tap it.
- **The account must be professional.** Creator or business, both free to switch to in Instagram's settings.

## What do I need before I start?

- An Instagram professional account.
- The post or reel you want to automate. It can be a post you haven't published yet.
- The link you're sending: a guide, a product page, a booking link. It has to be https.
- A comment to DM app on Meta's official APIs. I'll use LedaChat, but the steps map to most tools.

## How do I set up an auto-reply to comments?

### 1. Connect Instagram

Sign in to LedaChat and click **Connect Instagram**. It runs Instagram's own login, so you never hand over your password. LedaChat uses Meta's official APIs through [Adeli](https://www.tryadeli.com/?utm_source=ledachat.com&utm_medium=referral&utm_campaign=ledachat-blog&utm_content=instagram-auto-reply-comments), an official Meta Tech Provider, so there's no scraping and no browser bots.

### 2. Create a Comment to DM automation

Click **Create automation** and choose **Comment to DM**. Then pick where it listens:

- **Comments on a specific post or reel** for a reel that's already live.
- **Comments on your next post or reel** for something you're about to publish. It starts on the first post you publish after going live.
- **Comments on any post or reel** for a keyword that should work everywhere. A post with its own automation still uses that one first.

### 3. Set the keyword

Choose **A specific keyword** and add one or more, like GUIDE, FREE or LINK. Matching ignores capital letters, so guide and Guide both count. Or choose **Any comment** to reply to everyone, which suits giveaways.

Use a word you also say in the video and the caption: "comment GUIDE and I'll send it to you." Clear keywords mean fewer people commenting the wrong thing.

### 4. Write the public reply

Turn on **Reply to their comment** and write the reply that goes under it, like "Sent! Check your DMs." Add a few variations and LedaChat picks one at random, so your comments don't look like a wall of identical bot replies.

### 5. Write the Opening DM and its button

This is the first message they get, with one button. Keep it short and make the button the obvious next step: "Here's the guide you asked for 👇" with a button that says "Send it". The tap is what lets your link through.

### 6. Decide on a follow check and email

Two optional steps go between the tap and the link:

- **Ask them to follow you** checks that the person follows your account before sending the link. If they don't, they get a nudge with a button to check again.
- **Ask for their email** waits for a valid email before sending the link, and saves it as a lead you can export.

Both grow something you own, but each one adds a step where people drop off. I use the follow check on lead magnets and skip both on product links.

### 7. Write the Final DM

This one carries the link. You can add up to three link buttons, like the guide, a course and your newsletter.

### 8. Go live

Click **Go live**. LedaChat checks every field first, and that no other live automation on the same post uses the same keyword. On the Free plan you can have 10 live at once.

## Can my AI set this up for me?

Yes, if your tool has an MCP. LedaChat does, so I usually skip the steps above and type this into Claude:

> When someone comments GUIDE on my latest reel, reply publicly, then DM them a button that sends my guide: https://example.com/guide. Only send it if they follow me.

Claude builds it as a draft, shows me, and takes it live when I say so. The [setup guide](/blog/manychat-mcp-claude) shows how to connect Claude, ChatGPT, Cursor or Claude Code.

## How do I test it without messaging real followers?

Comment your keyword from a second Instagram account. Check that the public reply shows up, the DM arrives, the button works, and the link opens. Each person gets the flow once per automation, so to test again, use **Reset runs** on the automation, which forgets who was messaged.

If you went live after people already commented, **Message earlier comments** sends the flow to matching comments from the last 24 hours. It's a Pro feature on the hosted version.

## Why isn't my auto-reply working?

The usual causes, in order:

- **The automation isn't live.** Drafts don't run.
- **The keyword doesn't match.** Check spelling, and that people aren't commenting a different word than the one you set.
- **That person already got the flow.** Each person gets it once per automation.
- **Another automation caught it first.** A post's own automation wins over an any-post one.
- **The account isn't professional,** or the Instagram connection expired. Reconnect it.

LedaChat is free for 10 live automations, and the hosted version is opening soon. [Join the waitlist](/#options) to be first in. If you're moving over from ManyChat, [ManyChat vs LedaChat](/blog/manychat-vs-ledachat) covers what changes.
