---
name: Cozy Ramen
description: >
  Warm, cozy, kawaii visual identity for birthday-greeting pages. A cream-and-coral
  base with a soft-blue kitsune accent (a nod to a blue-haired fox-girl), paper
  lanterns, rising ramen steam and sticker-style cards. Reads warm and tender, never cold.
colors:
  cream: "#FFF7ED"
  surface: "#FFFDF9"
  primary: "#FF8A65"
  primaryDeep: "#F4673B"
  secondary: "#7EC2E8"
  secondaryDeep: "#4FA3D1"
  lantern: "#E8543E"
  lanternGlow: "#FFB27A"
  ramenGold: "#F2B441"
  nestGreen: "#9CCB6A"
  text: "#5A3E2B"
  textSoft: "#8A6F5C"
  muted: "#EAD9C5"
  success: "#5C8A3A"
  onPrimary: "#FFFFFF"
typography:
  display:
    fontFamily: Comfortaa
    fontSize: "3.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  h1:
    fontFamily: Comfortaa
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.15
  h2:
    fontFamily: Comfortaa
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
  h3:
    fontFamily: Comfortaa
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  bodyLg:
    fontFamily: Nunito
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: Nunito
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  bodySm:
    fontFamily: Nunito
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Nunito
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  sm: "12px"
  md: "20px"
  lg: "28px"
  xl: "36px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  xxl: "64px"
components:
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  buttonPrimary:
    backgroundColor: "{colors.primaryDeep}"
    textColor: "{colors.onPrimary}"
    rounded: "{rounded.full}"
    padding: "{spacing.md}"
    typography: "{typography.label}"
  buttonSecondary:
    backgroundColor: "{colors.secondaryDeep}"
    textColor: "{colors.onPrimary}"
    rounded: "{rounded.full}"
    padding: "{spacing.md}"
  chip:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
---

# Cozy Ramen

## Overview

Cozy Ramen is the warm, tender, faintly kawaii identity for personal birthday pages.
The feeling is a steaming bowl of ramen on a soft evening: cream paper, coral warmth,
swaying paper lanterns, and a single cool **soft-blue** accent that nods to the
birthday person (a blue-haired kitsune). Everything is rounded, padded and sticker-like.
The page should make someone smile before they read a word.

Principles:
- **Warm by construction.** Cream background + cocoa-brown text keep the whole palette in
  the red/yellow family. The one cool note — soft blue — appears only in small accents.
- **Soft, never sharp.** Big radii, pillow shadows, pill buttons. No hard edges, no pure black.
- **Playful, not noisy.** Decoration (steam, lanterns, particles) stays low-density and gentle;
  it breathes, it doesn't snow.

## Colors

Warm cozy base with a soft-blue secondary accent.

- `cream` `#FFF7ED` — main paper background (warm, not white).
- `surface` `#FFFDF9` — cards / stickers floating above the background.
- `primary` `#FF8A65` — coral/peach, the signature warmth; accents, glows, highlights.
- `primaryDeep` `#F4673B` — coral for hover/active and white-on-coral buttons.
- `secondary` `#7EC2E8` — soft blue, the kitsune-hair accent (the per-friend overridable color).
- `secondaryDeep` `#4FA3D1` — stronger blue for icons / links.
- `lantern` `#E8543E` — paper-lantern red-orange; torii warmth.
- `lanternGlow` `#FFB27A` — warm glow stop inside lanterns.
- `ramenGold` `#F2B441` — broth gold; star particles; sparkle.
- `nestGreen` `#9CCB6A` — noodle-nest green (the Instant Ramen gift); soft matcha.
- `text` `#5A3E2B` — warm cocoa brown body text (never pure black).
- `textSoft` `#8A6F5C` — secondary text, captions.
- `muted` `#EAD9C5` — warm beige borders, dividers, disabled.
- `success` `#5C8A3A` — confirmations.

Per-friend theming overrides a single `--color-accent` (default = `secondary`), so each
friend's page can carry their own color without touching anything else.

## Typography

- **Display / headings:** `Comfortaa` — geometric rounded, maximally cozy/kawaii, full
  Cyrillic. Weight 700.
- **Body:** `Nunito` — soft rounded terminals, very readable, full Cyrillic. Weights 400/700.

Scale is modular (~1.25). Headings tighten letter-spacing slightly; labels use wide tracking
and uppercase for sticker-badge captions.

> satori (OG image) needs **static** TTF instances with full charset in ONE file — variable
> fonts crash its opentype parser and per-subset files break Cyrillic fallback. The backend
> ships fonttools-instanced `Comfortaa-700.ttf` / `Nunito-400.ttf` / `Nunito-700.ttf`. The
> browser uses `@fontsource` woff2 of the same families.

## Layout & Spacing

4px-based scale: `xs 4` · `sm 8` · `md 16` · `lg 24` · `xl 40` · `xxl 64`. Generous padding;
content sits in roomy sticker cards with breathing space. Single-column, centered,
mobile-first; the page is one warm scroll, not a dense dashboard.

## Elevation & Depth

Soft, warm shadows — tinted cocoa/coral, never grey-black, so they never chill the palette.

- `shadow-sm` `0 2px 8px rgba(90,62,43,0.08)`
- `shadow-md` `0 8px 24px rgba(90,62,43,0.10)`
- `shadow-lg` `0 16px 40px rgba(90,62,43,0.12)`
- `shadow-glow` `0 0 32px rgba(255,138,101,0.35)` — coral glow for CTAs / lanterns.
- `shadow-sticker` `0 6px 0 rgba(232,84,62,0.18)` — hard offset (no blur) = peeled-sticker lift.

## Shapes

Pill-ish, plump silhouettes. Buttons and avatars are fully round (`full`). Cards use `lg`
(28px), hero blocks `xl` (36px). The recurring motif is the "die-cut sticker": a thick light
border around a rounded surface, lifting slightly on hover.

## Components

- **card** — surface background, cocoa text, `lg` radius, soft `shadow-md`. The workhorse.
- **buttonPrimary** — `primaryDeep` background, white text, pill, label typography, `shadow-glow` on hover.
- **buttonSecondary** — `secondaryDeep` (kitsune blue) pill button for secondary actions.
- **chip** — small cream pill for tags/metadata (date, gift name, score).
- **sticker card** — card + `3px solid #FFFFFF` border (die-cut look) + optional `shadow-sticker`;
  on hover `scale(1.02) rotate(-1deg)`.

Signature decorative elements:
1. **Rising steam** — 3–4 soft white wavy SVG paths above the hero/bowl, `translateY` + fade,
   staggered delays, slight blur. Respect `prefers-reduced-motion`.
2. **Swaying paper lanterns** — a row of `lantern` bodies with `lanternGlow` radial centers and
   `ramenGold` tassels, pendulum `rotate(-4deg ↔ 4deg)`, `transform-origin: top center`, offset delays.
3. **Floating particles** — small `ramenGold` stars and noodle/`nestGreen` curls drifting upward
   with gentle horizontal sway and rotation. Low density (8–14).
4. **Sticker cards** — thick light border, plump radius, lift on hover.

## Do's and Don'ts

- Do keep the background warm cream and text warm cocoa — never pure white / pure black.
- Do use soft blue sparingly (one accent), so the page stays warm.
- Do keep motion gentle and low-density; honor `prefers-reduced-motion`.
- Don't use sharp corners, cold grey shadows, or neon blue.
- Don't crowd the screen with particles — cozy, not a snowstorm.
- Don't introduce a second display font; Comfortaa + Nunito only.
