# Cloudflare Pages development deployment

## Scope and status

Pushes to `development` run validation and build the site. A successful run can upload only to the existing `tropicaltrance-web` Pages project using Pages branch `development`; `master` remains the production branch and the manually authorized `cloudflare-production` workflow remains separate and unchanged.

The development workflow uses `cloudflare-development`. Deployment fails closed unless `CLOUDFLARE_DEV_ACCESS_READY` and `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED` are each exactly `true`. The Pages project name is hard-coded as `tropicaltrance-web`; there is no project-name variable that can be inherited or redirected. The workflow clears indexing inputs and checks `noindex, nofollow`, `Disallow: /`, and absence of a sitemap.

No Cloudflare or GitHub settings are configured by the repository workflow. Before merging changes that cause a push to `development`, an owner should create/configure the environment, limit it to `development`, and set both deployment gates to explicit false values. GitHub can create an empty environment automatically when a workflow first references an absent environment; do not rely on that auto-created environment to have branch restrictions or safe variable values.

Search directives are not access controls. Access protection must be independently verified before the owner sets either gate to `true`.

## GitHub environment configuration

Create `cloudflare-development` manually in repository Settings → Environments **before the workflow is allowed to run against `development`**. Restrict deployment branches to `development` only. This workflow does not require adding environment reviewers or changing repository branch rules.

Set these variables at the `cloudflare-development` environment scope only, initially to `false`:

- `CLOUDFLARE_DEV_ACCESS_READY`
- `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED`

After Access verification, the owner may set `CLOUDFLARE_DEV_ACCESS_READY=true`. Set `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED=true` only after explicit owner approval for automatic deployment. The workflow requires exact lowercase `true`; empty, absent, malformed, or false values block upload.

Use these secrets at the `cloudflare-development` environment scope only:

- `CLOUDFLARE_DEV_API_TOKEN`: a dedicated development token with the Pages write permission needed for deployment.
- `CLOUDFLARE_DEV_ACCOUNT_ID`: Cloudflare account ID.

The workflow maps these unique development secret names to Wrangler's standard process variable names only in the final upload step. It uses the development-specific names in its read-only project preflight. It never references the production environment, production credential names, repository-wide Cloudflare secret names, or a shared project-name variable.

GitHub variables and secrets can also exist at repository or organization scope. Before enabling deployment, inspect those scopes for the exact four development-specific names and remove or shadow any inherited values. Keep the readiness variables explicitly false at environment scope until the prerequisites are met. The production workflow uses separate pre-existing names, so those values are not intentionally reused.

Verify the GitHub environment branch restriction directly rather than inferring it from the workflow. This implementation does not change environment approvals or repository rules.

## Shared-project credential risk (accepted)

The development workflow deliberately shares `tropicaltrance-web` with production. Cloudflare's Pages deployment API documents the `Pages Write` permission for creating deployments and accepts a `branch` value; it does not establish a GitHub workflow boundary between development and production ([Cloudflare Pages deployment API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/create/)).

The workflow uses `--branch development`, hard-codes the project slug, performs a read-only preflight that checks the project name and `production_branch == master`, and contains no project-create/update command. These controls constrain the reviewed workflow's intended behavior; they do **not** constrain the token itself to a branch. We have not verified a project-level or branch-level Cloudflare token restriction. Treat the development token as potentially able to write a production deployment in the same account/project. A modified or compromised workflow could use the same credential to target `master`.

Compensating controls are the separate development secret names and environment, restricted environment branch, exact workflow policy checks, protected/no-force-delete branch rules, limited writers, and exact deployment authorization gates. These do not remove the underlying credential blast radius. The shared-project residual risk is accepted by the owner architecture decision; do not describe it as production-isolated by token scope.

## Workflow integrity and direct pushes

Direct pushes to `development` are an accepted operating decision. The push workflow runs the workflow definition from that pushed commit, and authorized development writers can edit the workflow and `.github/ci/check_policy.py` in the same change. The local policy self-test is strict and useful for detecting accidental drift, but it is not an independent security boundary against a writer who can alter both the workflow and the validator.

No repository ruleset or settings were changed for this work. Before enabling deployment, confirm the active development ruleset still blocks deletion and force pushes and identify every writer allowed to push. Keep workflow/policy edits limited to trusted owners. Restrict the `cloudflare-development` environment to `development`.

