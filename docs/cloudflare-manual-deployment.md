# Manual Cloudflare Pages deployment

This runbook describes a manually triggered Direct Upload from the protected `master` branch. It does not configure Cloudflare, authorize a public launch, activate indexing or sales, or run a deployment. The deployment workflow has no push or pull request trigger.

## Public access is a release blocker

Cloudflare Pages deployments and the default `<project>.pages.dev` hostname are public unless access is restricted. `noindex`, `robots.txt`, and the site's current development SEO settings do not authenticate visitors or prevent direct access. Preview Access policies do not automatically cover the root `<project>.pages.dev` hostname; custom domains also need separate policies. See [Cloudflare's Pages Access guidance](https://developers.cloudflare.com/pages/platform/known-issues/) and [preview deployment access behavior](https://developers.cloudflare.com/pages/configuration/preview-deployments/).

Before the first workflow deployment:

1. The Cloudflare account owner creates the Pages project manually using Direct Upload. Configure its production branch as `master` where the project settings permit it. Do not connect Git integration. Do not upload the site from project setup, add a custom domain, or change DNS. If Cloudflare's setup flow requires a content upload before Access can be configured, stop and do not proceed with this workflow.
2. Configure Cloudflare Access for both the exact base hostname `<project>.pages.dev` and the preview hostname pattern `*.<project>.pages.dev`, allowing only named reviewers. Apply the Pages Access policy and, if the root hostname remains excluded, follow Cloudflare's documented Manage application procedure to remove the wildcard subdomain from the root Pages app and create the separate preview app policy.
3. Test the root and preview hostnames from an unauthenticated browser session and verify they reject access. Test an approved reviewer session and verify it succeeds. If the hostname cannot be tested before the initial deployment, do not attest readiness or dispatch; obtain a Cloudflare-supported way to protect it first.
4. Keep the project without a custom domain. Cloudflare Access on `pages.dev` is not proof that a future production domain is protected.

Cloudflare's [Direct Upload workflow](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) supports deploying a directory to an existing Pages project. The workflow first calls the read-only project endpoint and fails if the configured project does not exist; it never runs a project-creation command. Wrangler's [Pages deploy command](https://developers.cloudflare.com/workers/wrangler/commands/pages/) performs the upload.

## Cloudflare configuration

Create a scoped API token with the minimum required account permission **Cloudflare Pages: Edit** for the one intended account. Do not use the global API key. Store the account ID and token only as environment secrets. Keep the account, project, and token under the owner's control.

The workflow expects an existing GitHub Actions environment named `cloudflare-production`. In repository **Settings → Environments**, create it and configure:

- Deployment branch rule: selected branches only, `master`.
- Environment secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Environment variables: `CLOUDFLARE_PAGES_PROJECT` set to the manually created project's verified slug; `CLOUDFLARE_ACCESS_READY` set to `true` only after the Access tests above pass.
- Keep environment approvals enabled where the repository plan and reviewer model support them. A deployment branch rule is required even though the workflow independently rejects other refs.

Environment secrets are only referenced in the deployment job's project-check and upload steps. The authorization and build jobs have no environment and receive no Cloudflare secrets. The build uses `.nvmrc`'s Node `24.21.0`, npm `11.19.0`, `npm ci --ignore-scripts`, `npm run build`, and `npm run validate:output`. It requires `dist/index.html`, a `robots.txt` with `Disallow: /`, `noindex, nofollow` in the home page, and no sitemap. It passes no indexing authorization or production SEO origin.

The workflow uses pinned full-SHA GitHub artifact actions and Wrangler CLI `4.152.0`. The Pages project slug is read from the environment variable; the workflow does not infer or create it. The Pages upload uses branch `master` and records the triggering commit SHA.

### GitHub environment approval limitation

GitHub plan and repository visibility affect which environment rules are enforced. For private repositories, environment deployment branch restrictions and secrets require an eligible paid plan. Required reviewers for private repositories are not available on GitHub Free, Pro, or Team; a one-maintainer repository also cannot use a required self-review as an independent approval gate. Verify the current plan behavior in [GitHub's environment documentation](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments). The explicit manual input is an operator confirmation, not a substitute for a second reviewer. If an independent approval is required but unavailable, keep deployment disabled until an owner-selected approval control exists.

## Manual release

Only after the protected `master` branch, environment restrictions, existing project, and Access protections are reviewed:

1. In GitHub Actions, select **Manual Cloudflare Pages deployment → Run workflow** and choose `master`.
2. Type `DEPLOY_TO_PAGES`, check the Access verification box, and check the separate publication approval box only after public deployment of that exact `master` commit is approved. These are explicit dispatch gates, not a technical re-test of Cloudflare Access. The workflow also requires `CLOUDFLARE_ACCESS_READY=true`. Public publication is not approved by this implementation; leave that box unchecked unless a later owner decision authorizes the release.
3. Confirm the authorization job passes before the build. A non-`master` ref or missing/mistyped confirmation fails before any environment credential is available.
4. Review the Node/npm version, build and output validation, artifact creation, and deployment logs. The deployment job checks the configured existing project, installs the pinned Wrangler version, and Direct Uploads `dist` to that project.

Do not dispatch unless public publication is separately approved for the exact `master` commit. This workflow itself does not add a domain or enable indexing or sales. Note that an uploaded build may be publicly reachable at `pages.dev` if Access is misconfigured; stop and restrict access immediately if an unauthenticated check succeeds.

## Verify and roll back

After an approved deployment, verify the Cloudflare deployment identifies the triggering commit SHA, HTTPS, expected `pages.dev` hostname, authenticated and unauthenticated Access behavior, English and Spanish routes, navigation, assets, and the development SEO state. Confirm the deployment has no custom domain, sitemap, enabled contact/sales destination, checkout, or exposed secret. Record the deployed SHA, deployment ID/URL, operator, time, and verification result.

To roll back, select the previous known-good **production deployment** in Cloudflare Pages and use its rollback action. Immediately verify the restored deployment ID and commit SHA, Access behavior, routes, assets, and SEO state. Keep access restricted if checks fail. Then reconcile the serving version with protected Git history through a reviewed revert/fix PR. A Pages rollback does not change Git history.

## Separate preview from production

This workflow deploys only `master` to the `cloudflare-production` environment. It creates no preview deployment. If a protected preview is later approved, use a separate Cloudflare Pages project, GitHub environment, credential scope, and manually reviewed workflow; protect both its base `pages.dev` and preview hostnames. Never reuse production credentials or infer production publication approval from a successful preview.
