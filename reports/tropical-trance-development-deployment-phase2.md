# Tropical Trance Development Deployment — Phase 2 Report

## Superseding Phase 2 security remediation (2026-10-26)

This section supersedes earlier variable names, credential-scope statements, project-variable controls, and stale-deployment claims in this report. The current source of truth is `docs/cloudflare-development-deployment.md` and the reviewed workflow/policy code.

- The workflow hard-codes the reviewed Pages project `tropicaltrance-web`. It uses only development environment variables `CLOUDFLARE_DEV_ACCESS_READY` and `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED`, plus secrets `CLOUDFLARE_DEV_API_TOKEN` and `CLOUDFLARE_DEV_ACCOUNT_ID`. Both authorization values must equal exact lowercase `true`; missing or malformed values fail closed. Create/review the GitHub environment explicitly and set both to `false` while deployment is disabled; audit organization/repository scopes manually.
- The shared Pages project presents an accepted credential blast radius: Cloudflare Pages `Pages Write` permission is not verified as project- or branch-limited. `--branch development` constrains this reviewed command, not the token. A modified/compromised workflow could target production in the same account/project. Separate development names, restricted environment branches, policy tests, limited writers, and an optional required environment reviewer are compensating controls, not isolation.
- Direct pushes to `development` remain allowed by decision. A writer able to change workflow and policy source can potentially change both; local source policy checks do not independently defend against that writer. Keep writers limited and consider an independent required environment reviewer. No rulesets/settings changed.
- Immediately before Wrangler upload, the workflow queries remote `development` HEAD and compares it with the triggering SHA. API failure, malformed SHA, or mismatch stops deployment. A narrow race remains if the branch advances after this check during upload.
- `playwright.config.ts` now passes `--ignore-lock` to Astro. Pinned Node 24.21.0/npm 11.19.0 validation and reproducibility passed. Playwright could not bind `127.0.0.1:4332` (`listen EPERM`) in the managed execution sandbox; the E2E suite was not exercised successfully.

No external GitHub or Cloudflare settings were inspected or changed during remediation; Access status and environment configuration remain owner-verified prerequisites. The detailed remediation report records final status and readiness.

---


## Executive summary

Implemented a feature-branch Cloudflare Pages development pipeline. Pushes to `development` run security policy checks, release-version tests, full website validation, reproducible build checks, browser checks, and a separately validated development artifact build. The deployment job is isolated behind the dedicated `cloudflare-development` environment and requires exact Access-readiness and owner-enablement values before it proceeds to Cloudflare credentials.

The workflow and gates are implemented locally. No Cloudflare or GitHub settings were changed, and no deployment was run. The workflow does not deploy unless the environment supplies both `CLOUDFLARE_ACCESS_READY=true` and `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED=true`. Because external environment state cannot be inspected here, the owner must verify that the deployment-enable variable is absent or false before relying on this default-disabled posture.

## Initial repository state

- Initial branch: `master` at `75a1599fe6096e400dfee1f2db2c0ac08d5a76d3`.
- Local `development` and cached `origin/development` both pointed to that same commit.
- Created `feat/cloudflare-development-deployment` directly from local `development`; branch HEAD remains the starting commit.
- Existing untracked artwork, media, historical reports, audit files, and `tools/` were present before work and were preserved. No source content or assets were modified.
- No Website `AGENTS.md`, OpenSpec changes, specs, or ADRs were present.
- Current production workflow remains manual, master-only, and bound to `cloudflare-production`; release automation and existing validation workflow were not edited.

## Implementation decisions

- Use a separate workflow triggered only by pushes to `development`; it does not run on pull requests, tags, or master pushes.
- Reuse the pinned Node `24.21.0`, npm `11.19.0`, `npm ci --ignore-scripts`, policy self-tests, release-version tests, website validation, reproducible validation, and Playwright commands already used by repository CI.
- Build the deployable artifact with indexing authorization and SEO origin explicitly empty. Require no sitemap, `noindex, nofollow`, and `Disallow: /` before artifact upload and again before deployment.
- Keep Cloudflare credentials out of checkout, policy, test, and build steps. They are mapped only to the deploy job's project preflight and Direct Upload steps.
- Target the existing `tropicaltrance-web` Pages project and Wrangler branch `development`. A read-only Cloudflare API check requires the project to exist and its production branch to remain `master`; no project-creation or project-update command is present.
- Serialize development deployments with a dedicated concurrency group. Do not cancel an in-progress upload.
- Use a separate documentation page for development deployment and amend the production deployment documentation to describe the two separate workflows.

## Files created or modified

- Added `.github/workflows/deploy-cloudflare-development.yml`.
- Modified `.github/ci/check_policy.py` to allowlist and tightly validate the development workflow, pin embedded script digests, and test rejected policy mutations.
- Added `docs/cloudflare-development-deployment.md` with environment setup, Access checks, workflow operation, and rollback instructions.
- Modified `docs/cloudflare-manual-deployment.md` to preserve and clarify the separate master production workflow and its authorization boundary.
- Added this consolidated report.

