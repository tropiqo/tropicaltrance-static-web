# Flavor management

## Overview

Studio stores the original PNG artwork in `tropical-trance-studio/assets/flavors/`. The Website stores optimized WebP derivatives in `public-astro/assets/` and bilingual flavor content in `content/flavors/`. The `flavor:add` and `flavor:update` CLI workflows prepare a candidate, build an isolated local preview, and apply the change only after interactive confirmation.

The CLI is explicitly development-only. Development artwork authorization supports local implementation, testing, and owner review; it does not create formal source registration, production artwork approval, publication authorization, or deployment permission.

## Prerequisites

- Use Node **24.21.0** and npm **11.19.0** from the Website repository root:

  ```sh
  cd /Users/josue.ruiz/Documents/Projects/tropical-trance/tropicaltrance-static-web
  nvm use 24.21.0
  node --version
  npm --version
  ```

- Keep original artwork in Studio, for example `tropical-trance-studio/assets/flavors/<flavor>/`. Give each new original or variant a distinct filename; retain prior versions.
- `--image` accepts a regular, non-symlink PNG, JPEG, or WebP file from 1 byte to 50 MiB. The decoder must accept it, it must be at most 40 megapixels, and animated or multipage images are rejected. PNG is the expected Studio original format.
- Each flavor needs an English name, short description, and meaningful English alt text, plus Mexican Spanish short description and alt text. Spanish values are required; do not leave them as English placeholders.
- Add/update requires an interactive terminal for metadata prompts, preview, and confirmation. Do not run the workflow from a non-interactive job.
- Every add/update invocation must include `--development-only`. This marks scope; it is not a production approval.

## Workflow A — Add a new flavor

1. Put the original PNG in a new Studio flavor folder. For this example, save an illustration matching the sample alt text as:

   ```text
   /Users/josue.ruiz/Documents/Projects/tropical-trance/tropical-trance-studio/assets/flavors/mango/cosmic-mango-journey.png
   ```

   Keep the original unchanged. If the image differs from the example description, write alt text that accurately describes the actual image.

2. Verify that the file exists and inspect its format and SHA-256 before use:

   ```sh
   test -f /Users/josue.ruiz/Documents/Projects/tropical-trance/tropical-trance-studio/assets/flavors/mango/cosmic-mango-journey.png
   file /Users/josue.ruiz/Documents/Projects/tropical-trance/tropical-trance-studio/assets/flavors/mango/cosmic-mango-journey.png
   shasum -a 256 /Users/josue.ruiz/Documents/Projects/tropical-trance/tropical-trance-studio/assets/flavors/mango/cosmic-mango-journey.png
   ```

3. From the Website root, run the complete example. The hypothetical alt describes a mango above a tropical ocean; replace it if that is not what the selected PNG shows.

   ```sh
   npm run flavor:add -- mango \
     --development-only \
     --image /Users/josue.ruiz/Documents/Projects/tropical-trance/tropical-trance-studio/assets/flavors/mango/cosmic-mango-journey.png \
     --name "Mango" \
     --description "Explore the Mango flavor from Tropical Trance." \
     --alt "A mango floats above a tropical ocean under a starry sky." \
     --es-description "Explora el sabor Mango de Tropical Trance." \
     --es-alt "Un mango flota sobre un océano tropical bajo un cielo estrellado."
   ```

   Supported metadata flags are `--name`, `--description`, `--alt`, `--es-description`, and `--es-alt`; all five are supplied here. The slug (`mango`) and `--image` are also required.

4. The CLI validates the input and content, generates a candidate, builds it in an isolated temporary copy, and starts a loopback preview. Review the candidate pages in the browser. The terminal shows the source SHA-256, prepared WebP dimensions/size/digest, and preview links, then asks `Add this development-only flavor after review? [y/N]`. Enter `y` only after review; Enter or `n` cancels and leaves Website inputs unchanged. A confirmed operation runs `npm run validate`; validation failure rolls back the change.

5. On confirmation, the generated files are:

   ```text
   public-astro/assets/mango-web-r1.webp
   content/flavors/mango.json
   ```

   The WebP is lossless, resized inside 1024 × 1536 without enlargement. Normal flavor data drives the English routes `/flavors/mango/` and the Spanish routes `/es/flavors/mango/`. Mango is included automatically in the English and Spanish Home and Flavors collections when its record is part of the Website content.

## Workflow B — Replace an existing flavor image

