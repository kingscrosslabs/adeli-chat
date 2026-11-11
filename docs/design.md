# LedaChat: Design System

> Status: v2.0 · Last updated: 2026-11-11
>
> How LedaChat's brand ([`brand.md`](brand.md)) turns into tokens and components, for `apps/web` and `apps/landing-page`. Tokens live in `packages/ui/src/theme.css`; this file explains them. It started as a copy of Adeli's `DESIGN.md` and is now our own: when the two disagree, this file wins for LedaChat.

**Copy rule: no em dashes anywhere** (UI text, defaults, docs, commit messages).

---

## 1. Principles

1. **Purple acts, pink sparkles.** Leda Purple carries meaning (the main action, Live, selection). Leda Pink is for highlights only, never for an action or a status.
2. **Light first.** Paper white working areas, lilac frames. Dark is an option, not the default.
3. **Calm surfaces.** Thin borders, soft rings, small radii. No stacked shadows, no glow. No gradients in UI chrome.
4. **Tokens, not hex codes.** Components use semantic tokens (`bg-primary`, `text-muted-foreground`, `text-highlight-text`). Raw hex values live only in `packages/ui/src/theme.css` and the logo component.
5. **The phone preview is not branded.** It imitates Instagram's general visual language with neutral greys, scoped to its own tokens (section 7).

---

## 2. Stack

| Thing | LedaChat |
|---|---|
| Framework | Next.js 16 (App Router), React 19. Next 16 uses `proxy.ts`, not `middleware.ts`. |
| CSS | Tailwind CSS v4, CSS-first (`@theme inline`), no `tailwind.config.ts`. Tokens in `packages/ui/src/theme.css`; each app's `globals.css` imports it. |
| Components | shadcn CLI, style `base-nova`, primitives from `@base-ui/react`, in `packages/ui/src/components`. Run the CLI from `packages/ui`. |
| Icons | `lucide-react`; third-party brand marks from `react-icons`. |
| Toasts | `sonner` |
| Animation | `tw-animate-css` |
| Fonts | Inter (`--font-inter`) for UI, Geist Mono (`--font-geist-mono`) for code and keys, via `next/font/google`. |
| Theme | `next-themes`, `defaultTheme="light"`, `storageKey="ledachat-theme"`, `.dark` class on `<html>`. Toggle: `packages/ui/src/theme-toggle.tsx`. |

---

## 3. Colour tokens

Two themes: **Lilac Paper** (light, default) on `:root`, **Night Plum** (dark) on `.dark`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#FFFFFF` | `#130C1F` | Page |
| `foreground` | `#1C1426` | `#ECE6F5` | Body text |
| `card`, `popover` | `#FFFFFF` | `#1B1329` | Raised surfaces |
| `primary` | `#702EC7` | `#702EC7` | Main button, Live dot, selection. Text on it: `primary-foreground` `#FFFFFF` |
| `secondary` | `#ECE4F8` | `#241935` | Secondary buttons, user chat bubbles, Live pill |
| `muted` | `#F7F3FD` | `#20172F` | Bands, table heads |
| `muted-foreground` | `#625A70` | `#9C93AD` | Helper text (6.5:1 on white) |
| `accent` | `#F6F2FC` | `#2A1D3F` | Hover rows, menus |
| `link` | `#702EC7` | `#B896E3` | Purple text and icons |
| `highlight` | `#F90EF5` | `#F90EF5` | Pink fills. Text on it: `highlight-foreground` `#1C1426` |
| `highlight-text` | `#A90AA7` | `#FC86FA` | Pink text that passes AA |
| `border` | `#E6DDF3` | `#2E2242` | Hairlines |
| `input` | `#D0C0EA` | `#3C2D55` | Field borders |
| `ring` | `#702EC7` | `#9462D5` | Focus rings |
| `destructive`, `success`, `warning` | `#A63B35`, `#1D7A4C`, `#8A5A00` | `#F08A7E`, `#5FD39B`, `#F0C25E` | Status, as text on a tint |
| `chart-1` to `chart-5` | purple, pink, orchid, ink, purple 300 | purple 400, pink 400, orchid, fog, muted | Charts |
| `sidebar` | `#F6F2FC` | `#160E24` | App sidebar |

Washes (`@theme inline`): `warning-wash`, `success-wash` (14%) and `highlight-wash` (12% pink) for pill and banner backgrounds.

Brand scales are available as `leda-purple-50` to `leda-purple-950`, `leda-pink-50` to `leda-pink-950`, plus `leda-violet`, `leda-orchid`, `leda-fuchsia` (values in `brand.md` section 3). Use a scale step only when no semantic token fits.

Rules:

