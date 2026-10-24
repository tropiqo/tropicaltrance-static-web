# Hosting, release, and rollback runbook

**Status:** operational plan only. Cloudflare Pages is the approved hosting architecture, but no project, integration, deployment, public release, or indexing is currently authorized.

## 1. Cloudflare Pages configuration

| Field | Setting |
| --- | --- |
| Framework | Astro |
| Repository root | `/` |
| Build command | `npm run build` |
| Build output | `dist` |
| Node | `24.21.0` (`.nvmrc` and `NODE_VERSION`) |
| npm | `11.19.0` (`NPM_VERSION`) |

Keep `.npmrc` and the lockfile install behavior intact. In the first gated build log, verify `node --version` is `v24.21.0`, `npm --version` is `11.19.0`, dependencies install from the lockfile, and the build exits successfully. Stop preview acceptance if the exact runtime cannot be confirmed. No build secrets are needed. Leave `TROPICAL_SEO_ORIGIN` and `TROPICAL_INDEXING_AUTHORIZATION` unset unless a separate indexing launch is approved.

## 2. Initial protected preview setup

1. Confirm the Cloudflare account, permanent project slug, reviewer identities, and technical owner before creating the project.
2. Before connecting GitHub, set production automatic deployments **off**, preview branches **None**, and attach no custom domains. Make no DNS changes.
3. Configure Cloudflare Access to allow only named reviewers and deny everyone else. Protect both the base `<project>.pages.dev` hostname and the Pages preview deployment hostname pattern. These are separate hostname scopes; verify both policies exist. If a custom hostname is added in a later phase, it needs its own policy.
4. Connect the Website repository only after confirming both deployment classes remain held and there is no existing deployment. Use the settings above. Connecting Git can trigger builds, so recheck the held settings immediately before and after connection.
5. If the project creation or Git connection flow cannot prevent an initial publicly accessible deployment until Access and deployment controls are ready, **stop**. Do not proceed on the assumption that later Access configuration will undo exposure.
6. After configuration review, enable only the owner-approved preview branch allowlist and deliberately trigger a preview. Keep production deployment disabled. Do not share the URL until the preview checklist passes.

### Preview acceptance

- [ ] Approved reviewer authenticates; an unauthenticated session and an identity outside the allow policy are rejected.
- [ ] Both an exact deployment URL and the base `<project>.pages.dev` hostname are protected, including direct asset requests.
- [ ] English routes `/`, `/about/`, `/flavors/`, `/contact/` and Spanish routes `/es/`, `/es/about/`, `/es/flavors/`, `/es/contact/` work; language links navigate correctly.
- [ ] Images, fonts, scripts, and media load without missing assets.
- [ ] HTML metadata is `noindex, nofollow`; `/robots.txt` contains `Disallow: /`; `/sitemap.xml` is absent; production canonical links are absent.
- [ ] Contact and sales destinations remain disabled/null; there are no checkout links or exposed secrets.
- [ ] Build log confirms Node `24.21.0`, npm `11.19.0`, and successful `npm run build`.
- [ ] Production automatic deployments remain off; only the approved preview branch rule is enabled; no custom domain or DNS record is present.

Access is the confidentiality control. `noindex` and `robots.txt` do not prevent visitors from accessing a public URL.

## 3. Release authorization and deployment

The future production trigger is an **owner-approved merge into the protected production branch**. The branch name is not yet confirmed. Before enabling production deployments, the owner must configure and verify:

- Pull requests are required; direct pushes and force pushes are blocked.
- Required checks are the applicable completed Website CI checks: `Validate website` / `policy`, including repository policy self-test, `npm run validate`, `npm run verify:reproducible`, and Chromium browser checks. Confirm exact check names and branch protection in GitHub; the current workflow targets `master`, which may differ from the future production branch.
- An authorized owner reviews and approves the exact pull request and its diff; the approved PR is merged through the protected-branch process.
- Cloudflare’s production branch is set to that same protected branch. Production automatic deployment is enabled only after a separate release decision. A merge to that branch triggers the Pages production build/deployment.

