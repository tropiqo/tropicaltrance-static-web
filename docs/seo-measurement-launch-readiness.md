# SEO measurement and production launch readiness

This guide is for a future owner-approved production release. It does not authorize a domain, deployment, indexing, publication, analytics, or sales. The current `content/site.json` must remain `development-site`; local and review output remain `noindex, nofollow`, disallow crawling, and omit a sitemap.

## Measurement architecture

Use Google Search Console for Google organic-search visibility. It can be configured without adding a website analytics script. Search Console reports search impressions and clicks, click-through rate (clicks divided by impressions), average position, queries, pages, countries, and devices. Average position is an aggregate measure and can vary from an individual search. Interpret it alongside clicks, impressions, and page-level rows.

Use a Domain property for a verified root domain when the owner wants coverage across its protocols and subdomains. Search Console requires DNS verification for a Domain property. Google documents the current setup in [Add a property](https://support.google.com/webmasters/answer/34592) and [Verify ownership](https://support.google.com/webmasters/answer/9008080). Do not create a property for a guessed domain.

Search Console measures Google Search exposure and clicks, not on-site engagement or sales. It does not require this project to install analytics code. No Search Console account, property, verification token, API, tag, or analytics integration is configured by this change.

## Owner Search Console setup after launch approval

Perform these steps only after the owner has verified control of the selected production domain and separately authorized the public launch:

1. In Search Console, add a **Domain** property containing only the verified root domain (no protocol or path).
2. Follow Google's ownership flow. Copy the unique TXT or CNAME verification values it provides and add them at the authoritative DNS provider for that domain. Do not guess or reuse a token. Return to Search Console and complete verification. Keep the DNS record so ownership remains verified.
3. Confirm the public HTTPS site has the intended canonical origin and is serving the owner-approved production release.
4. Confirm `/robots.txt` permits crawling and references the production sitemap, and that `/sitemap.xml` loads successfully. Submit the sitemap URL in Search Console's **Sitemaps** report. Check its read status and any reported errors. Google's [Sitemaps report guide](https://support.google.com/webmasters/answer/7451001) explains submission and status.
5. Use **URL Inspection** on the homepage, About, Flavors collection, Contact, and representative English and Spanish flavor details. Confirm the live URL is crawlable, indexing is allowed, and Google's selected canonical matches the intended canonical. Inspect a changed or important URL before requesting indexing. A request is not a guarantee of indexing; see Google's [URL Inspection guide](https://support.google.com/webmasters/answer/9012289).
6. Use the **Performance** report after data appears. Review the Search results type, Pages and Queries tabs, and a consistent date range. Export a snapshot for the launch baseline and repeat on a regular cadence. Search Console data may be delayed or aggregated; avoid comparing incomplete periods. See the [Performance report overview](https://support.google.com/webmasters/answer/7576553) and [metric definitions](https://support.google.com/webmasters/answer/7042828).

Property verification only establishes site ownership for Search Console. It does not grant website publication, indexing, content or artwork approval, legal clearance, sales activation, or deployment permission.

## Minimal organic-search scorecard

Keep a monthly snapshot for a fixed date range (for example, the last complete 28 days compared with the preceding 28 days). Record the property, search type, date range, filters, and export date with each snapshot.

| Measure | How to review it |
| --- | --- |
| Organic impressions | Search appearances in Search Console; compare total and by page/query. |
| Organic clicks | Clicks from Google Search results; review totals and landing-page rows. |
| Click-through rate | Clicks divided by impressions; inspect by query and page, not only site-wide. |
| Average position | Track direction over time and by query/page; treat it as an aggregate, not a promised rank. |
| Landing-page performance | Use the Pages dimension to compare `/`, `/about/`, `/flavors/`, `/contact/`, and flavor details; record impressions, clicks, CTR, and position. |
| English / Spanish visibility | Compare English paths with `/es/` paths and corresponding flavor details. Where query data exists, review English and Spanish query wording separately. Search Console does not provide a guaranteed language label for every search. |
| Branded / non-branded discovery | Group visible queries containing the approved brand terms (such as “Tropical Trance” and “Trancy”) as branded. Review other relevant queries separately as non-branded. Query reporting can omit or aggregate some searches for privacy, so these groups are directional, not exhaustive. |

Search Console's [Performance report](https://support.google.com/webmasters/answer/7576553) supports filters and dimensions such as pages, queries, countries, and devices. Keep filters consistent between comparisons and note when comparing page-level rather than property-level data, because aggregation affects some totals.

## Future conversion measurement definitions

These are planning names only. Do not emit them until the owner approves an analytics approach, privacy and consent requirements, retention, and the specific commercial flow. This repository currently has no event collection, analytics scripts, cookies, pixels, or third-party measurement SDK.

| Event name | Future trigger | Minimum useful fields and boundaries |
| --- | --- | --- |
| `partner_referral_click` | A user activates a future enabled, owner-approved partner referral link. | `channel_id`, `flavor_slug`, `locale`, and placement. Do not send message contents or unnecessary destination/query parameters. Disabled channels and preview-only entries must never fire it. |
| `contact_interaction` | A user activates an available contact method. | `contact_method`, `locale`, and page. Never collect message text, phone number, email address, or other direct identifiers as event properties. |
| `direct_purchase` | A future authorized first-party checkout confirms a completed order. | Only after a real checkout and commercial approval exist: deduplicated transaction reference, currency, order total, and item identifiers as approved by privacy/legal review. Do not send names, email, address, payment credentials, or other personal data. |

Event names alone do not authorize partner links, contact integrations, checkout, data collection, or commerce. Define consent behavior, data minimization, access, retention, and testing before implementing any event.

## Controlled production SEO launch checklist

Complete and record each gate independently:

- [ ] Owner verifies control of the exact HTTPS production domain and approves its use.
- [ ] English and Mexican Spanish copy, routes, titles, descriptions, language alternates, and accessibility text receive editorial review.
- [ ] Brand identity, Trancy, flavor artwork, and any other published media receive the required owner/rights approval.
- [ ] Legal and commercial review approves the exact content and intended jurisdictions; technical validation is not legal or commercial approval.
- [ ] Website publication and release authorization are explicitly approved for the exact production build.
- [ ] The owner separately approves public indexing. Only then prepare the production site record and provide the verified origin plus `TROPICAL_INDEXING_AUTHORIZATION=OWNER_APPROVED` through the authorized build process.
- [ ] Before release, build checks confirm authorized pages use the verified canonical origin, reciprocal `en` / `es-MX` alternates only for existing translations, and no accidental or nonexistent URLs.
- [ ] Confirm the authorized production `robots.txt` permits crawling and the generated sitemap contains only intended live routes; check no 404, review, fixture, or development-only paths appear.
- [ ] Verify Search Console Domain property ownership by DNS, submit `/sitemap.xml`, inspect representative live URLs, and review crawl/index status.
- [ ] After release, monitor Search Console indexing and sitemap reports, then record the scorecard above on a consistent schedule. Investigate unexpected indexing, canonical selection, route, language, or visibility changes.
- [ ] Commercial activation remains a separate decision: sales-channel approval, partner destinations, and any future checkout require their own approvals and implementation review.

## Separate readiness gates

1. **Technical SEO readiness** means metadata, route, canonical, language, robots, and sitemap behavior pass their checks. It does not make the site public.
2. **Indexing authorization** is the owner's explicit decision to allow search crawling/indexing for the exact release, in addition to the technical build inputs.
3. **Website publication** requires separate approval of content, artwork, legal/commercial status, and the exact release/deployment. Search Console verification does not grant it.
4. **Commercial activation** separately authorizes sales behavior and channels. Search visibility and publication do not enable commerce.

The `OWNER_APPROVED` environment value is an indexing build gate only. It is not evidence of legal rights, artwork approval, commercial eligibility, publication authorization, or deployment approval. Until all applicable owner approvals are complete, leave the development record and noindex restrictions intact.
