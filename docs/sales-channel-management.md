# Sales channel management

## Architecture and states

`content/sales-channels.json` is the Website's only channel registry. The existing schema and `scripts/sales-channels.mjs` validate IDs, HTTPS destinations, and flavor associations. Rendering exposes links only for records with `enabled: true`; a disabled record can have a null destination and never renders a sales link. Cannaland and Splift are already present as disabled drafts with no destination.

Treat these as separate gates:

1. **Draft:** record exists, is disabled, and may have no destination.
2. **Technically valid:** schema, destination, and flavor associations pass validation.
3. **Commercially approved:** an owner has separately verified the partner relationship and destination under Studio publication policy.
4. **Enabled/published:** an authorized production change explicitly enables the record.

The CLI below requires `--development-only`, always keeps new records disabled, and cannot enable a channel. Technical validation is not commercial approval.

## Website rendering

`scripts/public-inputs.mjs` loads this registry through the existing sales-channel schema and URL validation, then associates only enabled channels whose optional `flavors` list includes the current flavor. An omitted list applies to every flavor; an empty list applies to none. Invalid destinations and unknown flavor slugs fail validation before rendering.

The reusable `SalesChannels` component renders on English and Spanish flavor detail pages only when that validated association list is non-empty. Its heading and accessible link labels use the page locale. Links retain `target="_blank"` with `rel="noopener noreferrer"`; there is no empty section or placeholder when no destination is available. Registry changes therefore affect flavor detail pages after the normal build, without adding links to Home or the collection pages.

## Prerequisites

Use Node 24.21.0 and npm 11.19.0 in the Website repository:

```sh
cd /Users/josue.ruiz/Documents/Projects/tropical-trance/tropicaltrance-static-web
source "$HOME/.nvm/nvm.sh" && nvm use 24.21.0
```

Channel IDs use lowercase letters, digits, and hyphens, beginning with a letter. Website destinations must be HTTPS and pass the existing destination checks. WhatsApp records use the existing `wa.me/<number>` or `api.whatsapp.com/send?phone=<number>` rules. Flavor associations use current content slugs (`cherry`, `grape`, `lime`).

Commands that apply changes require an interactive terminal, show a candidate, and ask for explicit confirmation. `--dry-run` validates and displays the candidate without writing. Every modifying command requires `--development-only`.

## Add a partner draft

Register a channel with no unverified destination. This example is safe to copy; it does not claim a real partner destination:

```sh
npm run channel:add -- demo-market --name "Demo Market" --kind website --development-only --dry-run
npm run channel:add -- demo-market --name "Demo Market" --kind website --development-only
```

The candidate is appended to `content/sales-channels.json` with `destinationUrl: null` and `enabled: false`. Review the preview, then answer `y` to apply. A duplicate ID, invalid name, invalid kind, or malformed association fails before writing. Do not enter partner URLs until verified.

## Update metadata, destinations, and flavor associations

Update the name and attach only flavors that actually belong to that destination:

```sh
npm run channel:update -- splift --name "Splift" --destination "https://verified.example/store" --flavors grape,lime --development-only --dry-run
npm run channel:update -- splift --name "Splift" --destination "https://verified.example/store" --flavors grape,lime --development-only
```

Replace the example URL with an owner-verified HTTPS destination before applying. The workflow rejects unsafe schemes, credentials, ports, fragments, malformed URLs, unknown flavors, and unsupported WhatsApp destinations. Use `--clear-destination` to remove a configured destination. Use `--flavors none` to associate no flavors; use `--all-flavors` to remove the association filter so the existing “all flavors” behavior applies. When no association flag is supplied, existing associations are preserved.

The command preserves all other records. It refuses to update an enabled channel; disable it first. A destination or association update leaves the channel disabled.

## Disable or remove

Disabling an already enabled channel removes its public sales links after validation:

```sh
npm run channel:disable -- partner-id --development-only --dry-run
npm run channel:disable -- partner-id --development-only
```

Removal is allowed only after a channel is disabled:

```sh
npm run channel:remove -- partner-id --development-only --dry-run
npm run channel:remove -- partner-id --development-only
```

Each command previews the affected record and requires confirmation before applying. Cancellation leaves the registry unchanged. Removing a channel does not delete artwork or flavor content.

## Validation and review

After a confirmed change, the CLI runs `npm run validate` and restores the exact previous registry bytes if validation fails. Preview any command without writing by adding `--dry-run`. You can also run:

```sh
npm run validate
npm run verify:reproducible
```

The existing Website renderer omits disabled channels from public flavor pages. Keep both Cannaland and Splift disabled until separately approved and explicitly authorized for a production change.

## Production boundary

Development authorization permits local configuration work only. A valid HTTPS destination does not establish a partnership, commission, product listing, commercial eligibility, or publication approval. Production activation requires the existing Studio provenance/publication and owner authorization controls, followed by a separately reviewed change. The development-only flag does not bypass these controls, and this workflow has no command to activate a channel.