1. Preserve the previous original PNG in Studio and keep it unchanged. Save the new Grape illustration as a separate variant, for example:

   ```text
   /Users/josue.ruiz/Documents/Projects/tropical-trance/tropical-trance-studio/assets/flavors/grape/cosmic-grape-getaway-variant-02.png
   ```

   Verify the chosen input before running the workflow:

   ```sh
   test -f /Users/josue.ruiz/Documents/Projects/tropical-trance/tropical-trance-studio/assets/flavors/grape/cosmic-grape-getaway-variant-02.png
   file /Users/josue.ruiz/Documents/Projects/tropical-trance/tropical-trance-studio/assets/flavors/grape/cosmic-grape-getaway-variant-02.png
   shasum -a 256 /Users/josue.ruiz/Documents/Projects/tropical-trance/tropical-trance-studio/assets/flavors/grape/cosmic-grape-getaway-variant-02.png
   ```

2. Run the supported image-update command:

   ```sh
   npm run flavor:update -- grape --development-only \
     --image /Users/josue.ruiz/Documents/Projects/tropical-trance/tropical-trance-studio/assets/flavors/grape/cosmic-grape-getaway-variant-02.png
   ```

   `--image` is required. If you omit metadata flags, the CLI shows existing values as prompt defaults. Press Enter to keep each existing value, or enter revised values when appropriate. For example, use `--alt "..."` and `--es-alt "..."` when the new image needs new accessible descriptions; descriptions can likewise be changed with `--description` and `--es-description`.

3. The CLI increments the numeric revision and generates `public-astro/assets/grape-web-r2.webp` from a current `r1` record. The JSON remains at `content/flavors/grape.json`; it is updated with the new revision and image digest. Review the candidate in its isolated preview, including the English and Spanish Grape detail pages and both collections, before answering `y` to `Update this development-only flavor after review? [y/N]`. Enter or `n` cancels. After a confirmed update, validation runs; the former derivative is removed only if no other flavor references it and validation succeeds.

4. The slug and localized routes remain `grape`, `/flavors/grape/`, and `/es/flavors/grape/`. Check both detail pages and the collection cards after the update. The source PNG is not modified by the Website workflow.

## Workflow C — Update flavor content

Content updates can omit `--image`. Supply one or more metadata flags with the required `--development-only` scope. Any field without a flag is preserved. A metadata-only update keeps the existing slug, routes, image path, image digest, and revision; it does not open an image source, create an image revision, or generate a WebP. The CLI builds an isolated preview, prints the proposed field changes and unchanged image identity/revision, then asks for explicit confirmation. Review both localized detail pages and the collections before entering `y`; Enter or `n` cancels without changing Website files. A confirmed update runs `npm run validate`, and a validation failure restores the exact previous JSON.

Use these copy-paste-ready examples from the Website root, replacing the sample wording with reviewed content:

Update only both descriptions:

```sh
npm run flavor:update -- grape --development-only \
  --description "Explore the Grape flavor from Tropical Trance." \
  --es-description "Explora el sabor Grape de Tropical Trance."
```

Update only both alt descriptions:

```sh
npm run flavor:update -- grape --development-only \
  --alt "Trancy explores a cosmic grape landscape." \
  --es-alt "Trancy explora un paisaje cósmico de uvas."
```

Update only the flavor name:

```sh
npm run flavor:update -- grape --development-only --name "Grape"
```

Update several fields together:

```sh
npm run flavor:update -- grape --development-only \
  --name "Cosmic Grape" \
  --description "Explore the Cosmic Grape flavor from Tropical Trance." \
  --es-description "Explora el sabor Cosmic Grape de Tropical Trance." \
  --alt "Trancy explores a cosmic grape landscape." \
  --es-alt "Trancy explora un paisaje cósmico de uvas."
```

To replace artwork, use Workflow B and provide `--image`. Image replacement still generates the next WebP revision; combining `--image` with metadata flags updates both in the same candidate. A metadata-only update must include at least one actual metadata flag. Unknown flavor slugs and no-op update commands are rejected. Values must be non-empty and must not contain private paths or references. The interactive TTY, preview, and confirmation requirements still apply.

## Validation checklist

From the Website root, using Node 24.21.0:

```sh
npm run validate
npm run verify:reproducible
npm run test:e2e
npm run dev
```

`validate` checks Website inputs, builds, automated tests, and output audits. `verify:reproducible` checks deterministic build behavior. `test:e2e` runs the Playwright browser suite. `dev` starts the local Astro development server at `http://127.0.0.1:4321/`.

