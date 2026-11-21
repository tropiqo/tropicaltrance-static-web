# Apparel concept showcase

The English and Mexican Spanish apparel routes show five owner-provided hoodie mockups and one temporary T-shirt outline. Every garment is labeled as a concept preview. The hoodie images are approved for concept display only; they do not establish final garment specifications, production approval, pricing, or a product offer.

`src/data/apparel-products.mjs` records the media state for each item. Hoodie images are pinned to exact local paths and SHA-256 digests and include descriptive English and Mexican Spanish alt text. `scripts/public-inputs.mjs` verifies their bytes and the closed `public-astro` inventory rejects any additional file. The T-shirt remains inline SVG because no T-shirt image was supplied.

Any new or replacement apparel image requires owner approval for its intended use, a local path and SHA-256 digest in the closed inventory, descriptive English and Mexican Spanish alt text, byte checks, and rendered-route verification. Approval to display a concept image does not approve production, publication, pricing, or purchasing details. Do not add remote images or commerce actions.
