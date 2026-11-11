# LedaChat: Brand

> Status: v2.0 · Last updated: 2026-11-11
>
> LedaChat's own brand: name, logo, colours, voice. How the colours become tokens and components is in [`design.md`](design.md). Both started as copies of Adeli's `BRAND.md` and `DESIGN.md` and no longer track them.

**Copy rule: no em dashes anywhere** (UI text, defaults, docs, commit messages).

---

## 1. Name and domain

| Thing | Value |
|---|---|
| Product name | **LedaChat**, one word, capital L and C. Never "Leda Chat", "Ledachat" or "LEDACHAT" in prose. |
| Marketing site | `https://ledachat.com` (`apps/landing-page`) |
| App | its own deployment (`apps/web`), linked from the site through `APP_URL` |
| Support and feature requests | `hello@ledachat.com` |
| Code identifiers | lowercase `ledachat` (MCP server name, theme storage key). The workspace packages stay `@adeli-chat/*` and the repo stays `kingscrosslabs/adeli-chat` until we rename them on purpose. |

LedaChat is built by King's Cross Labs and runs on the [Adeli](https://www.tryadeli.com/) API. Adeli is credited, not co-branded (section 6).

---

## 2. Personality

Friendly, fast, a little playful. The mark is a chomper eating comments and turning them into DMs. LedaChat is for creators first, so it should feel lighter than a developer tool, while staying clean: flat surfaces, thin borders, sharp corners (`design.md`).

---

## 3. Colour

Two brand colours, with a blended range between them. Hex values live only in `packages/ui/src/theme.css`; components use tokens (`design.md` section 3).

| Name | Hex | Role |
|---|---|---|
| **Leda Purple** | `#702EC7` | Primary. Fills the main button, the Live dot, selected states, the logo tile. White text on it passes AA (7.2:1). |
| **Leda Pink** | `#F90EF5` | Secondary. Highlights: small badges, emphasis marks, a pellet of colour. Text on a pink fill is **Leda Ink**, never white (white is 3.3:1). |
| Leda Ink | `#1C1426` | Body text in light mode, the phone bezel, text on pink. |
| Paper | `#FFFFFF` | The default background. |

### The blend (purple to pink)

| Name | Hex | Mix |
|---|---|---|
| Violet | `#9226D3` | 25% pink |
| Orchid | `#B41EDE` | 50% pink |
| Fuchsia | `#D716EA` | 75% pink |

Use the blend for charts and illustration, not for UI chrome.

### Scales

Each brand colour has a 50 to 950 scale, tinted towards white and shaded towards black from the 500 step, the way Adeli's brand files built theirs. Tailwind exposes them as `leda-purple-*` and `leda-pink-*`.

| Step | Purple | Pink |
|---|---|---|
| 50 | `#F6F2FC` | `#FFF1FE` |
| 100 | `#ECE4F8` | `#FEE0FE` |
| 200 | `#D7C4EF` | `#FDBCFC` |
| 300 | `#B896E3` | `#FC86FA` |
| 400 | `#9462D5` | `#FA4AF8` |
| **500** | **`#702EC7`** | **`#F90EF5`** |
| 600 | `#5E27A7` | `#D10CCE` |
| 700 | `#4C1F87` | `#A90AA7` |
| 800 | `#381764` | `#7C077A` |
| 900 | `#240F40` | `#50044E` |
| 950 | `#160928` | `#320331` |

Text-safe picks: purple 500 and darker on white; pink **700** (`#A90AA7`, 6.4:1) for pink text on white; purple 300 and pink 300 for coloured text on the dark background.

### Light first

LedaChat defaults to **light** (Paper). Dark (Night Plum) is available from the theme toggle, and System follows the device.

---

## 4. Logo

The mark is a white **chomper** (a disc with a quarter cut out) on a Leda Purple square. The mouth opens to the top right, so the cut reads as the letter **L**.

- Source: `packages/ui/src/brand/ledachat-logo.tsx` (SVG, `LedaChatLogo`). Raster copy: [`docs/ledachat-logo.png`](ledachat-logo.png).
- Favicons: `apps/*/src/app/icon.png` and `apple-icon.png`, 1024px, full-bleed purple (the OS rounds the corners).
- Lockup: mark + "LedaChat" in Inter semibold, tracking tight (`Wordmark`, `packages/ui/src/brand/wordmark.tsx`).
- Geometry (24 unit grid): disc radius 7.5, centred at (12.7, 11.3), nudged up and right so the missing quarter doesn't make the mark look off-centre.
- Don't recolour the mark, rotate the mouth, add an eye, or put it on pink.

---

## 5. Voice and copy

- Plain, friendly, short. Talk to a creator, not a developer, except in setup docs where we explain API keys.
- Sentence case everywhere ("Create automation", not "Create Automation").
- No em dashes. Use a period, a comma, or a colon.
- Name things the way users see them on Instagram: "comment", "DM", "post or reel". Avoid "private reply", "webhook", "payload" in the UI.
- Errors say what happened and what to do: "Adeli didn't accept that key. Check you copied all of it, or create a new one." not "401 Unauthorized".
- Empty states have one sentence and one button.

---

## 6. Adeli, credited

- Every mention of Adeli on the marketing site is a link to `https://www.tryadeli.com/` with UTMs (`utm_source=ledachat.com`, `utm_medium=referral`, `utm_campaign=ledachat-landing`, `utm_content=<spot>`). Build them with the `utm-link` skill in company-brain and log them in `gtm/utm/links.csv`. The links live in `apps/landing-page/src/lib/links.ts`.
- Adeli's logo is the **arrow** mark (`apps/landing-page/public/brand/adeli-logo.png`, from Adeli's marketing site), not the old plant mark. Show it at its own colours, never in LedaChat purple.
- **Open:** confirm we're OK shipping the Adeli logo in a public MIT repo. Suggested: code is MIT, logo files are "all rights reserved, used with permission", noted in `README.md`.
