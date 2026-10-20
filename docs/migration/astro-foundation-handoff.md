# Internal Astro foundation handoff

This is the authoritative developer handoff for the accepted Change 007 foundation, with the current Change 009 update below. Earlier slice documents are dated evidence, not current deployment instructions. The owner selected an internally validated foundation: this is **not a production-ready release and gives no authorization to publish**.

The dated image-free foundation inventories and acceptance below are historical. For the current normal mascot integration, use the Change 009 section at the end; no deployment is authorized.

## Purpose and routes

Preserve the independent static Astro architecture and approved Tropical Editorial Hybrid: dark tropical green, cream/coral/lime, editorial typography, existing navigation and atmosphere. No redesign or backend/Studio runtime exists.

Normal route foundation: /, /flavors/, /about/, /contact/ and /404.html. One reusable Flavor Detail model is exercised only by synthetic review routes /flavors/fixture-coral/ and /flavors/fixture-orchid/. No normal Flavor details/cards, top-level Worlds route, optional navigation mascot or new category is included.

Trancy is prominent on review Home and meaningful on review About. The normal developer build intentionally has no mascot image. Internal completion does not waive the future original-mascot Home/About public-release intent.

## Repositories and toolchain

Studio holds governance, canonical metadata and private authority/evidence. The separate website owns local public representations, presentation, build/CI and delivery. Builds do not fetch/import Studio, private artwork, credentials, model services or remote content.

Pins: Node **24.21.0**, npm **11.19.0**, Astro **7.3.8**; Python **3.9+** for standard-library HTML and CI policy audits. Use .nvmrc/package engines and the existing lockfile; .npmrc enforces the official registry, engine checks and ignored lifecycle scripts. No large browser/a11y framework is required.

These instructions apply to the current migration working tree or a future reviewed migration revision. The current website HEAD bcbdaa69035b31c46eba8aaf74c95c4101d51675 is historical Jekyll source; checking out that commit alone will NOT reproduce this uncommitted Astro foundation. Verify Astro files/package pins before any fresh install.

## Developer commands

Run from the website directory, never its workspace parent. If available, use nvm use, then verify node --version and npm --version.

Safe locked fresh-checkout installation, after confirming the intended Astro source:

~~~sh
npm ci --ignore-scripts --no-audit --no-fund
~~~

No install was performed during this handoff batch. Normal development:

~~~sh
npm run dev
~~~

Open http://127.0.0.1:4321/. Normal build and preview:

~~~sh
npm run build
npm run preview -- --port 4321
~~~

The existing pinned Astro local-development guide describes stopping background servers with npm run dev -- stop and npm run preview -- stop. Python's review server below stops with Ctrl-C. Keep all review servers on loopback.

Explicit isolated review:

~~~sh
npm run review:build
python3 -B -m http.server 4333 --bind 127.0.0.1 --directory .review-build
~~~

Use http://127.0.0.1:4333/ and /about/ for Trancy, /flavors/ and the two fixture detail URLs above for synthetic content, /contact/ and /404.html for recovery/navigation. Noindex and review labeling do not authorize external hosting.

Full local validation:

~~~sh
npm run validate
npm run verify:reproducible
python3 -B .github/ci/check_policy.py --self-test
git diff --check
~~~

The aggregate runs validate:inputs, normal build, review:build, npm test, validate:output and validate:review-output. Reproducibility already runs in npm test; the standalone command exercises that entry point. Build first before standalone output/reproducibility checks. Failures are nonzero and must be investigated, not bypassed.

## Build and asset boundaries

**NEVER deploy .review-build, synthetic fixtures or review-only Trancy media. Normal dist is also a development artifact, not an approved public release.**

Normal mode uses closed v1 content/site.json, release-set.json and media.json; real members and media entries are empty. Normal brandMedia is empty. It emits only five HTML pages and generated CSS, with development notices/footer, pending contact/empty state and noindex/nofollow. public-astro has complete selected-delivery inventory enforcement and no files; merely placing bytes in the repository does not admit them.

Review mode is explicitly selected, fixed to .review-build and independently guarded. It uses inert synthetic Flavor files under tests/fixtures/public-inputs and separately validated local-trancy-review-only roles home-hero/about-mascot. This is not a real Flavor, Studio Asset/Approval, public eligibility snapshot or brand-media v2 implementation. Both roles reuse one exact delivery. Every resource, route, delivered digest and extra/unreferenced file is checked; normal mode rejects review bytes/paths/markers even when relabeled.

Canonical source, already tracked and preserved:
- assets/images/TRANCY-01.png — 5386 x 4795, 4,052,776 bytes.
- SHA-256: 61088b9e5e4b1ec9f80c2b17e8ab79d3443b5af63347cb141684de5cc02dab5d.

