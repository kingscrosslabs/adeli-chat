# Adeli Chat: Design and Brand Reference

> Status: v1 reference · Last updated: 2026-10-02
>
> Source of truth: the Adeli dashboard (`adeli/apps/web/app/globals.css`, `adeli/apps/web/components/ui/*`). The marketing site (`landing-page/apps/adeli`) is a secondary source, used only for the wordmark font and voice. If Adeli changes its tokens, update this file and `src/app/globals.css` together.

Adeli Chat should look like a room inside the Adeli dashboard: same tokens, same primitives, same calm teal-on-paper feel. A user who has an Adeli account should not be able to tell where Adeli ends and Adeli Chat begins.

**Copy rule: no em dashes anywhere** (UI text, defaults, docs, commit messages).

---

## 1. Principles

1. **One chromatic voice.** Signal Teal (`#0A807A`) is the only brand color that carries meaning. Everything else is ink, fog and white.
2. **Calm, not loud.** Thin borders, soft rings, small radii. No gradients, no glow, no stacked shadows.
3. **Tokens, not hex codes.** Components use semantic tokens (`bg-primary`, `text-muted-foreground`). Raw hex values live only in `globals.css`.
4. **Same primitives as Adeli.** shadcn `base-nova` style on Base UI. Copy Adeli's component files rather than re-styling stock shadcn.
5. **The phone preview is not branded.** It imitates Instagram's general visual language with neutral greys, scoped to its own tokens (§7).

---

## 2. Stack facts (what Adeli actually uses)

| Thing | Adeli dashboard | Adeli Chat does |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19 | Same. Next 16 uses `proxy.ts`, not `middleware.ts`. |
| CSS | Tailwind CSS v4, CSS-first config (`@theme inline` in `globals.css`), no `tailwind.config.ts` | Same. Tokens live in `src/app/globals.css`. |
| Components | shadcn CLI, style `base-nova`, primitives from `@base-ui/react` | Same `components.json` settings. |
| Icons | `lucide-react` | Same. |
| Toasts | `sonner` | Same. |
| Animation | `tw-animate-css` | Same. |
| Fonts | Inter (`--font-inter`) for UI, Geist Mono (`--font-geist-mono`) for code and keys | Same, via `next/font/google`. |

`components.json` to copy:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/app/globals.css", "baseColor": "neutral", "cssVariables": true, "prefix": "" },
  "iconLibrary": "lucide",
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "menuColor": "default",
  "menuAccent": "subtle"
}
```

Components to copy from `adeli/apps/web/components/ui/` in M0: `alert`, `avatar`, `badge`, `button`, `card`, `dropdown-menu`, `input`, `label`, `scroll-area`, `separator`, `sheet`, `skeleton`, `sonner`, `textarea`, `tooltip`. Add with the shadcn CLI (same style) when needed: `dialog`, `radio-group`, `switch`, `tabs`, `alert-dialog`.

---

## 3. Color

Light mode only in v1. The Adeli dashboard has no dark theme, so we don't ship one either. (Dark mode is a v1.1 candidate once Adeli defines it.)

### Brand palette

| Token | Hex | Role |
|---|---|---|
| `--brand-ink` | `#17312F` | Body text, headings. Deep green-black, never pure black. |
| `--brand-deep` | `#075E5A` | Text on mint surfaces, pressed states. |
| `--brand-green` | `#0A807A` | Signal Teal. Primary buttons, focus rings, links, Live dot. |
| `--brand-mint` | `#DDEDEC` | Secondary buttons, selected rows, Live pill background. |
| `--brand-fog` | `#F4F8F7` | Muted surfaces, sidebar, empty-state panels. |

### Semantic tokens

| Token | Value | Use |
|---|---|---|
| `--background` | `#FAFCFB` | Page background |
| `--foreground` | `--brand-ink` | Default text |
| `--card` / `--popover` | `#FFFFFF` | Cards, modals, menus |
| `--primary` / `--primary-foreground` | `--brand-green` / `#FFFFFF` | Main action (Go Live, Save key, Create automation) |
| `--secondary` / `--secondary-foreground` | `--brand-mint` / `--brand-deep` | Secondary action |
| `--muted` / `--muted-foreground` | `--brand-fog` / ink at 62% | Helper text, counters, placeholders |
| `--accent` / `--accent-foreground` | `--brand-mint` / `--brand-deep` | Hover and selected states |
| `--destructive` | `#A63B35` | Delete, errors, invalid fields |
| `--border` / `--input` | `#D5E3E1` | All borders and input outlines |
| `--ring` | `--brand-green` | Focus ring (used at 50% opacity, 3px) |

### Adeli Chat additions

Adeli has no warning or success color. We need them for status pills and connection states. These are new tokens, kept in the same muted register:

