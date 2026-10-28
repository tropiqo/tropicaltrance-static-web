# Tropical Trance Development Deployment — Phase 2 Security Remediation

Date: 2026-10-26  
Branch: `feat/cloudflare-development-deployment`  
Base branch: `development`

## Executive summary

Implemented the four approved security remediations while preserving the shared Pages project, `master` production branch, persistent `development` branch, direct-push strategy, and manually authorized production workflow. Development deployment remains gated by exact environment-level authorization and has not been enabled or run. The Playwright config now requests Astro `--ignore-lock`; the E2E run remains blocked because this execution sandbox refuses loopback binding. Recommendation: **NOT READY FOR PR** until the complete E2E suite passes in an authorized host/CI environment and the final diff is reviewed.

No commit, push, PR, deployment, GitHub settings change, Cloudflare change, or DNS change occurred.

## Claude findings and disposition

| Finding | Disposition |
|---|---|
| F-1: Environment/repository/org variable and credential collisions | Addressed in workflow and documentation. Uses `CLOUDFLARE_DEV_ACCESS_READY`, `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED`, `CLOUDFLARE_DEV_API_TOKEN`, and `CLOUDFLARE_DEV_ACCOUNT_ID`. The Pages slug is hard-coded as `tropicaltrance-web`. Exact `true` gates are required. Environment values should be explicitly set to `false` until authorized; org/repository scopes must be audited manually. |
| F-2: Shared-project token can affect production | Accepted residual risk under the confirmed architecture and documented prominently. Cloudflare Pages `Pages Write` permission is not known to be branch- or project-limited. `--branch development` is a workflow command argument, not a token restriction. No claim of project/branch-scoped token enforcement is made. |
| F-3: Direct-push workflow integrity | Preserved as directed. Documentation explains that development writers can alter workflow code and possibly its in-repo policy together. Limited writers, development-only environment branch restriction, strict authorization, and optional required environment reviewer are compensating controls; no rulesets/settings changed. |
| F-4: Stale deployment rerun | Addressed. Immediately before upload, query `repos/$GITHUB_REPOSITORY/commits/development`; reject unavailable, malformed, or nonmatching SHA. Policy tests exercise current, stale, and unverifiable cases. A narrow race remains if branch HEAD changes after the check while upload is in progress. |

## Files changed

- `.github/workflows/deploy-cloudflare-development.yml` — unique development secret/variable names; hard-coded project; fail-closed gates; current remote HEAD check immediately before Wrangler.
- `.github/ci/check_policy.py` — structural and negative policy coverage for unique names, project, and stale-SHA check; local synthetic execution tests prove stale/unverifiable sources stop before synthetic upload.
- `playwright.config.ts` — Astro dev server gets `--ignore-lock`.
- `docs/cloudflare-development-deployment.md` — environment setup, Access, shared-project risk, workflow integrity, stale check/race, rollback.
- `docs/cloudflare-manual-deployment.md` — clarifies separation and residual shared-project credential risk; production workflow itself is unchanged.
- `reports/tropical-trance-development-deployment-phase2.md` — superseding remediation addendum corrects earlier configuration and security statements.
- `reports/tropical-trance-development-deployment-remediation.md` — this report.

Existing untracked artwork, media, earlier reports, audit files, and `tools/` were preserved.

## Implementation decisions

### Variable and secret isolation

Only environment-level development names are referenced by the development workflow: variables `CLOUDFLARE_DEV_ACCESS_READY` and `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED`; secrets `CLOUDFLARE_DEV_API_TOKEN` and `CLOUDFLARE_DEV_ACCOUNT_ID`. The workflow uses the reviewed slug `tropicaltrance-web` directly and verifies the existing project reports production branch `master`. Missing or malformed gate values fail closed.

A GitHub environment may be implicitly created if referenced but not configured; that is not equivalent to configured safeguards. Create `cloudflare-development` manually before relying on it, restrict deployments to `development`, audit repository/organization variables and secrets for collisions, and put explicit `false` values in the environment during the disabled period. Secrets are available only in the deploy job's read-only project preflight and final upload steps; they are not present in checkout, validation, build, or artifact steps.

### Shared-project risk

The same Cloudflare Pages project serves `development` and `master`. The workflow uploads with `--branch development`, but Cloudflare API credential scope is not verified as branch-specific or project-specific. The development token should be treated as potentially able to write production deployments in the shared account/project. Workflow code could be changed by a development writer to target `master`. Separate names/environment, hard-coded project and production-branch preflight, restricted environment branch, strict policy, limited writers, and optional environment reviewer reduce accidental exposure but do not remove token blast radius. Owner must accept this risk before enabling deployment.

### Workflow integrity and stale deployment

Direct pushes remain permitted by decision. Strict checks protect against reviewed drift, not a malicious or compromised writer who changes both code and its co-located validator. Keep workflow writers limited; use an independent required reviewer on `cloudflare-development` if available and appropriate. Environment reviewer support depends on GitHub plan/repository visibility and reviewer configuration. No GitHub repository settings were changed.