Review delivery, ignored and never normal publicDir:
- review-assets/trancy-review-r1.webp — 1440 x 1282, 542,380 bytes.
- SHA-256: 93fdea06b6b6c7bc496f56a8f0df331213b0ef1fdfeb6b8cfbfd865f657bb658.

The registered cup legend **TROPICAL TRANCE** is intentional. Preserve original and derivative pixels, colors, proportions, facial features and accessories. No retouch, recolor, redraw, crop, new image or automatic variant. Explicit review/test preparation may reproduce the same pinned derivative when absent; source/toolchain/output drift fails closed and matching existing bytes are not overwritten.

All six original brand images, 323 retained historical demo media/author/comment data files, LICENSE, upstream README credits, standalone copyright notices and history/license/screenshots are preserved. They are not publicDir inputs and must not be swept away because legacy implementation code was retired. Private/ignored files, dependencies/caches and unrelated uncommitted work remain outside any cleanup scope.

### Exact expected current output inventories

These are the accepted retirement baseline, unchanged by documentation. CSS filename/digest is an exact current build artifact, not a blanket permission for arbitrary generated files. No scripts, maps or extra assets are allowed.

#### dist/

| File | SHA-256 |
| --- | --- |
| 404.html | b8e9fe3cc76cf3bea311a7591b89a16bbf2ee9274a5f44673810e18882235844 |
| _astro/SiteLayout.eeGnhxbz.css | c1b2d0c72ceb8e169daf51c4750db88f6f1aeb2e3eee7ac525369276829b4f3d |
| about/index.html | e6adc7f9e07c107cd181db1277f3c7d3a4b4312bebee96b37b415ff0e5032e08 |
| contact/index.html | 96893b807d2813457f98ab458c3a76d17cd7724bbedff448779cb864018ce3ab |
| flavors/index.html | 85574bc4135c3a9e76190c6fe56fb10178cc40c2ac7ecf091ea062bb46ec0355 |
| index.html | 26b490b3c1aaeb8d8fb9eedd1b52add95917703c907aa5b55922d292a0c382df |

#### .review-build/

| File | SHA-256 |
| --- | --- |
| 404.html | f757c541df1a551a6c20b59baf0eb12d3a4b38fd959a73c188dedb67c253e7dc |
| _astro/SiteLayout.eeGnhxbz.css | c1b2d0c72ceb8e169daf51c4750db88f6f1aeb2e3eee7ac525369276829b4f3d |
| about/index.html | b296a077eab3ae1368ebd77eb7834d24a55b8eabe048254ba7c922fd71a000cd |
| contact/index.html | aa48e098fa499134513cce52785c6cd62245261fb442fcc8e2f1b02dd55b608e |
| coral.svg | 28965010f1c6bb51a8304ca8adb12990f227723307fdd7a6a8276453699c9fee |
| flavors/fixture-coral/index.html | 503a95ffc67253740ccf207d4db155c8a54f553931ad990c2c9f1461a4bb8865 |
| flavors/fixture-orchid/index.html | c208b8f5b0946b6a069dc1fde335d55e22c91018fe7a703690acc100c46c3120 |
| flavors/index.html | 71884d9cc927087d50a63f063f548a33f08b5de31c1694b44e5dc9ec24b0bcea |
| index.html | 427a7fa3d580caeaced9d659e1d2ddeb74a43c1a8365d9b4f83eb1435410bbcc |
| orchid.svg | abe30968e56f57f20efb530d26a1d8691d0b5dddbdc6b821b6f107a8a353bc21 |
| review-media/trancy-review-r1.webp | 93fdea06b6b6c7bc496f56a8f0df331213b0ef1fdfeb6b8cfbfd865f657bb658 |


## Validation evidence and limitations

Accepted retirement evidence: 152/152 automated tests, all 17 CI policy negative cases, normal/review audits and deterministic independent builds pass locally. Existing tests compare repeated website-only filename/SHA-256 inventories, block content network primitives and demonstrate rejection of injected byte drift/extra output. They reuse installed dependencies; they do not certify a fresh hosted Linux installation.

Owner-performed local acceptance, reported in the conversation:
- Widths 320, 375, 768, 1024, 1440 and 1920px: PASS.
- Home/About at 200% browser zoom: PASS.
- Keyboard navigation, visible focus, CTA and native review disclosure: PASS.
- Navigation/functional links: 9/9 PASS.
- Browser Console and Network resources: PASS.

These are user checks, not agent browser automation. No browser/version, screenshot or execution timestamp was invented. Token contrast and parsed HTML/semantic/alt/focus/reduced-motion structure are tested. Screen reader, actual rendered contrast, touch, reduced motion, long names and no-JavaScript acceptance remain explicit **pre-publication work**, not completed by these passes.

