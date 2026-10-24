# Customer contact configuration

The Contact page supports two independent customer contact methods in English and Mexican Spanish: a business email and WhatsApp Business. Their configuration belongs in `content/site.json`; it is separate from `content/sales-channels.json`, which controls external sales referrals. Contact links do not collect or store customer messages on this static site.

Both destinations are currently unset. Keep them `null` until the owner verifies the exact business destination, approves it for public display, and confirms who will respond. Do not substitute a personal address or number.

## Configure a verified destination

1. Obtain the exact business email or WhatsApp Business number directly from the owner. Confirm the responder and expected handling of inbound messages.
2. Confirm the owner has approved public display of that method and has completed any applicable privacy, commercial, and legal review. This configuration step does not itself authorize publication or a public release.
3. Edit only the corresponding property in `content/site.json`, preserving the other method independently. For example, after verification, replace `null` under `businessEmail` with the exact address string, or replace `null` under `whatsappBusinessUrl` with an exact URL of the form `https://wa.me/<country-code-and-number-digits>`. The WhatsApp path contains digits only, with no plus sign, spaces, query string, or fragment.
4. Run `npm run validate`, `npm run verify:reproducible`, and `git diff --check`. Check both `/contact/` and `/es/contact/` in the generated local output. Keep development and review output noindex and isolated.
5. Record owner verification and approval in the separately reviewed change that activates the destination. Do not enable the method in an implementation change without the verified value and authorization.

The closed site schema and input validator reject malformed email addresses and unsupported WhatsApp destinations. An absent or null method is omitted as a link. If both are absent, the Contact panel shows a localized development placeholder rather than an inactive or broken button. Email opens a `mailto:` handler. WhatsApp opens the exact HTTPS `wa.me` destination in a new tab with `noopener noreferrer`.

Contact destinations are never read from the sales-partner registry. Configuring contact does not enable Splift, Cannaland, any other sales channel, checkout, order collection, analytics, tracking, search indexing, or publication.