No application source, package manifest, lockfile, production workflow, release workflow, DNS, Cloudflare resource, or GitHub setting was changed.

## GitHub Actions workflow design

`.github/workflows/deploy-cloudflare-development.yml` has a single trigger: `push` to `development`. It has workflow-wide `contents: read` permissions and a dedicated `cloudflare-development` concurrency group.

The build job uses pinned full-SHA checkout, setup-node, upload-artifact, and download-artifact actions. Checkout does not persist credentials. It pins Node/npm, installs the lockfile without lifecycle scripts, checks all workflow policies and release-version tests, runs `npm run validate`, `npm run verify:reproducible`, and `npm run test:e2e`, then rebuilds and validates the exact artifact before uploading it with one-day retention.

The deploy job depends on successful build completion, checks that the event ref is exactly `refs/heads/development`, and references only `cloudflare-development`. It rejects missing or non-exact authorization values, any project slug other than `tropicaltrance-web`, invalid artifact output, a sitemap, or missing noindex/robots safeguards. It installs Wrangler `4.152.0` using the existing strict lifecycle-script allowlist, makes a read-only project preflight, and uploads with `--branch development` and the triggering commit SHA.

The preflight requires the current Cloudflare Pages `production_branch` value to remain `master`. Cloudflare documents that field on the existing Pages project response: [Get a Cloudflare Pages project](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/get/).

## Security controls and deployment authorization gates

### Implemented in repository code

- Push-only `development` trigger; explicit branch check before any credentialed step.
- Least-privilege GitHub token permission: `contents: read` only.
- No Cloudflare secret reference in build job. No secret value is printed.
- Dedicated environment name `cloudflare-development`; no reference to `cloudflare-production` in the development workflow.
- Access readiness must equal the exact string `true`.
- Owner deployment enablement must equal the exact string `true`.
- Pages project variable must exactly match `tropicaltrance-web` and be a valid lowercase slug.
- Missing, malformed, false, wrong-ref, or wrong-project authorization fails before credentials are mapped into shell steps.
- Only validated artifact is transferred to deploy job; deploy artifact is checked again.
- SEO publication/indexing inputs are cleared for build; sitemap absence, noindex, and robots disallow are checked.
- Cloudflare preflight is read-only and fails unless the project name and production branch match expected values.
- Existing production and release workflows remain unchanged.

### Configured but not enabled by this change

- The GitHub `cloudflare-development` environment, its branch restriction, variables, and secrets must be configured by an owner. No setting was changed here.
- To keep deployment blocked, leave either readiness variable absent or set to a value other than exact `true`. A fresh environment has neither value unless an owner adds it. Before using any pre-existing environment, verify the deployment-enable variable is not already `true`.
- Only after independent Access verification and explicit owner authorization should the owner set both required values to `true`.
- GitHub environment branch restrictions and reviewer availability depend on repository visibility and plan. Confirm `development` is the only allowed deployment ref in GitHub Settings → Environments.
- Cloudflare Access, Pages project settings, DNS, and hostname behavior are external and unverified by local tests.

## GitHub environment variables and secrets required

Create `cloudflare-development` manually and restrict it to the `development` branch.

Variables:

- `CLOUDFLARE_PAGES_PROJECT`: `tropicaltrance-web`.
- `CLOUDFLARE_ACCESS_READY`: leave absent/false until Access tests pass; then exact `true`.
- `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED`: leave absent/false by default; exact `true` is the explicit owner opt-in for automatic deployments.

Environment secrets, not repository-wide secrets:

- `CLOUDFLARE_API_TOKEN`: a separate development token, least privilege Cloudflare Pages edit permission scoped to the intended account/project where Cloudflare permits.
- `CLOUDFLARE_ACCOUNT_ID`: account identifier.

No secret values are included in this report. Do not reuse production environment credentials without separate review; prefer a distinct token for the development environment.

## CI policy modifications

`.github/ci/check_policy.py` now allows exactly the four reviewed workflows and validates the development workflow structure, branch trigger, minimal permissions, validation command list, pinned actions and toolchain, artifact, noindex build, `cloudflare-development` environment, authorization inputs, credential scope, Wrangler install, existing-project preflight, and development branch upload. Embedded shell scripts are pinned by SHA-256 values.

New negative policy cases reject master/PR triggers, writable GitHub permissions, production environment use, missing Access/owner flags, malformed readiness, disabled deployment acceptance, fail-open gate changes, wrong project, Cloudflare credentials in build, production branch upload, project creation, unreviewed Wrangler scripts, missing SEO validation, and removal of the production-branch preflight.

## Test commands and results