- **Purple fills, purple text is `text-link`.** Not `text-primary`, so dark mode gets the lighter purple.
- **Pink text is `text-highlight-text`.** Never raw pink 500 on white (3.3:1).
- **Text on a pink fill is ink** (`text-highlight-foreground`), in both themes.
- **One primary button per view.**
- **Status is `success`, `warning`, `destructive`**, as text on a wash, never a solid fill.
- **Tokens, not palette colours.** `bg-card`, not `bg-white`. The phone preview and third-party logo tiles are the exceptions.

---

## 4. Typography

| Role | Font | Size / weight |
|---|---|---|
| Landing h1 | Inter | `text-4xl md:text-5xl font-semibold tracking-tight` |
| Section title (landing h2) | Inter | `text-2xl md:text-3xl font-semibold tracking-tight`, **centred** with its lead |
| Page title (app h1) | Inter | `text-2xl font-semibold tracking-tight` |
| Section title (editor) | Inter | `text-base font-semibold` |
| Body, inputs | Inter | `text-sm` (inputs are `text-base` on mobile to stop iOS zoom, `md:text-sm`) |
| Helper text, counters | Inter | `text-xs text-muted-foreground` |
| API keys, ids, code | Geist Mono | `font-mono text-[0.82rem]` |
| Wordmark | Inter | `font-semibold tracking-tight`, beside the mark |

---

## 5. Shape, space, elevation

- **Radius:** a sharp scale. `rounded-lg` (buttons, inputs) is 3px, `rounded-xl` (cards, menus) is 4px, nothing rounds past 6px. `rounded-full` is for avatars, dots and spinners only; badges are `rounded-md`.
- **Spacing:** Tailwind 4px scale. Landing sections are `max-w-5xl`; Settings and Connect to AI Agent are `max-w-3xl`.
- **Elevation:** none. Every `shadow-*` resolves to nothing; surfaces separate with a hairline border or a fill.
- **Focus:** every interactive element shows a visible `ring`. Do not remove it.
- **Third-party logos** (Claude, ChatGPT, Cursor, Perplexity, Grok Bot) keep their owners' colours: a tile in the brand colour with a white mark.

---

## 6. Components

### Buttons

| Variant | Use |
|---|---|
| `default` | One per view: Start free, Go live, Create automation, Connect Instagram |
| `outline` | Save, Reconnect, View on GitHub |
| `secondary` | Add reply, Load more |
| `ghost` | Row actions, icon buttons, Sign in in the header |
| `destructive` | Delete, Disconnect (always behind a confirm dialog) |
| `link` | Inline links |

Sizes: `default` is 32px tall, `lg` 36px. Use `lg` for the primary action in page headers and the hero.

### Status pills

| Status | Classes | Extra |
|---|---|---|
| Draft | `bg-muted text-muted-foreground` | none |
| Live | `variant="secondary"` | 6px dot in `bg-primary` with `animate-pulse` (respects `prefers-reduced-motion`) |
| Paused | `bg-warning-wash text-warning` | none |
| Needs reconnect | `bg-warning-wash text-warning` | lucide `AlertTriangle` |

### Inputs and forms

- Errors set `aria-invalid`, which turns the border `destructive` with a soft ring, plus a one-line `text-xs text-destructive` message below.
- Character counters sit bottom-right in `text-xs text-muted-foreground`, turning `text-destructive` past the limit.
- Keyword chips: `badge variant="secondary"` with a ghost × button.

### Cards and panels

- Selected post tile: `ring-2 ring-primary` plus a check badge.
- Featured pricing card: `ring-2 ring-primary`.
- "Coming soon" cards: `opacity-60`, `badge variant="outline"`, not focusable.

### Copy-to-clipboard

Anything a visitor is meant to paste (sample prompts, commands, tokens) gets a copy button that swaps its icon to a check and says "Copied" for screen readers.

### App shell

Left sidebar (`sidebar` lilac background) with Automations and Settings, header bar on content. The sidebar footer shows the connected Instagram handle and avatar.

---

## 7. Phone preview tokens

The preview imitates Instagram's general layout. No Meta logos, icons or copied assets. Scoped to `.phone-preview`:

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
  --pv-frame: #1C1426;         /* the phone bezel uses Leda Ink */
}
```

The bezel is the one place the brand touches the preview.

---

## 8. `packages/ui/src/theme.css`

`@theme inline` maps the CSS variables to Tailwind colours and adds the washes, brand scales, fonts, the sharp radius scale and the flat shadows. `:root` holds Lilac Paper, `.dark` Night Plum. Below them are the base rules (borders, cursor on clickable things), the phone preview tokens and the reduced-motion rule. `apps/web` and `apps/landing-page` each import it from their `src/app/globals.css`, after Tailwind and an `@source` for `packages/ui/src`.