## Workflow behavior

`.github/workflows/deploy-cloudflare-development.yml` runs only on pushes to `development`. It uses pinned Node `24.21.0`, npm `11.19.0`, `npm ci --ignore-scripts`, repository policy and release-version tests, website validation, reproducible checks, and Playwright. It builds an artifact with indexing inputs empty and validates the artifact before upload. Cloudflare credentials are absent from checkout, validation, build, and artifact jobs.

The deployment job validates the environment gates and non-indexable artifact, installs Wrangler `4.152.0` with the reviewed lifecycle-script allowlist, checks the existing Pages project and its `master` production branch using a read-only API request, then checks the current remote `development` head through the GitHub API immediately before invoking Wrangler. It refuses to upload if the remote SHA is unavailable, malformed, or differs from the workflow's source SHA. The GitHub API read uses the workflow's `contents: read` token; Cloudflare credentials are supplied only to the project preflight and final upload steps.

Concurrency serializes the workflow without cancelling an in-progress deploy. GitHub keeps at most the newest pending run for a concurrency group, so intermediate queued pushes may not each deploy. A newer push that arrives during an upload can still advance the branch after the final pre-upload check; the newer run will follow the active one. This is a small unavoidable check-to-upload race, not a guarantee of atomic deployment against concurrent pushes.

## Cloudflare Access verification before enabling deployment

An owner must verify this checklist in Cloudflare and through browser sessions before setting `CLOUDFLARE_DEV_ACCESS_READY=true`:

- [ ] Protect the exact base hostname `tropicaltrance-web.pages.dev`; anonymous browser and direct asset requests are rejected.
- [ ] Protect every preview and branch deployment hostname for this Pages project, including the `development` branch alias and per-deployment URLs. Verify wildcard coverage does not protect only the base hostname.
- [ ] Test an actual deployment URL and branch alias. Confirm unauthenticated sessions are rejected, an allowed named reviewer is admitted, and an identity outside the allow policy is rejected.
- [ ] Test direct HTML, `/robots.txt`, images, scripts, and media requests, not only the home page.
- [ ] Check redirects and alternate hostnames for bypasses.
- [ ] Keep `dev.tropicaltrance.io` and DNS unconfigured. Any future custom hostname requires separate owner authorization and its own Access coverage and verification.
- [ ] Confirm the Pages production branch remains `master` and no production setting changed.
- [ ] Record who verified Access and when. The workflow cannot verify Access; the variable is an owner attestation.

After first deployment, repeat the access checks against the exact generated URL and alias before sharing them. Access on `pages.dev` does not automatically protect a future custom domain.

## Run and verify

When the environment is configured with false gates and access review is pending, pushes still validate and build but deployment stops at the gate. After independent Access verification and explicit owner opt-in, a push to `development` deploys automatically after all checks pass. Verify the source SHA, build outputs, read-only project preflight, current-HEAD check, and Wrangler's `development` target in the Actions run.

Verify HTTPS, authentication and rejection behavior, English and Spanish routes, navigation, and assets. Confirm HTML remains `noindex, nofollow`, robots disallows crawling, no sitemap exists, there is no production hostname/custom domain, and no sales/checkout destinations or secrets are exposed.

## Rollback and emergency stop

To stop future automatic uploads, set `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED=false` or remove the environment value; also set `CLOUDFLARE_DEV_ACCESS_READY=false` if Access readiness is revoked. Because repository/organization values may be inherited when environment values are missing, prefer explicit environment-level false values as the kill switch. For suspected public exposure, immediately restrict affected hostnames in Cloudflare Access and verify anonymous rejection; disabling indexing is not an emergency access control.

For a bad development build, create a reviewed revert/fix commit on `development`. Its push reruns validation and, if explicitly enabled, deploys the corrected site. Old workflow reruns are refused unless their source SHA is still current branch HEAD. Verify the deployed SHA and routes afterward. If platform-side rollback or removal is required, the Cloudflare owner must use the Pages dashboard; this workflow does not automate rollback. Production rollback remains governed by [the production runbook](hosting-release-runbook.md) and manual production workflow.

This workflow does not deploy `master`, publish the production hostname, authorize indexing, activate sales, or provide checkout.
