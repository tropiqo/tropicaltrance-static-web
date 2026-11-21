# Apparel concept showcase

The English and Mexican Spanish apparel routes render two temporary, inline SVG outlines: a hoodie and a T-shirt. Both are clearly labeled as concept previews. They are not approved garment artwork or product offers.

`src/data/apparel-products.mjs` records the media state for each item. The validator only accepts the inline concept state, with no local source path, digest, alt text, or owner approval. The closed `public-astro` inventory remains unchanged.

Replacing a concept with photography or approved artwork requires owner approval first. Add only local assets, record each exact path and SHA-256 in a closed inventory, provide descriptive English and Mexican Spanish alt text, and add checks for those bytes and rendered routes. Do not add remote images, commerce actions, or product details that have not been approved.
