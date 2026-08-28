# NEBO app icon

The canonical artwork is `assets/nebo-app-icon-master.png`.

- Source SHA-256: `0570EE9D68341CBCFA2D5A1EF0A0872C6E6AF1A2175C7119B0C16123BFAE2DAE`
- Source format: opaque RGB PNG, 1254 x 1254 px
- Do not overwrite or regenerate the master.
- The shared upload/runtime export is `public/assets/brand/nebo-app-icon-512.png`.
- The web favicon/PWA derivative is `public/assets/brand/nebo-app-icon-192.png`.

Derived square assets use the source crop `(99, 106, 1155, 1162)` and Lanczos
downsampling. This keeps the complete rounded tile and shadow while reducing the
outer white mockup margin. Android adaptive foregrounds keep the NEBO wordmark
inside the central 66 dp safe zone; the launcher XML and white background remain unchanged.

External uploads must target the public application/client/listing icon, not an
administrator's personal profile image. Use the same 512 px export for VK ID,
Yandex OAuth and RuStore when each cabinet accepts it.