Before approving a production release, record the PR, reviewed source commit, and intended release. Verify content and artwork rights, legal/commercial readiness, contact operations, and each referral destination applicable to the release. Publication approval is separate from permission to deploy infrastructure. Indexing is a further independent approval; do not set its production-only build inputs just because a site is approved for publication.

For each release, identify the exact merge commit SHA before deployment and match the Cloudflare deployment’s reported commit SHA to it. If the reported SHA differs, stop acceptance and reconcile the source/branch/deployment before proceeding.

### Production verification

- [ ] Cloudflare reports the exact approved release commit SHA and successful deployment.
- [ ] HTTPS is valid and the hostname is the owner-approved production domain.
- [ ] English and Spanish routes, navigation, images, fonts, scripts, and media work.
- [ ] Contact and only separately approved referral destinations work and point to the verified destinations. No unapproved channel or checkout path is present.
- [ ] Observed indexing state matches its separate authorization: until indexing is approved, require `noindex, nofollow`, `Disallow: /`, no sitemap, and no production canonical URLs. If indexing is authorized, verify the approved origin/canonicals, allowed robots policy, and sitemap against the approved route inventory.
- [ ] Production Access behavior matches the publication decision; preview Access does not automatically protect production or custom domains.
- [ ] Record verification result, deployment URL, commit SHA, operator, and time in the release record.

## 4. Rollback and emergency withdrawal

**Rollback** restores a previous known-good production deployment. **Withdrawal** prioritizes restricting public access when a release may expose harmful, unauthorized, or incorrect content.

1. The release/technical owner declares the incident, records the time, affected hostname, current commit/deployment ID, symptoms, and decision owner. Notify the content/commercial owner when affected.
2. For emergency withdrawal, immediately restrict access using the production hostname’s Cloudflare Access policy or the available Pages deployment controls, and disable further automatic production deployments while investigating. Do not assume preview Access covers the production hostname. If safe access restriction cannot be confirmed, the technical owner escalates to the Cloudflare account owner for service withdrawal. Record each action and time.
3. For recovery, select the last verified known-good **production** deployment in Pages and use its rollback action. Confirm the restored deployment ID and commit SHA. Preview deployments are not production rollback targets.
4. Verify HTTPS/hostname, routes, assets, contact/referral behavior, and the required indexing state against the rollback artifact. Keep the site restricted if checks fail.
5. Reconcile the serving deployment with Git: identify its commit, compare it with the protected production branch, and prepare a reviewed revert/fix PR so source history again expresses the intended state. A platform rollback alone does not change Git history; do not force-push or make an unreviewed branch change.
6. Re-enable production automatic deployment only after the cause is understood, the correction passes required checks, and the owner approves resuming releases. Record the incident, actions, restored SHA, follow-up PR, and responsible owner.

Cloudflare Pages rollback restores a prior production deployment; it does not roll back source history. [Cloudflare rollback guidance](https://developers.cloudflare.com/pages/configuration/rollbacks/)

## 5. Release classes and excluded scope

- **Protected development preview:** Access-gated review artifact on Pages; not public approval, publication, commercial approval, or indexing authorization.
- **Approved public website:** release/content/artwork/legal/commercial and publication gates are satisfied for the exact release. It may still remain `noindex`.
- **Independently authorized indexable website:** separate owner indexing decision and approved production build inputs permit crawling/indexing. Publication approval alone does not do this.
- **Future direct checkout:** excluded. No payment, order, inventory, or first-party checkout service is authorized or implemented by this runbook.

## 6. Owner decisions still required

- Cloudflare account and Access availability.
- Permanent Pages project slug and preview reviewer identities.
- Protected production branch and exact required GitHub checks/merge controls.
- Verified production domain and DNS owner; no domain/DNS action is authorized by this runbook.
- Named release/technical incident owner and content/commercial approver.
- Approval of exact content/artwork, legal and commercial readiness, contact operation, and each referral destination.
- Separate production publication and indexing decisions.

This runbook does not perform any hosting, repository setting, DNS, deployment, publication, indexing, contact, or sales action.
