# Email (Loops)

LedaChat sends its welcome email through [Loops](https://loops.so). It's optional: without
`LOOPS_API_KEY` nothing is sent, which is how local dev and self-hosted installs run.

## How it works

1. A user signs in with Google for the first time. Better Auth's `user.create.after` hook
   (`apps/web/src/lib/auth/server.ts`) calls `notifyLoopsSignup` (`apps/web/src/lib/loops.ts`).
2. That sends one `POST https://app.loops.so/api/v1/events/send` after the response, with:

   | Field | Value |
   |---|---|
   | `eventName` | `signup` |
   | `email`, `userId` | the user's email and LedaChat user id |
   | `firstName`, `lastName` | from the Google name, split on the first space |
   | `source` | `ledachat-app` |
   | `userGroup` | `ledachat-user` |

   The `Idempotency-Key` header is `ledachat-signup-<userId>`, so a retry within 24 hours is
   ignored. Loops creates the contact if it doesn't exist.
3. In the Loops **LedaChat** team, the workflow "Automate Instagram replies for free with
   LedaChat" runs on the `signup` event and sends the welcome email from
   `mika@updates.ledachat.com`. Each contact gets it once.

Sign-up never waits on Loops: a failure is logged and never retried.

Only a new account sends the event. Signing in to an existing account sends nothing.

## Deleting an account

Settings > Delete account (`apps/web/src/lib/account.ts`) also deletes the user's Loops
contact (`POST https://app.loops.so/api/v1/contacts/delete`). So signing up again with the
same Google account is a new sign-up and gets the welcome email again, which is how to test
the flow. A Loops failure is logged and never stops the deletion.

## Rules

- Only the LedaChat user's own details go to Loops, never a commenter's or lead's.
- The welcome email is a workflow (marketing) email with an unsubscribe link, not a
  transactional email.
- Adding contacts another way (an import, a backfill) doesn't send the welcome email, because
  the workflow listens for the event, not for new contacts.

## Setup

- `LOOPS_API_KEY`: LedaChat team > Settings > API. Set it in Vercel Production only.
- Sending domain: `updates.ledachat.com`, DNS in Cloudflare (`ledachat.com` zone).
