# NEBO home topic raster assets

Generated on 2026-09-08 with the built-in `image_gen.imagegen` tool. No API keys, CLI fallback, stock images, or source-code changes were used.

Four independent object assets. The notebook remains available after the later reference update introduced a separate career briefcase; it was not overwritten.

## Delivery

| Asset | Intended use | Dimensions | Bytes | Fully transparent pixels |
| --- | --- | --- | ---: | ---: |
| `home-heart-v1.webp` | Отношения — розовое сердце | 384 × 384, RGBA | 14002 | 55.07% |
| `home-notebook-v1.webp` | Дела — голубой блокнот с ручкой; retained for a later everyday-tasks slot | 384 × 384, RGBA | 18064 | 54.65% |
| `home-flower-v1.webp` | Для себя / самочувствие — лавандовый керамический цветок | 384 × 384, RGBA | 17194 | 59.13% |
| `home-briefcase-v1.webp` | Карьера и финансы — синий кожаный портфель | 384 × 384, RGBA | 23786 | 30.61% |

All delivered files have genuine alpha spanning 0–255. They were inspected individually and at 50 × 50 pixels. The originals remain in the built-in generated-images directory.

Conversion only: `sharp(source).resize(384, 384, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90, alphaQuality: 100, effort: 6 })`. No cropping, painting, compositing, masking, background removal, or other programmatic image edits were performed. The 50px inspection thumbnails existed in memory only.

## Sources and provenance

Source directory: `C:/Users/user/.codex/generated_images/01a08071-9497-7662-9bdd-70a6f05d7d0b/`. Selected originals are 1254 × 1254 PNGs.

### home-heart-v1

- Source: `C:/Users/user/.codex/generated_images/01a08071-9497-7662-9bdd-70a6f05d7d0b/exec-349d4b42-119b-4192-9229-05c6a55f14ca.png`
- Source SHA-256: `a35079b8fe86fa926dfda2c9c2e96c7e00339130a926a28a602999fafcb7be11`
- Delivered WebP SHA-256: `e5bd618a0109b2c09b0e93e019de9a318ed1bc427652e6a7b2978405d45786e9`

### home-notebook-v1

- Source: `C:/Users/user/.codex/generated_images/01a08071-9497-7662-9bdd-70a6f05d7d0b/exec-e6cc282b-ae70-48fc-bc0a-d4864da1113b.png`
- Source SHA-256: `bc5272f53d487ce7e1e6365c3c4e8bc33ff842ec10d4f4295ec4a67ce1b8f35d`
- Delivered WebP SHA-256: `435e9f05a3024111dc198734170470b5ba98ff3fee8003982845e30d3e9a373f`

### home-flower-v1

- Source: `C:/Users/user/.codex/generated_images/01a08071-9497-7662-9bdd-70a6f05d7d0b/exec-33939416-f845-4f28-8045-5a09ce0e3899.png`
- Source SHA-256: `359e5db6399db166d32818ce071d567388bdc164e9e957de0b04de33b9b67737`
- Delivered WebP SHA-256: `79177a7a117149ffde5a2a6504d22e7016115d8d6f0a22cbd3a3822e3ecae571`

### home-briefcase-v1

- Source: `C:/Users/user/.codex/generated_images/01a08071-9497-7662-9bdd-70a6f05d7d0b/exec-f91e0e5d-39a0-4772-a812-1b65c820ff44.png`
- Source SHA-256: `0e9dcf814f74a7219f53e436a676cdea7a8db9243e43dad6dbca8fb4e87fa849`
- Delivered WebP SHA-256: `b1b56543ee80f9393a826e82a51db52ba289fce22aff83a4d02f267b6d3c9818`

## Reference and rejected briefcase attempts

The briefcase direction followed the user-provided mobile-card reference `C:/Users/user/AppData/Local/Temp/codex-clipboard-b56abcbc-f942-4fe3-a105-8ad31e5187ef.png`, inspected locally. Its small blue briefcase informed the muted blue material, simple silhouette and restrained hardware. No interface text or card backgrounds were copied into the final asset.

Two reference/edit attempts were rejected because they returned RGB PNGs with a baked checkerboard, not transparent alpha. They were not placed in the project:

- `exec-d5a7d9b0-8639-4aef-8909-0b82fcd8c883.png` — initial reference-based generation.
- `exec-2e868786-33d1-4e66-b62d-1a78a4d8ae7f.png` — attempted alpha correction through the built-in image tool.

The selected briefcase was freshly generated from the final prompt below and has actual RGBA transparency. This retry did not use a fallback API or programmatic background extraction.

## Final generation prompts

### home-heart-v1

```text
Use case: stylized-concept. Asset type: one premium NEBO mobile-app topic illustration, separate square raster asset. Scene/backdrop: genuinely transparent alpha background, no background color or opaque white rectangle, no floor or backdrop, no drawn checkerboard. Style: refined soft 3D ceramic-like illustration with understated soft gloss, smooth rounded volumes and a calm modern premium feel. Composition: one compact centered object occupying about 80% of a square canvas, generous clear margin, recognizable at 50 pixels. Lighting: broad soft studio light from upper left, restrained highlights, gentle self-shading. Constraints: no text, letters, logos, watermark, outline, border, sparkles, extra decorations, pedestal or ground shadow. Subject: a single plump rounded heart, front view with a slight three-quarter turn, soft rose-pink ceramic surface with a warm pink shaded edge. The silhouette is unmistakably a heart. Avoid saturated red, neon, glitter, excessive shine, or cute face.
```

