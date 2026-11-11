# Adeli Chat: Design and Brand Reference

> Status: v1.1 reference · Last updated: 2026-11-09
>
> Source of truth: Adeli's `DESIGN.md` and `BRAND.md`, its shared tokens (`adeli/packages/ui/src/theme.css`) and its dashboard primitives (`adeli/apps/web/components/ui/*`). `packages/ui/src/theme.css` holds a copy of it; when Adeli changes its tokens, copy the file again and update this one.

Adeli Chat should look like a room inside the Adeli dashboard: same tokens, same primitives, same calm teal-on-paper feel. A user who has an Adeli account should not be able to tell where Adeli ends and Adeli Chat begins.

**Copy rule: no em dashes anywhere** (UI text, defaults, docs, commit messages).

---

## 1. Principles

1. **One chromatic voice.** Signal Teal (`#0A807A`) is the only brand color that carries meaning. Everything else is ink, fog and white.
2. **Calm, not loud.** Thin borders, soft rings, small radii. No gradients, no glow, no stacked shadows.
3. **Tokens, not hex codes.** Components use semantic tokens (`bg-primary`, `text-muted-foreground`). Raw hex values live only in `packages/ui/src/theme.css`.
4. **Same primitives as Adeli.** shadcn `base-nova` style on Base UI. Copy Adeli's component files rather than re-styling stock shadcn.
5. **The phone preview is not branded.** It imitates Instagram's general visual language with neutral greys, scoped to its own tokens (§7).

---

## 2. Stack facts (what Adeli actually uses)

| Thing | Adeli dashboard | Adeli Chat does |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19 | Same. Next 16 uses `proxy.ts`, not `middleware.ts`. |
| CSS | Tailwind CSS v4, CSS-first config (`@theme inline` in `globals.css`), no `tailwind.config.ts` | Same. Tokens live in `packages/ui/src/theme.css`; each app's `globals.css` imports it. |
| Components | shadcn CLI, style `base-nova`, primitives from `@base-ui/react` | Same `components.json` settings. |
| Icons | `lucide-react` | Same. |
| Toasts | `sonner` | Same. |
| Animation | `tw-animate-css` | Same. |
| Fonts | Inter (`--font-inter`) for UI, Geist Mono (`--font-geist-mono`) for code and keys | Same, via `next/font/google`. |

`packages/ui/components.json` (run the shadcn CLI from `packages/ui`, so new components land in the shared package):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/theme.css", "baseColor": "neutral", "cssVariables": true, "prefix": "" },
  "iconLibrary": "lucide",
  "aliases": { "components": "@adeli-chat/ui/components", "utils": "@adeli-chat/ui/lib/utils", "ui": "@adeli-chat/ui/components", "lib": "@adeli-chat/ui/lib", "hooks": "@adeli-chat/ui/hooks" },
  "menuColor": "default",
  "menuAccent": "subtle"
}
```

Components to copy from `adeli/apps/web/components/ui/` in M0: `alert`, `avatar`, `badge`, `button`, `card`, `dropdown-menu`, `input`, `label`, `scroll-area`, `separator`, `sheet`, `skeleton`, `sonner`, `textarea`, `tooltip`. Add with the shadcn CLI (same style) when needed: `dialog`, `radio-group`, `switch`, `tabs`, `alert-dialog`.

---

## 3. Color

Adeli Chat uses Adeli's tokens unchanged: **dark (Night Sky) by default**, with Light (Cloud Sky) and System. `next-themes` sets the `.dark` class with `defaultTheme="dark"` and `storageKey="adeli-theme"`, like the Adeli dashboard. The Light / Dark / System toggle is on Settings (`packages/ui/src/theme-toggle.tsx`, copied from Adeli).

Every token, its light and dark value and its contrast pairings are in Adeli's `DESIGN.md` ("Tokens", "Contrast"). The rules that matter most here:

- **Signal Teal `#0A807A` fills things** (primary buttons, the Live dot, badges) in both modes. One primary button per view.
- **Teal text is `text-link`, never `text-primary`.** `--link` is `#0A807A` in light and `#2EA398` in dark.
- **No teal text on the light sidebar** (Cloud Sky). The selected item is a white chip.
- **Status is `--success`, `--warning`, `--destructive`**, as text on a tint, never as a solid fill.
- **Tokens, not palette colours.** `bg-card`, not `bg-white`. The phone preview is the one exception (section 7).

### Adeli Chat additions

| Token | Value | Use |
|---|---|---|
| `--color-warning-wash` | `--warning` at 14% | Paused pill and warning banner backgrounds |
| `--color-success-wash` | `--success` at 14% | Success pill backgrounds (Connected) |

---

## 4. Typography

| Role | Font | Size / weight |
|---|---|---|
| Page title (h1) | Inter | `text-2xl font-semibold tracking-tight` |
| Section title (editor sections) | Inter | `text-base font-semibold` |
| Body, inputs | Inter | `text-sm` (inputs are `text-base` on mobile to stop iOS zoom, `md:text-sm`) |
| Helper text, counters | Inter | `text-xs text-muted-foreground` |
| API keys, ids, code | Geist Mono | `font-mono text-[0.82rem]` |
| Wordmark | Inter | `font-semibold tracking-tight`, beside the logo mark, as Adeli's sidebar header does |

Jersey 10 is retired, as it is in Adeli. Satoshi belongs to Adeli's marketing site only.

---

## 5. Shape, space, elevation

