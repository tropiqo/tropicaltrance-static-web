# Website localization workflow

The website builds two static locales from shared Astro presentation components. Existing routes are English; Spanish for Mexico is served under `/es/`. UI and page copy live in `src/i18n/messages.mjs`, keyed by page or component and validated against the English key set at import/build time. Use locale-aware paths for internal links so page switches and navigation stay in the same language.

Flavor names and slugs remain product identifiers. Each normal flavor JSON record contains required `translations.es-MX.shortDescription` and `translations.es-MX.alt` fields. The build schema rejects a flavor without either value, preventing a Spanish flavor card or detail route from silently falling back to English. English copy remains in the existing top-level fields.

## Add a flavor

Run `npm run flavor:add -- <slug> --image <path>`. The interactive workflow asks for the existing English name, description, and alt text, then the Mexican Spanish description and alt text. You can provide the latter as `--es-description` and `--es-alt`; the content must be reviewed Spanish, not a machine translated placeholder. The preview includes the English and Spanish collection/detail routes. The CLI validates both locales before applying the new record. Flavor removal deletes the single flavor record and its translations together.

## Update a flavor

Run `npm run flavor:update -- <slug> --image <path>`. Existing English and Spanish values are offered as defaults. Review and update the Spanish description and alt text whenever their meaning changes. The product name and route slug are preserved unless the separately reviewed content identity calls for a change.

## Update shared interface copy

Add or edit the same stable key in both `en` and `es-MX` in `src/i18n/messages.mjs`. Keep brand names `Tropical Trance` and `Trancy`, preserve approved English values exactly, and avoid adding product, ingredient, effect, health, legality, or commercial claims. Build validation fails when a key is missing, empty, or present in only one locale. Add or update static output and browser tests for any new page-visible or accessibility text.

## Language preference and privacy

The shared local script checks a narrowly scoped `localStorage` key, `tropical-trance-language`, only on `/`. A manually selected `en` or `es` value takes priority over browser language preference. Without a valid saved value, the first supported base language in `navigator.languages` is used (or `navigator.language` if the list is unavailable); unsupported preferences fall back to English. Explicit page URLs are not redirected. Selector anchors still navigate when JavaScript or storage is unavailable.

The feature uses browser language preferences and local storage only. It makes no location inference, network request, cookie, or analytics call. The language preference is local to this browser profile; deployments should review their applicable privacy notice before publication.