### home-notebook-v1

```text
Use case: stylized-concept. Asset type: one premium NEBO mobile-app topic illustration, separate square raster asset. Scene/backdrop: genuinely transparent alpha background, no background color or opaque white rectangle, no floor or backdrop, no drawn checkerboard. Style: refined soft 3D ceramic-like illustration with understated soft gloss, smooth rounded volumes and a calm modern premium feel. Composition: one compact centered object occupying about 80% of a square canvas, generous clear margin, recognizable at 50 pixels. Lighting: broad soft studio light from upper left, restrained highlights, gentle self-shading. Constraints: no text, letters, logos, watermark, outline, border, sparkles, extra decorations, pedestal or ground shadow. Subject: a single compact small closed notebook with a matching pen resting diagonally on its cover, visually treated as one small stationery object. Rounded powder-blue cover, simple ivory page edge, softly rounded matching pale-blue pen with one small muted silver tip. Mild three-quarter view clearly reveals the notebook shape, no spiral binding, no writing or cover decoration. It represents everyday things to do, not only work. Avoid briefcase, laptop, busy details, dark heavy edges.
```

### home-flower-v1

```text
Use case: stylized-concept. Asset type: one premium NEBO mobile-app topic illustration, separate square raster asset. Scene/backdrop: genuinely transparent alpha background, no background color or opaque white rectangle, no floor or backdrop, no drawn checkerboard. Style: refined soft 3D ceramic-like illustration with understated soft gloss, smooth rounded volumes and a calm modern premium feel. Composition: one compact centered object occupying about 80% of a square canvas, generous clear margin, recognizable at 50 pixels. Lighting: broad soft studio light from upper left, restrained highlights, gentle self-shading. Constraints: no text, letters, logos, watermark, outline, border, sparkles, extra decorations, pedestal or ground shadow. Subject: a single small sculpted lavender ceramic lotus flower, a handful of broad softly rounded upward petals arranged in one simple compact blossom. Front three-quarter view, muted lilac and pale lavender with very gentle tonal variation. Rounded petals rather than sharp spikes, clean clear silhouette at 50 pixels. Avoid stem, leaves, water, pot, stones, spiritual symbols, glitter, neon purple, excessive fine petals.
```

### home-briefcase-v1

```text
Use case: stylized-concept. Asset type: one premium NEBO mobile-app topic illustration, separate square raster asset. Scene/backdrop: genuinely transparent alpha background, no background color or opaque white rectangle, no floor or backdrop, no drawn checkerboard. Subject: one compact structured muted powder-blue leather briefcase with a short rounded top handle, a smooth front flap, one tiny satin-silver clasp and softly rounded rectangular corners. A simple serious blue portfolio bag, broad front view with very slight three-quarter depth. Style: refined realistic soft 3D illustration, substantial satin-matte leather material, discreet seams, restrained highlights and natural volume, calm modern premium feel. Not toy-like or cartoonish. Composition: one compact centered object occupying about 80% of a square canvas, generous clear margin, recognizable at 50 pixels. Lighting: broad soft studio light from upper left, restrained highlights, gentle self-shading. Constraints: no text, letters, logos, watermark, outline, border, sparkles, extra decorations, pedestal or ground shadow. Output must be an actual transparent PNG cutout with alpha.
```

## Rejected-attempt prompts

Initial reference generation:

```text
Use case: stylized-concept. Asset type: a single transparent raster illustration for the career topic in the premium NEBO mobile app. Input image role: visual style and subject reference only; use the small blue briefcase shown in the middle column near the top. Create one separate blue briefcase object, NOT the app interface, cards, text, or other symbols. Scene/backdrop: genuine transparent alpha, no background color, no white rectangle, no floor, no checkerboard. Subject: compact dark powder-blue/slate-blue structured leather briefcase, softly rounded rectangular shape, short rounded top handle, simple front flap and one small restrained satin-silver clasp. Front view with a very slight three-quarter depth. Material should feel substantial and refined: satin-matte blue leather with subtle realistic smooth surface, very restrained specular edge highlights, delicate seams only if visible at 50px. A serious premium object, not a toy, cartoon, clay blob, emoji, or shiny plastic. Composition: centered in square canvas, occupies about 80 percent width and height, clear open margin, unmistakable silhouette at 50 pixels. Soft broad light from upper left, natural gentle self-shading, no ground shadow. Keep detail sparse. No letters, logo, text, watermark, outline, stickers, sparkles, extra objects or pedestal.
```

Built-in transparency correction:

```text
Use case: background-extraction. Edit target: the provided blue leather briefcase image. Preserve the briefcase exactly: its color, shape, texture, silver hardware, size, lighting and placement. Remove the ENTIRE printed gray-and-white checkerboard background from outside the briefcase and from inside the handle opening. The checkerboard is a baked image pattern, not transparency. Deliver the briefcase as a clean RGBA PNG cutout with TRUE transparent alpha for every background pixel. There must be no checkerboard pixels, no white pixels, no background rectangle, no floor shadow outside the object. Do not redraw or change the object, do not add any text.
```