- `actionlint .github/workflows/*.yml` — passed.
- `python3 -B .github/ci/check_policy.py --self-test` — passed, including all new development deployment negative cases and the existing production/release cases.
- `python3 -B -m unittest discover -s .github/ci -p 'test_release_version.py' -v` — passed, 5 tests.
- `npm run validate` — passed, 123 tests; normal and synthetic review builds validated.
- `npm run verify:reproducible` — passed, 2 tests.
- Direct authorization gate exercise with synthetic environment values — passed: missing readiness, malformed readiness, deployment disabled, wrong branch, and wrong project all exited nonzero before credentialed steps.
- `bash -n` on all `run` scripts in the new workflow — passed.
- `git diff --check` — passed.
- `npm run test:e2e` — blocked locally: the configured Astro dev server exited before becoming ready with `SKIP_FORMAT`. Re-running `npm run dev -- --port 4332 --strictPort` reproduced the same Astro dev-server exit. Browser tests did not run. Earlier reports record the same local limitation. The workflow retains the existing CI browser-test command, but remote CI was not exercised.
- Available local runtime: Node `v23.2.0`, npm `10.9.0`; workflow installs and checks the repository-pinned Node/npm versions. Local tests did not verify the GitHub-hosted pinned runtime.
- No Cloudflare API call, GitHub API/settings operation, or deployment was performed.

## Risks and unresolved prerequisites

- Access policy is an owner attestation, not something the workflow can verify. The actual Cloudflare Access state is unknown here.
- Pages default hostnames, branch aliases, and per-deployment URLs may be publicly reachable if Access is incomplete. `noindex` and robots directives do not restrict access.
- The planned `dev.tropicaltrance.io` hostname is not configured by this change. Any future domain requires separate owner authorization, DNS change approval, a dedicated Access application/policy, and independent verification.
- A direct push to `development` triggers validation/build. Once the owner enables both environment variables, successful future pushes deploy automatically. Confirm who can write to `development` before opt-in.
- The local Playwright web server issue remains unresolved; remote GitHub Actions behavior is not claimed.
- The existence and settings of GitHub environments and Cloudflare project/access settings were not independently inspected. The workflow fails closed on missing values, but the owner must inspect any existing environment before enabling it.

## Manual Cloudflare Access verification checklist

- [ ] Configure Access to protect the exact base hostname `tropicaltrance-web.pages.dev`.
- [ ] Configure Access to protect every preview and branch deployment hostname for this Pages project, including the `development` branch alias and individual deployment URLs.
- [ ] Verify anonymous sessions are denied and named reviewers are admitted for each hostname scope.
- [ ] Verify identities outside the allow policy are denied.
- [ ] Test direct HTML and asset requests, not just the home page.
- [ ] Check redirects and alternate hostnames for bypasses.
- [ ] Recheck the exact generated deployment URL after the first authorized deployment.
- [ ] Confirm the production branch remains `master` and no production setting has changed.
- [ ] Keep `dev.tropicaltrance.io` and DNS unchanged until a separate authorization and Access review.
- [ ] Only after all checks, set `CLOUDFLARE_ACCESS_READY=true`; set `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED=true` only with explicit owner approval.

## Rollback procedure

1. For a suspected exposure, immediately apply/reinforce Cloudflare Access for affected hostnames and verify anonymous requests fail. Remove or disable `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED` to stop future uploads; remove readiness as an additional block.
2. For a faulty development build, create a reviewed revert/fix commit on `development`. Its push reruns validation and, if explicitly enabled, deploys the corrected contents to the development branch.
3. Verify the deployment commit SHA, HTTPS, bilingual routes, navigation, and assets. Confirm `noindex, nofollow`, `Disallow: /`, no sitemap, no sales/checkout, and Access behavior.
4. If a platform-side rollback or removal is needed, the Cloudflare owner must perform it through the dashboard; this workflow does not automate rollback or change Pages settings.
5. Keep production operations separate. Production rollback remains governed by `docs/hosting-release-runbook.md` and the manually authorized master workflow.

## Final Git status and diff summary

- Branch: `feat/cloudflare-development-deployment`.
- Base/start commit: `75a1599fe6096e400dfee1f2db2c0ac08d5a76d3` (`development` at branch creation).
- Modified tracked files: `.github/ci/check_policy.py`, `docs/cloudflare-manual-deployment.md`.
- Added files: `.github/workflows/deploy-cloudflare-development.yml`, `docs/cloudflare-development-deployment.md`, and this report.
- Existing untracked artwork, media, historical reports, audit files, and `tools/` remain untouched.
- No files staged. No commit, push, PR, merge, deployment, DNS, Cloudflare, or GitHub settings operation occurred.

## Recommended next steps

1. Review this branch and report, including the local browser-test limitation.
2. In GitHub, verify or create `cloudflare-development`, restrict it to `development`, and confirm the two deployment authorization variables are absent/false. Add a separate least-privilege development token only when ready.
3. In Cloudflare, independently verify Access protection for the base project host, branch alias, and preview deployment hostnames. Do not add `dev.tropicaltrance.io` or DNS in this step.
4. Resolve the Astro dev-server/Playwright local failure or rely on a passing remote CI run before merging.
5. After owner review and explicit authorization only, set the readiness and enablement variables, then merge through the intended protected process. Do not enable indexing or production deployment as part of development opt-in.
