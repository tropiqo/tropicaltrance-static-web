# Apparel concept showcase

The English and Mexican Spanish apparel routes show five owner-provided hoodie mockups and four owner-provided T-shirt mockups. Every garment is labeled as a concept preview. These images are approved for concept display only; they do not establish final garment specifications, production approval, pricing, or a product offer.

`src/data/apparel-products.mjs` records the media state for each item. Hoodie and T-shirt images are pinned to exact local paths and SHA-256 digests and include descriptive English and Mexican Spanish alt text. `scripts/public-inputs.mjs` verifies their bytes and the closed `public-astro` inventory rejects any additional file.

Each hoodie image has a restrained desktop hover zoom contained inside its frame. Activating an image opens a same-page dialog carousel at that image. Previous/next buttons and the left/right arrow keys change slides; Escape or the close button dismisses it. Reduced-motion settings disable the zoom.

Any new or replacement apparel image requires owner approval for its intended use, a local path and SHA-256 digest in the closed inventory, descriptive English and Mexican Spanish alt text, byte checks, and rendered-route verification. Approval to display a concept image does not approve production, publication, pricing, or purchasing details. Do not add remote images or commerce actions.