Local CI policy enforces nonprivileged pull_request to master, contents:read, pinned actions, no persisted credentials, locked install, build/tests, no production environment/secrets/deployment. Actual GitHub Actions/same-repo/fork-PR runs and external Pages/Cloudflare/hooks/protections are **UNVERIFIED**. Before any future external PR/preview/publication, confirm remote settings cannot publish proposed code, then obtain revision-bound CI/platform evidence under separate scope. Verify pinned node/npm/Python/native-image tooling and exact derivative generation on the runner. Never relax digests to pass another platform.

## Maintenance and ownership

**Technical maintainer: awaiting named assignment.**
Responsibilities: deliberate Node/npm/Astro/native-toolchain/action updates, lock/lifecycle review, cross-platform checks, reproducibility, regression/privacy/isolation audits and source recovery.

**Release owner: awaiting named assignment.**
Responsibilities: reviewed normal candidate, current upstream eligibility, remote isolation, hosting/domain/production trigger and separate publication/release/withdrawal decisions. One authorized person may hold both roles. No name or assignment is inferred.

Named assignment is outstanding before applicable production operations; the owner explicitly permits an internal handoff documenting that absence. These role descriptions create no new approval system or release authority.

## Safe source-level recovery

No rollback command was executed. Production rollback is not applicable: no deployment or approved public release exists.

### Local development error while work is uncommitted

1. Stop the failing edit and inspect exact state. Preserve all prior tracked/untracked/ignored work and the original/derivative identities. Do not reset, clean, stash, overwrite whole directories or use a blanket restore.
2. Identify the affected source path; Git diff alone omits untracked Astro files. Useful read-only inspection:

~~~sh
git status --short --branch
git diff --name-status
git ls-files --others --exclude-standard
git diff -- README.md
~~~

3. Compare the damaged file with a known-good local saved copy, accepted working-tree evidence or a later reviewed Astro revision. Current HEAD may have no Astro blob at all. Preserve the damaged/current file in an approved scratch location before any authorized correction; untracked source requires a saved copy, not assumptions about HEAD.
4. Make only a reviewed, file-specific editor/patch correction under the applicable edit scope. Retain validation-only CI, exact media/release guards and protected data. Re-run aggregate checks and compare normal/review inventories/digests; stop on source/media drift.

The original/derivative are invariants, not recovery experiments. If either hash differs, stop and identify the change rather than accepting/relabeling new artwork or silently generating another output.

### Historical checkpoint and selective inspection

Historical website HEAD:
bcbdaa69035b31c46eba8aaf74c95c4101d51675.

Read-only example:

~~~sh
git show bcbdaa69035b31c46eba8aaf74c95c4101d51675:README.md
~~~

That shows the obsolete theme documentation. It is NOT a safe production rollback target. A blanket reset/revert to that revision could restore the old deploying Jekyll workflow, obsolete claims and tools, and discard/obscure uncommitted Astro source. Never restore .github/workflows/jekyll.yml or withdrawn/unapproved media.

### A future reviewed Astro migration commit

No migration commit exists yet. When one exists, record its exact revision and parent before considering any reversal. Inspect the changed paths and CI effects first. In the examples below replace the uppercase placeholders with actual reviewed commit IDs; they are not claimed existing revisions:

~~~sh
git show --stat REVIEWED_MIGRATION_COMMIT
git diff REVIEWED_PARENT_COMMIT REVIEWED_MIGRATION_COMMIT -- .github/workflows/
git diff REVIEWED_GOOD_ASTRO_COMMIT REVIEWED_BAD_ASTRO_COMMIT -- src/pages/index.astro
git show REVIEWED_GOOD_ASTRO_COMMIT:src/pages/index.astro
~~~

Prefer a reviewed forward fix or selective source correction from known-good Astro blobs to an automatic whole migration revert. Inspect temporary copies/diffs before applying a specifically authorized patch. Exclude any change that restores deploying CI, old products/claims, private dependencies, fixtures/review media in normal output or intentionally retired implementation. Validate and re-review the exact corrected candidate. This is developer-source recovery, not deployment rollback.

## Deferred production work

Explicitly outside Change 007 internal completion:
- Normal/public Trancy delivery and brand-media v2, including applicable source/derivative/role/release/eligibility and output-union work. The current isolated selection is not the public interface.
- Real Flavor artwork/content, including Grape under Change 008; current real release stays empty.
- Production site/About/contact/empty-state copy, metadata, SEO, canonical domain and indexing. Development notices/noindex are not removed in this batch.
- Cloudflare product/project/domain/hosting/release configuration and production deployment.
- Actual remote CI/provider isolation verification and remaining full production accessibility acceptance.
- Public candidate/release approval and withdrawal rehearsal.
- AI-generated video or another enhancement; no implementation or new media is authorized.