- **Radius:** Adeli's sharp scale. `rounded-lg` (buttons, inputs) is 3px, `rounded-xl` (cards, menus) is 4px, nothing rounds past 6px. `rounded-full` is for avatars, dots and spinners only; badges are `rounded-md`.
- **Spacing:** Tailwind 4px scale. Settings and Connect to AI Agent are centred at `max-w-3xl`.
- **Elevation:** none. Every `shadow-*` resolves to nothing; surfaces separate with a hairline border or a fill.
- **Focus:** every interactive element shows a visible `ring`. Do not remove it.
- **Brand logos** (Claude, ChatGPT, Cursor, Perplexity on Connect to AI Agent) keep their owners' colours: a tile in the brand colour with a white mark.

---

## 6. Components (how Adeli's primitives map to our screens)

### Buttons (from Adeli `button.tsx`)

| Variant | Use in Adeli Chat |
|---|---|
| `default` | One per view: Go Live, Create automation, Save key, Connect Instagram |
| `outline` | Save, Reconnect, Preview (mobile) |
| `secondary` | Add reply, Load more |
| `ghost` | Row actions, icon buttons, back link |
| `destructive` | Delete, Disconnect, Remove key (always behind a confirm dialog) |
| `link` | "How do I get a key?" style inline links |

Sizes: `default` is 32px tall, `lg` 36px. Use `lg` for the primary action in page headers and the setup screen.

### Status pills (from Adeli `badge.tsx`)

| Status | Classes | Extra |
|---|---|---|
| Draft | `bg-muted text-muted-foreground` | none |
| Live | `variant="secondary"` (deep on mint) | 6px dot in `bg-primary` with `animate-pulse` (respect `prefers-reduced-motion`) |
| Paused | `bg-warning-wash text-warning` | none |
| Needs reconnect | `bg-warning-wash text-warning` | lucide `AlertTriangle` icon |

### Inputs and forms

- Adeli `input` and `textarea`. Labels with Adeli `label`. Errors set `aria-invalid`, which turns the border `--destructive` with a soft ring, and show a one-line message below in `text-xs text-destructive`.
- Character counters sit bottom-right in `text-xs text-muted-foreground`, turning `text-destructive` past the limit.
- Keyword chips: Adeli `badge` `variant="secondary"` with a ghost × button.

### Cards and panels

- Automations list, template picker, post tiles: Adeli `card`.
- Selected post tile: `ring-2 ring-primary` plus a check badge.
- "Coming soon" cards: `opacity-60`, a `badge variant="outline"` saying "Coming soon", not focusable.

### Feedback

- Toasts: Adeli `sonner`. Success toasts are short ("Saved", "Automation is live"). Error toasts say what to do next.
- Inline alerts: Adeli `alert` for connection problems and the "missing Adeli API key" banner.

### App shell

Use Adeli's shell pattern: left sidebar (`--sidebar` fog background) with Automations and Settings, header bar on content. The sidebar footer shows the connected Instagram handle and avatar.

---

## 7. Phone preview tokens

The preview imitates Instagram's general layout. No Meta logos, icons or copied assets. Scope these to `.phone-preview` so they never leak into the app:

```css
.phone-preview {
  --pv-bg: #FFFFFF;
  --pv-text: #0F0F0F;
  --pv-subtle: #737373;
  --pv-divider: #EFEFEF;
  --pv-bubble-in: #EFEFEF;     /* their messages */
  --pv-bubble-out: #3B5BDB;    /* your messages, generic blue, not Instagram's gradient */
  --pv-bubble-out-text: #FFFFFF;
  --pv-button: #FFFFFF;        /* DM buttons render as white pills inside the bubble */
  --pv-frame: #17312F;         /* the phone bezel uses brand ink */
}
```

The frame (bezel) is the one place brand touches the preview.

---

## 8. Voice and copy

- Plain, friendly, short. Talk to a creator, not a developer, except on the setup screen where we explain API keys.
- Sentence case everywhere ("Create automation", not "Create Automation").
- No em dashes. Use a period, a comma, or a colon.
- Name things the way users see them on Instagram: "comment", "DM", "post or reel". Avoid "private reply", "webhook", "payload" in the UI.
- Errors say what happened and what to do: "Adeli didn't accept that key. Check you copied all of it, or create a new one." not "401 Unauthorized".
- Empty states have one sentence and one button.

---

## 9. Logo and assets

- Adeli logo: `adeli/apps/web/public/adeli-logo.png` (1024px PNG). Marketing variants in `landing-page/apps/adeli/public/` (`adeli-logo-512.png`, `adeli-logo-1024.png`).
- Adeli Chat lockup: Adeli logo mark + "Adeli Chat" in Inter semibold.
- Favicon: Adeli `icon.png` / `apple-icon.png` until Adeli Chat has its own mark.
- **Open:** confirm we're OK shipping the Adeli logo in a public MIT repo. Suggested approach: code is MIT, logo files are "all rights reserved, used with permission", noted in `README.md` and a `public/brand/LICENSE` file in each app. Forks must swap it.

---

## 10. `packages/ui/src/theme.css`

The top of the file is a copy of Adeli's `packages/ui/src/theme.css`, with the two wash tokens added in `@theme inline`. Below it are the base rules (from Adeli's dashboard `globals.css`) and the phone preview tokens. `apps/web` and `apps/landing-page` each import it from their `src/app/globals.css`, after Tailwind and an `@source` for `packages/ui/src`.
