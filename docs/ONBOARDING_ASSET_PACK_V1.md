# Onboarding Asset Pack V1

Project: «Твой Гороскоп» / Your Horoscope / Tu Horóscopo
Status: visual production brief locked for first implementation.

## 1. Locked direction

Use the existing visual language of the project:

- original drawn editorial illustration for a modern colourful lifestyle magazine;
- clearly illustrated, never photographic and never 3D/CGI;
- bright white or milk-white interface base;
- saturated adult colour fields, usually 2–3 main colours per scene;
- paper layers, cut-paper depth, print texture, halftone and light grain;
- realistic-proportioned illustrated animals or expressive object scenes;
- no astrology-shop mysticism and no dark cosmic background as the base;
- no beige luxury-photography look;
- no phone mockups, fake interface screenshots or text inside images;
- native UI renders all headings, controls, progress and legal links.

The onboarding must look like the same product as the main app, not like a separate astrology template.

## 2. Runtime format

Create five text-free master illustrations.

- master: 2400×3200 px, sRGB;
- runtime: 1200×1600 WEBP;
- optional tablet crop: 2400×1800;
- important objects stay at least 10% from edges;
- lower 44% must contain a calm text-safe area;
- no status bars, buttons, frames, logos, letters, numbers or zodiac labels;
- each image must still work with RU, EN and ES text lengths;
- every asset must be registered through the project asset manifest/resolver, never hardcoded by a random path.

## 3. Colour system

The set must feel related but not monochrome.

1. Welcome: cobalt blue + warm yellow + coral accent.
2. Product universe: green + cream + electric blue accent.
3. Path choice: orange + deep blue + white.
4. Personal data: turquoise + red-orange + cream.
5. Calculation/reveal: yellow + blue + green accent.

Avoid pink-purple astrology gradients as the dominant palette.

## 4. Screen assets

### Asset 01 — `onboarding_welcome_v1.webp`

Purpose: first promise — the app speaks clearly and personally.

Scene:
A modern illustrated breakfast/work table seen at a slight angle. On the right, a believable illustrated cat has pushed aside several generic newspaper-like sheets and looks directly toward an empty coloured paper panel. The panel is blank and becomes the native text zone. A cup, pencil and one folded page create movement, but the composition remains clean.

Focal point: right-middle.
Text-safe zone: left-lower and centre-lower.
Mood: confident, curious, alive.

Forbidden:
Stars, zodiac wheel, galaxy, crystal, moon phases, literal horoscope text, photorealism, beige-only palette.

### Asset 02 — `onboarding_product_universe_v1.webp`

Purpose: show that the app contains several useful products without making a feature grid.

Scene:
A layered editorial desk composition with five differently shaped paper objects suggesting different parts of life: a calendar sheet, two overlapping profile silhouettes, a folded map-like paper, a round diagram without astrology symbols, and a small question card. A capybara or cat moves between layers as if arranging them. No labels or icons are embedded.

Focal point: upper-right / centre-right.
Text-safe zone: lower-left.
Mood: rich, colourful, organised rather than mystical.

Forbidden:
Dashboard screenshot, app cards copied into the picture, zodiac icons, hearts as the main symbol, fortune-teller props.

### Asset 03 — `onboarding_path_choice_v1.webp`

Purpose: support the real interactive choice between Personal and Zodiac paths.

Scene:
One illustrated path splits into two visually different paper routes. The left route leads toward a personalised notebook with an abstract fingerprint-like line pattern. The right route leads toward a colourful circular set of twelve abstract segments, without zodiac glyphs. A small realistic sticker-style cat stands at the split and looks between them.

Focal point: upper-middle.
Text-safe zone: lower half for two native choice controls.
Mood: playful decision, no pressure.

Forbidden:
Literal road signs with text, glowing portals, galaxy, magical fog, embedded buttons.

### Asset 04 — `onboarding_birth_data_v1.webp`

Purpose: make date, time and place feel understandable and safe, not bureaucratic.

Scene:
Three tactile paper objects form one coherent composition: a calendar corner, a simple clock face without numbers, and a folded city map with a location pin shape. A cat paw gently holds the map in place. The objects are illustrative metaphors only; all real fields remain native UI.

Focal point: upper-right.
Text-safe zone: lower-centre.
Mood: clear, calm, trustworthy.

Forbidden:
Passport documents, personal data printed in the image, medical look, dark background, mystical chart.

### Asset 05 — `onboarding_calculation_v1.webp`

Purpose: support a real loading/reveal state.

Scene:
Several colourful paper layers align into one finished editorial composition. At first glance the pieces look separate; toward the top they lock together into a clean circular pattern. A capybara or cat watches the final piece settle into place. No fake progress bars or text in the asset.

Focal point: upper-middle.
Text-safe zone: lower 45% for real progress states.
Mood: satisfying completion, quick and modern.

Forbidden:
Natal chart screenshot, glowing phone, cosmic explosion, fake checklist, fake percentage.

## 5. Shared generation block

```text
Создай оригинальную рисованную цветную editorial-иллюстрацию для мобильного приложения «Твой Гороскоп».

Это иллюстрация для современного яркого lifestyle-журнала: явно рисованная, не фотография, не фотореализм, не 3D и не CGI. Используй крупные насыщенные цветовые плоскости, бумажные слои, мягкую аэрографическую светотень, лёгкую печатную фактуру, halftone и аккуратное журнальное зерно. Животные стилизованные, но анатомически правдоподобные.

Изображение является фоном интерфейса. Оставь большую спокойную зону под программный текст и элементы управления. На изображении не должно быть текста, букв, цифр, дат, логотипов, кнопок, рамок, интерфейса, телефона или системных полосок.

Не использовать галактики, тёмный космос, магический дым, кристаллы, свечи, гадальные столы, дешёвую эзотерику, бежевую фотосъёмку, аниме, детскую мультяшность, бренды и копии чужого интерфейса.
```

## 6. Review gates

Reject and regenerate when:

- the image could belong to any generic astrology app;
- the scene looks photographic, 3D or like stock art;
- the set becomes mostly beige, purple or dark navy;
- the main object overlaps the native text zone;
- embedded symbols try to explain the UI instead of supporting it;
- the animal looks cartoon-childish or has human anatomy;
- the image works only as a poster but not as a responsive UI background;
- RU/EN/ES text cannot fit without covering the scene.

## 7. Implementation rule

The image layer and UI layer are independent. Product implementation must be completed with temporary colour/shape fallbacks so final assets can be replaced without changing onboarding logic, analytics, localization or navigation.