| Token | Hex | Use |
|---|---|---|
| `--warning` | `#8A5A00` | Paused pill text, "delayed" notices |
| `--warning-wash` | `#FCF1D9` | Paused pill background, warning alerts |
| `--success` | `--brand-deep` | Success text (reuses brand, no new green) |
| `--success-wash` | `--brand-mint` | Success backgrounds |

Contrast (WCAG AA for small text, 4.5:1): white on `#0A807A` is about 4.8:1, `#075E5A` on `#DDEDEC` about 6.3:1, `#8A5A00` on `#FCF1D9` about 5.3:1. **Do not put `#0A807A` text on mint** (about 4:1, fails). Use `--brand-deep` there.

---

## 4. Typography

| Role | Font | Size / weight |
|---|---|---|
| Page title (h1) | Inter | `text-2xl font-semibold tracking-tight` |
| Section title (editor sections A to F) | Inter | `text-base font-semibold` |
| Body, inputs | Inter | `text-sm` (inputs are `text-base` on mobile to stop iOS zoom, `md:text-sm`) |
| Helper text, counters | Inter | `text-xs text-muted-foreground` |
| API keys, ids, code | Geist Mono | `font-mono text-[0.82rem]` |
| Wordmark only | Jersey 10 | Used for the "Adeli Chat" lockup on `/login` and `/setup`. Nowhere else. |

Jersey 10 is the pixel font from the Adeli marketing site. It is a brand accent, not a UI font: never for buttons, labels or body text.

---

## 5. Shape, space, elevation

- **Radius:** `--radius: 0.625rem` (10px). Derived scale: `sm` 6px, `md` 8px, `lg` 10px, `xl` 14px. Buttons and inputs use `rounded-lg`, cards use `rounded-xl`, pills use `rounded-4xl`.
- **Spacing:** Tailwind 4px scale. Cards use `--card-spacing: 16px` (12px for `size="sm"`). Editor sections are separated by `gap-6`.
- **Elevation:** cards use a hairline ring (`ring-1 ring-foreground/10`), not a shadow. Modals and popovers may use one soft shadow. Never stack shadows.
- **Focus:** every interactive element shows `focus-visible:ring-3 ring-ring/50`. Do not remove it.

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
- Adeli Chat lockup: Adeli logo mark + "Adeli Chat" in Jersey 10.
- Favicon: Adeli `icon.png` / `apple-icon.png` until Adeli Chat has its own mark.
- **Open:** confirm we're OK shipping the Adeli logo in a public MIT repo. Suggested approach: code is MIT, logo files are "all rights reserved, used with permission", noted in `README.md` and a `public/brand/LICENSE` file. Forks must swap it.

---

## 10. `src/app/globals.css` (copy in M0)

This is Adeli's file with the docs-only rules removed and the Adeli Chat additions marked.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@theme inline {
  --color-brand-ink: var(--brand-ink);
  --color-brand-deep: var(--brand-deep);
  --color-brand-green: var(--brand-green);
  --color-brand-mint: var(--brand-mint);
  --color-brand-fog: var(--brand-fog);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --font-wordmark: var(--font-jersey);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  /* Adeli Chat additions */
  --color-warning: var(--warning);
  --color-warning-wash: var(--warning-wash);
  --color-success: var(--success);
  --color-success-wash: var(--success-wash);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  --brand-ink: #17312F;
  --brand-deep: #075E5A;
  --brand-green: #0A807A;
  --brand-mint: #DDEDEC;
  --brand-fog: #F4F8F7;
  --background: #FAFCFB;
  --foreground: var(--brand-ink);
  --card: #FFFFFF;
  --card-foreground: var(--brand-ink);
  --popover: #FFFFFF;
  --popover-foreground: var(--brand-ink);
  --primary: var(--brand-green);
  --primary-foreground: #FFFFFF;
  --secondary: var(--brand-mint);
  --secondary-foreground: var(--brand-deep);
  --muted: var(--brand-fog);
  --muted-foreground: color-mix(in srgb, var(--brand-ink) 62%, #FFFFFF);
  --accent: var(--brand-mint);
  --accent-foreground: var(--brand-deep);
  --destructive: #A63B35;
  --border: #D5E3E1;
  --input: #D5E3E1;
  --ring: var(--brand-green);
  --radius: 0.625rem;
  --sidebar: #F4F8F7;
  --sidebar-foreground: var(--brand-ink);
  --sidebar-primary: var(--brand-green);
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: var(--brand-mint);
  --sidebar-accent-foreground: var(--brand-deep);
  --sidebar-border: #D5E3E1;
  --sidebar-ring: var(--brand-green);
  /* Adeli Chat additions */
  --warning: #8A5A00;
  --warning-wash: #FCF1D9;
  --success: var(--brand-deep);
  --success-wash: var(--brand-mint);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

Fonts in `src/app/layout.tsx`:

```tsx
import { Geist_Mono, Inter, Jersey_10 } from "next/font/google";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const jersey = Jersey_10({ variable: "--font-jersey", weight: "400", subsets: ["latin"] });
```
