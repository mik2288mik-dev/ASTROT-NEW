# Doodle / Diary Redesign — living plan

Hand-drawn "personal diary, fun & doodle" re-skin of the whole app.
**Structure stays** (the fitness-reference layout we already built); this is a **re-skin only — logic/routing/services untouched.**

## Locked direction (confirmed with the user)
- **Base:** white paper `#FFFFFF` + faint dot grid. Black ink `#20242A`. Bright marker accents.
- **Type:** headings handwritten (Caveat); **long AI texts stay in a clean readable font** (Manrope). Small labels may use Neucha.
- **Hand-drawn borders:** **selective** — only on hero + cards; everything else clean, with doodle accents (stars, underlines, scribble-circles, washi tape).

## Design tokens
- Fonts: `Caveat` (display) · `Neucha` (small hand labels) · `Manrope` (body, already loaded). Cyrillic subsets required.
- Colors: ink `#20242A`, paper `#FFFFFF`, muted `#7C7770`. Markers: hl `#FFE36E`, coral `#FF6B6B`, blue `#4DA6FF`, violet `#9B7FD6`, green `#54C28A`, pink `#FF8FC4`. Sticky fills: yellow `#FFE6A0`, blue `#CFE6F7`, violet `#EFE8FC`, pink `#FFD3E6`, green `#D8F0E2`.
- Rough borders: one shared SVG `feTurbulence`+`feDisplacementMap` filter, mounted once (`DoodleDefs`), referenced by id. Selective use only. Perf-check in Telegram webview; bake to static paths if needed.

## Primitives (`components/doodle/`)
`DoodleDefs` (global filters) · `RoughBorder` / `RoughCard` · `Marker` (highlight) · `Underline` · `WashiPhoto` (polaroid avatar + tape) · `ScribbleSelect` (hand-drawn active ring) · `DoodleArt` (celestial scenes: sky/planet/sun/star).

## Phases
- **0 — Design kit:** fonts, tailwind tokens, `.doodle-paper`, DoodleDefs, primitives. ← foundation
- **1 — Home (Dashboard):** header (washi avatar + handwritten greeting), hero (rough frame + marker title + celestial doodles), day strip (clean + scribble today), "Твой план" hand title + underline, plan cards as sticky RoughCards, pink quick-actions.
- **2 — Bottom nav + shared scroll header + Stories viewer:** sketch icons, paper active circle, doodle back arrow.
- **3 — Horoscope** (`Horoscope.tsx` + `HoroscopeStories`): sign header doodle, sticky sections, **clean body**, paper story slides.
- **4 — Personal day** (`DailyContentScreens`, `PersonalDailyStories`, `DaySheet`): diary-entry layout, handwritten date, notebook blocks.
- **5 — Natal chart** (`NatalChart` + `NatalReading/*`): hand-drawn wheel, sticky planet/house list, **clean reading body**, handwritten section labels.
- **6 — Synastry:** two polaroids + connecting doodle, scorecard with rough gauge.
- **7 — Ask Lumia** (`OracleChat`): speech-bubble note bubbles, margin-line input, Lumia doodle avatar.
- **8 — Onboarding / natal setup** (`Onboarding`): diary cover, notebook-line fields, doodle progress.
- **9 — Settings / MyCharts / Paywall** (`Settings`, `MyCharts`, `Paywall`, `PremiumPreview`): checklist rows, taped chart cards, sticker-pack paywall.
- **10 — Polish:** scattered stickers, tap wobble, `prefers-reduced-motion`, perf + consistency audit.

## Hard constraints
Do not touch App.tsx logic, ViewState/routing, auth, premium logic, natal calc, services, API, Telegram integration. Visual layer only.
