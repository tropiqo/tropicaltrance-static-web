# Technical SEO and indexing controls

## Architecture

`scripts/seo-metadata.mjs` is the metadata contract used by the shared Astro layout and build checks. The layout receives localized title and description values from the existing message catalog and validated flavor records. It derives stable route paths centrally for the English and Spanish equivalents. Flavor descriptions are reused as written; the SEO layer adds no product, health, medical, legal, or commercial claims.

Canonical links and reciprocal `en` / `es-MX` alternates are emitted only in an explicitly authorized production build with a valid configured origin. Spanish flavor alternates are omitted when a flavor has no Spanish translation. No `x-default` alternate is emitted because no separate default-language landing route has been established.

Organization/website structured data is omitted. The current website inputs do not establish the legal organization identity, public domain, address, or official social profiles needed to publish a reliable entity graph.

## Default development and review behavior

Development, normal local builds, and the isolated review build use `noindex, nofollow`. Their `robots.txt` says `Disallow: /`; no sitemap is generated unless the explicit production authorization below is present. Review builds are additionally identified by their synthetic review release and cannot become indexable through environment variables.

Safe local checks:

```sh
unset TROPICAL_SEO_ORIGIN TROPICAL_INDEXING_AUTHORIZATION
npm run dev
npm run build
npm run review:build
```

For a development check, inspect a page head and `/robots.txt` at `http://127.0.0.1:4321/`. Normal local build output is in `dist/`; isolated review output is in `.review-build/`. Both must retain `noindex, nofollow` and disallow crawling. They must not contain canonical links or a sitemap.

## Production authorization boundary

Setting a site URL, setting `NODE_ENV=production`, running `npm run build`, or passing technical validation does not authorize indexing. The build requires both:

- `TROPICAL_SEO_ORIGIN`: the owner-verified, HTTPS origin only (no path, credentials, query, or fragment).
- `TROPICAL_INDEXING_AUTHORIZATION=OWNER_APPROVED`: set only after the owner has separately approved public indexing for the exact site and release.
- The validated `content/site.json` must explicitly identify the release as `"kind": "production-site"`. It currently remains `"kind": "development-site"`, which keeps this website noindex even if both environment variables are supplied.

Only a normal production build with a production-site record and all authorization inputs emits `index, follow`, canonical URLs, reciprocal language alternates, an allow-crawling `robots.txt`, and `sitemap.xml`. Development mode and the isolated review release remain noindex even if these variables are set. The authorization string is a deliberate build gate, not proof of rights, legal readiness, production artwork approval, sales approval, or deployment authorization.

Do not change the current site record or set the authorization value as part of local development or review. A future launch requires an owner-reviewed production-site record, verified domain, approved content/artwork and publication records, owner release authorization, deployment review, and a separate decision to enable indexing. Only after those gates are satisfied should the owner prepare the production build inputs and set all three authorization values. A production build by itself remains noindex.

## Output coverage

The sitemap lists the existing Home, About, Flavors collection, Contact, and flavor detail routes. It includes localized pairs only where both routes exist; current English/Spanish fixed pages have reciprocal links, and flavor detail alternates require the Spanish translation record. The technical 404 is excluded. Build validation checks canonical, alternate, robots, sitemap, and route inventories against the same metadata contract.

## Content workflow

For each existing page, keep the search title and description distinct from the visible heading where that makes the result clearer. Use the localized message catalog in `src/i18n/messages.mjs`; provide matching English and Mexican Spanish fields, then verify their meaning and natural phrasing side by side. Keep titles specific to the page and descriptions concise, factual, and based on established brand or page content. Do not repeat keywords or add claims that are absent from approved content.

When adding a flavor, use the documented `flavor:add` workflow and supply both locales' description and image alt text. The flavor detail title is derived from the existing flavor name, and its metadata description reuses that flavor's approved short description. Do not rewrite that description as an SEO task. Describe only the meaningful visual information in alt text; do not use it for keyword lists. Check the Home discovery cards, both Flavors collections, both detail routes, headings, language links, and the artwork's rendered crop.

Future apparel content is out of scope until the owner approves creating it. Once approved, add it through the site's established content and route architecture, base copy only on verified product facts, localize the page and metadata in English and Mexican Spanish, and test its route, navigation, headings, and accessibility. Do not infer materials, availability, pricing, or commercial terms.

Before review, run `npm run validate`, `npm run verify:reproducible`, and `git diff --check`. Inspect local output with `npm run dev` and review Home, About, Flavors, Contact, and each localized detail page. Keep the 014A development defaults and indexing gates intact throughout content work; metadata improvements alone never authorize indexing or publication.