Before Wrangler, the workflow queries GitHub's current `development` ref using the job's `contents: read` token. It fails closed on query failure, invalid SHA, or a SHA mismatch. The check runs immediately before upload. A short check-to-upload race remains possible if a newer push advances the branch during Wrangler upload; concurrency serializes runs and the newer run becomes the next eligible deployment.

### Production boundary

The manually authorized production workflow was not modified. No production trigger, custom domain, DNS, indexing, checkout, or sales behavior was introduced. Development deployment remains disabled unless an owner later completes Access verification and sets both exact gates to `true`.

## Tests and validation

Executed with Node `v24.21.0` and npm `11.19.0` via the repository-pinned nvm runtime where applicable:

- `actionlint .github/workflows/deploy-cloudflare-development.yml .github/workflows/deploy-cloudflare.yml .github/workflows/create-release.yml .github/workflows/validate.yml` — passed (exit 0).
- `python3 -B .github/ci/check_policy.py --self-test` — passed. Existing production/release checks and new development negative cases all rejected prohibited mutations; synthetic authorization/stale-SHA execution cases passed.
- `python3 -B .github/ci/test_release_version.py` — passed, 5 tests.
- `npm run validate` — passed under Node 24.21.0/npm 11.19.0; structural validations and normal/review output validation completed.
- `npm run verify:reproducible` — passed under Node 24.21.0/npm 11.19.0; 2 tests passed, normal and synthetic review output deterministic.
- `npm run test:e2e` — **not passed**. Astro attempted to bind `127.0.0.1:4332` and got `listen EPERM: operation not permitted`; browser tests did not start. The `--ignore-lock` change is present, but this managed sandbox blocks the local server bind.
- `git diff --check` — passed before report generation; final result is recorded after a post-report rerun.
- No Cloudflare API or GitHub remote/settings operation was performed. No actual deploy was attempted.

## Remaining security risks

- Shared Cloudflare Pages write credential may be capable of changing production deployment in the same project/account. Actual token scoping was neither inspected nor independently verified.
- Direct-push writers can alter the development workflow; an in-repository policy test is not an independent boundary.
- A narrow race exists between the remote-HEAD check and upload.
- Access coverage for base `pages.dev`, development alias, and individual deployment hostnames is not verified. Search-engine controls are not access controls.
- GitHub environment restrictions/secrets/reviewers and org/repo variable scopes were not inspected or changed.
- Playwright full E2E result remains unverified due loopback restriction.

## GitHub and Cloudflare prerequisites

Before enabling automatic deployment, an owner must: create/review `cloudflare-development`; restrict it to `development`; set both gates explicitly false initially; audit repository and organization scopes for exact dev names; configure only development-specific secrets; decide whether an independent environment reviewer is available; independently test anonymous rejection and allowed reviewer access for base, branch, and per-deployment hostnames; confirm `master` remains the Pages production branch; accept the shared-project token blast radius; and record the approving owner. Do not configure a custom domain or DNS under this change.

### Cloudflare Access verification checklist

- [ ] Protect `tropicaltrance-web.pages.dev`, the `development` alias, every preview/per-deployment hostname, and asset routes.
- [ ] Anonymous browser and direct resource requests are rejected; authorized named reviewers are admitted; nonmembers are rejected.
- [ ] Check redirects/alternate hostnames for bypasses and test the exact deployment URL after a deployment is separately authorized.
- [ ] Keep custom development hostname and DNS unchanged; separately authorize and protect any future hostname.
- [ ] Record verifier/date; only then set `CLOUDFLARE_DEV_ACCESS_READY=true`. Owner separately approves setting deployment enabled to exact `true`.

### Rollback / emergency stop

Set `CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED=false` (and readiness false if access assurance is revoked) to stop future runs. For exposure, immediately apply Access protection at every affected hostname and verify anonymous rejection. For faulty content, revert/fix on `development`, verify the deployment SHA and routes; platform rollback/removal requires the Cloudflare owner via dashboard. Production rollback remains separate under the production runbook.

## Final Git diff and status

`git diff --check` passed. Tracked modifications are limited to the policy, production deployment documentation, and Playwright config. New intended files are the development workflow, development deployment documentation, and two reports listed above. Pre-existing unrelated untracked art, media, prior reports, audit files, and tools remain unstaged and untouched. No files are staged and no commit was created.

The current branch is `feat/cloudflare-development-deployment`; no remote fetch was needed or performed for this local remediation. Final `git status --short`: modified tracked files are `.github/ci/check_policy.py`, `docs/cloudflare-manual-deployment.md`, and `playwright.config.ts`; intended untracked outputs are `.github/workflows/deploy-cloudflare-development.yml`, `docs/cloudflare-development-deployment.md`, and the two development deployment reports. Pre-existing untracked artwork/media, other historical reports, `tools/`, and audit files remain present. No staged paths; HEAD remains `75a1599fe6096e400dfee1f2db2c0ac08d5a76d3`.

## Recommendation

**NOT READY FOR PR.** The E2E suite must run successfully in an environment that permits the configured local web server to bind, followed by final diff/status review. External Access and environment configuration remain prerequisites before deployment enablement, though they are not prerequisites to a PR that retains both authorization gates false.