Existing future public gates remain mandatory when that scope is later authorized. Initial-release Trancy identity/Home/About intent is not waived. Future #products -> /flavors/ and #trancy -> /about/ are recorded decisions only; #why-choose-us has no replacement. No redirect/feed/sitemap/canonical behavior exists. Cloudflare is the intended direction, not a selected/configured hosting product.

## Change 008 Grape handoff

Approved Grape package artwork is separate from website use; package readiness alone does not authorize original reproduction, derivatives or publication. Remaining prerequisites:
1. Verify exact selected source revision/content identity and applicable source/web scope. Actual web derivative needs a reviewed recipe/version/parameters/profile and separate exact output identity; use no invented approval or no-op derivative.
2. Review public projection/copy/alt, permitted disclosure and exact local delivery bytes/path. Keep private decisions/evidence in Studio.
3. Derive the accepted public eligibility result and explicit exact release membership; validate all identity/use/validity/recipe/digest joins. Current upstream restrictions/selection/authorization must be rechecked before publication; an offline structural PASS cannot observe later revocation.
4. Validate the exact candidate/diff and isolated preview; obtain existing genuine candidate/publication/final release decisions under their separate scope. Synthetic fixture decisions and build PASS are not rights authority.
5. Withdrawal requires a separately authorized removal/replacement candidate/release and hosted/cache verification; source recovery must not restore withdrawn media.

Documented follow-ups before first real Flavor publication: **M-4**, privacy-heuristic false positives/URI/parameter-key boundaries (not a complete privacy classifier); **M-5**, test-only lookup/failure specificity and later non-APPROVED decision/evidence chronology. These are follow-up reviews, not a new authorization/history framework. Do not start Change 008 here.

## Handoff limitations and acceptance

Both repositories remain uncommitted migration working trees; HEAD alone is not the current implementation. No stage/commit/push/PR, remote verification, hosting configuration, public release or archive has occurred. Future source organization and external actions require their applicable scope. Review assets/output and private Studio evidence must never be published accidentally.

This document provides the internal handoff. Final owner review/acceptance of this batch and amended Change 007 remains open. Production deferrals are explicit, not completed work, and do not authorize deployment.

## Change 009: owner-approved static Trancy integration

The owner explicitly approved the unchanged existing WebP, full-frame recipe,
Home/About uses, public website-repository delivery, existing alt and neutral
About copy. This local integration replaces the uncommitted Batch B brand-media
schemas, v2 branches, profile/eligibility joins and private-candidate prerequisites.
No Studio governance/records or historical Change 007 task evidence is modified.
There are no brand Asset, authorization JSON, eligibility snapshot or dossier
requirements to render this approved static mascot.

Current normal output is seven files: five existing HTML routes, the referenced
stylesheet and assets/trancy-web-r1.webp. The fixed website input is
public-astro/assets/trancy-web-r1.webp: SHA-256
93fdea06b6b6c7bc496f56a8f0df331213b0ef1fdfeb6b8cfbfd865f657bb658,
542380 bytes, 1440 x 1282 alpha WebP. Both existing placements share the same
URL, dimensions and alt: “Trancy, the green Tropical Trance chameleon, with
sunglasses and a tropical drink.” Missing/changed/symlinked bytes and any unlisted
publicDir file fail validation. No build discovers or reads review/source files
as a fallback, or resizes/optimizes artwork. Normal validation uses the approved
static pin only; Flavor media/eligibility/release contracts remain closed v1.

The original PNG retains SHA-256
61088b9e5e4b1ec9f80c2b17e8ab79d3443b5af63347cb141684de5cc02dab5d
and is never served. Preserve the TROPICAL TRANCE cup legend and all existing
pixels/proportions/accessories. Existing review WebP is untouched; matching
review bytes are reused without re-encoding during validation.

Review output remains the exact eleven-file local-only baseline, with synthetic
Flavor routes/media, separate review-media path, noindex and disclosure. Never
deploy .review-build or synthetic fixtures. The normal static image pin grants
no Flavor artwork permission; generic Flavor guards still reject its digest.
A renamed copy, original source or extra public file is not permitted.

Use npm run dev or npm run build followed by npm run preview -- --port 4321;
view http://127.0.0.1:4321/ and /about/. Existing review commands remain unchanged.
Run aggregate validation, standalone reproducibility and policy checks as above.
Normal Home/About visual acceptance and remaining accessibility work must be
reported separately from old owner-performed review evidence. Remote CI, public
copy/Contact/SEO/domain/hosting/release remain unverified pre-launch work.
This approval authorizes local website integration only: no stage/commit/push,
PR, deployment, publication or archive. No automatic workflow follows this update.
