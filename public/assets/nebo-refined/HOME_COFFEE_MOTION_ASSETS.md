# NEBO coffee motion assets

Created locally on 2026-09-08 with the built-in `image_gen.imagegen` tool. Both requests used `home-coffee-v2.webp` as the supplied reference/edit target. No fallback API or CLI image generation was used.

## Original preserved

- Original: `public/assets/nebo-refined/home-coffee-v2.webp`.
- Dimensions: 1536 × 1024; 93,904 bytes.
- Original SHA-256: `478d9731f24277a92eec6edd4d584d311a2866b698a280da9762b0250eb3c031`.
- The v2 asset was read and visually inspected, never overwritten.

## Delivered layers

| File | Size | Bytes | Purpose |
| --- | --- | ---: | --- |
| `home-coffee-base-v3.webp` | 1536 × 1024 | 50,648 | Static opaque coffee scene: no olive foliage or recognizable leaf-shadow silhouettes. |
| `home-olive-branch-v1.webp` | 647 × 768, RGBA | 110,562 | Isolated olive branch with real transparent alpha for separate CSS movement. |

The branch has alpha values spanning 0–255; 66.87% of its pixels are fully transparent. Its lower stem points toward the lower-right, suitable for placement at the card's right edge. The source greenery's muted olive colors, slender leaves and warm directional light were used as the visual reference.

The base keeps the original landscape composition and ample empty left area. The coffee cup, crema, handle, travertine pedestal and partially visible small cream vase at the far-right were preserved visually as closely as the generative edit allowed. This is not a claim of pixel-identical reconstruction.

No steam, text, watermark or other new object is baked into either layer. The source and generated results were inspected before delivery.

## Conversion

Only raster format conversion and proportional resizing used Sharp. No programmatic painting, cropping, compositing, masking, cutout or background removal was performed.

- Base: source dimensions retained; `.webp({ quality: 90, alphaQuality: 100, effort: 6 })`.
- Branch: `.resize({ height: 768, withoutEnlargement: true }).webp({ quality: 90, alphaQuality: 100, effort: 6 })`; generated alpha preserved.

## Source provenance

### home-coffee-base-v3

- Generated source PNG: `C:/Users/user/.codex/generated_images/01a08071-9497-7662-9bdd-70a6f05d7d0b/exec-9eec9957-e7d6-4230-95d3-856a24d96129.png`.
- Source SHA-256: `1aca5e9e7efb393536bf451707afeb287ea6b9b7ad271e7d093e2f57afa2480f`.
- Delivered WebP SHA-256: `69885fc15a31a23a82601681366bd19443496b1b58f368c07b24a7213c87aa77`.

### home-olive-branch-v1

- Generated source PNG: `C:/Users/user/.codex/generated_images/01a08071-9497-7662-9bdd-70a6f05d7d0b/exec-0ec2fdfb-d8fd-447a-bca4-8af0bc25eeed.png`.
- Source SHA-256: `889a70212e2a6fc9cd3f917e6c5c0e40af977cce02c736a8d6e49bfcf183d19f`.
- Delivered WebP SHA-256: `7e99ffaea34b6e5a68d64664d12c4266605038fe03689d6578cb512c4db2c973`.

Generated originals remain under `C:/Users/user/.codex/generated_images/01a08071-9497-7662-9bdd-70a6f05d7d0b/`.

## Exact prompts

### home-coffee-base-v3

```text
Use case: precise-object-edit. Edit target: the provided NEBO coffee-scene image. Make one narrowly scoped edit: remove the olive branches and all green leaves from the right and upper-right. Restore the warm pale cream background behind them, smoothly and naturally. Remove the recognizable cast leaf silhouettes associated with the removed branch while preserving the scene's gentle natural lighting. Preserve EVERYTHING else as closely as possible: the exact off-white coffee cup with handle, coffee and crema surface, the round travertine pedestal, the visible small cream vase at the far-right edge, warm ivory palette, daylight direction, shadows of the cup and pedestal, framing, camera perspective and positions. Keep the full landscape 3:2 composition equivalent to the source 1536x1024; no crop, no camera move, no zoom. Keep all the left-side empty cream space clear for UI text. This is the static background plate for a branch that will be animated separately. No leaves, branches, greenery, steam, fog, new object, text, logo or watermark. Output a clean photorealistic image, not a mockup.
```

### home-olive-branch-v1

```text
Use case: background-extraction. Input image role: branch appearance and lighting reference / extraction target. Create an isolated olive branch matching the greenery in the right side of this image: slim natural brown stems, elongated olive-green leaves with subtle central veins, warm soft daylight from upper left, realistic restrained satin leaf surfaces. Keep the same muted natural greens and elegant shape, not plastic or stylized cartoon foliage. Show only ONE coherent branching olive twig, stem entering from the lower-right and extending diagonally upward-left, suitable for emerging into a hero card from its right edge. Leaves should fan toward upper-left and upper-right, with a clean open silhouette. Crop/framing: a compact portrait-ish plant cutout centered with a little transparent margin, no huge blank surrounding canvas, no unrelated objects. The entire background MUST be actual transparent alpha: no cream/white rectangle, no printed checkerboard, no floor shadow. Remove the cup, pedestal, vase/pot and all background. No vase, pot, coffee, stones, steam, text, logo or watermark. Deliver a real RGBA PNG cutout so a website can rotate the branch separately over the unchanged coffee scene.
```