When browser execution is unavailable in a restricted environment, run `npm run test:e2e` from the regular host Mac terminal after selecting Node 24.21.0. Do not repeatedly retry Chromium in a restricted sandbox. The CLI's isolated candidate preview is part of its interactive add/update flow and is not a replacement for the complete Playwright suite.

Manually review:

- Home in English and Spanish: flavor card and artwork.
- Flavors collection in English and Spanish: card order, text, alt text, and links.
- English flavor detail route and Spanish flavor detail route.
- Mobile Flavors carousel: swipe/controls, card reachability, and no clipping.
- Image framing and cropping at desktop and mobile widths. The workflow fits the full image within its bounds without enlargement; check that the composition still reads well.
- Language switching from Home, collection, and detail pages; verify it keeps the corresponding flavor/page where applicable.

## Troubleshooting

- **Missing source PNG or wrong path:** `--image` must point to an existing regular file. Check it with `test -f`, `file`, and `shasum -a 256`. The CLI does not search Studio for the file.
- **Invalid flavor slug:** use lowercase letters/digits separated by single hyphens, such as `mango` or `pink-mango`. Reserved `index`, `404`, and `fixture-*` slugs are rejected. The parser lowercases the requested slug before checking it.
- **Duplicate flavor:** `flavor:add` reports `Flavor already exists: <slug>`. Use `flavor:update` only for an existing flavor whose image/content you intend to revise.
- **Unknown update target:** `flavor:update` reports `Unknown flavor: <slug>` when no record exists.
- **Missing bilingual content:** all English and Spanish name/description/alt values are required. Provide flags or answer the prompts. On update, pressing Enter accepts the displayed existing value; on add, an empty value remains missing and candidate validation fails.
- **Interactive confirmation unavailable:** add/update requires a TTY and otherwise reports `Interactive preview and confirmation require a terminal`. Run it in a regular terminal; do not pipe an automatic `y` into the command. `y` applies after review; Enter or `n` cancels.
- **Image processing fails:** use PNG, JPEG, or WebP within the stated file-size and pixel limits; use a still, single-page image. Check the source file opens correctly. The CLI reports its failed command/error and does not apply a candidate when preparation fails.
- **Validation fails:** the workflow rolls back Website content and derivative changes. Read the validation output, correct the source/content issue, and prepare a fresh candidate. Do not edit the candidate temporary directory.
- **Protected artwork changed unexpectedly:** stop. Do not regenerate or restore by guesswork. Compare the protected file's expected SHA-256 and Git diff/status, preserve the evidence, and ask the owner to identify the authorized source/version before proceeding.

## Development vs. production

**Development use:** an owner may authorize a local derivative from an original PNG stored in Studio `assets/flavors/`. Add/update requires `--development-only`, preserves the source, binds processing to its SHA-256 and deterministic recipe, previews an isolated candidate, and reports source/output identity. Development use is limited to implementation, testing, and owner visual review. It does not identify the creator, assert rights, create Studio Asset/Approval records, or make artwork canonical.

**Formal source registration and provenance:** Studio's controlled artwork workspace, provenance and backup procedures apply when artwork enters the formal registration path. Do not describe ordinary development copies as registered or approved.

**Production artwork approval:** the production process separately evaluates source identity/provenance, canonical selection, applicable human approvals, and exact production derivative/use. Development authorization does not satisfy those gates or grant commercial rights.

**Publication and deployment:** production publication authorization and release/deployment approval remain separate decisions. A successful local preview, validation, or development workflow does not authorize publication or deployment. Preserve the Website's development notice, `noindex, nofollow`, disabled sales channels, null WhatsApp destination, and legal/commercial gates.

## Quick reference

| Task | Command |
| --- | --- |
| Add a flavor | `npm run flavor:add -- <slug> --development-only --image <path> --name <name> --description <text> --alt <text> --es-description <text> --es-alt <text>` |
| Update content only | `npm run flavor:update -- <slug> --development-only [--name <name>] [--description <text>] [--alt <text>] [--es-description <text>] [--es-alt <text>]` (at least one metadata flag required; no new image revision) |
| Replace image, optionally with content | `npm run flavor:update -- <slug> --development-only --image <path> [--name <name>] [--description <text>] [--alt <text>] [--es-description <text>] [--es-alt <text>]` |
| Validate | `npm run validate` |
| Check reproducibility | `npm run verify:reproducible` |
| Browser suite (host terminal if restricted) | `npm run test:e2e` |
| Local website | `npm run dev` |

Add/update examples require an interactive terminal and a human review of the isolated preview before confirmation. Metadata-only updates preserve the existing image revision; image replacement creates the next revision.
