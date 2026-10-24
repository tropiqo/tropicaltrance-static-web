# Astro foundation migration baseline — Slice 1

Recorded 2026-10-09. This is internal migration/CI documentation, not a verified production output, deployment, asset-use or publication approval. No Astro source or dependency change is made in this slice.

## Repository and authorized scope

Existing repository: `tropicaltrance-static-web`; original branch `chore/dev/home-page`; exact baseline `bcbdaa69035b31c46eba8aaf74c95c4101d51675`.
Migration branch: `feat/astro-website-foundation`, created from that exact HEAD. Original branch, full local history and commit remain intact; no tag, commit, push or PR is created. Remote-tracking refs contained no branch of that name; no fetch was performed, so live remote branch existence is not asserted.

The brand owner's current instruction authorizes Slice 1 only: migration branch/baseline, toolchain review and local CI isolation. Approved path scope: remove the unsafe `.github/workflows/jekyll.yml`, add `.github/workflows/validate.yml`, `.github/ci/check_policy.py` and this baseline. No site/theme/asset/package deletion or modification; later slices require separate authorization.

Accepted architecture: Astro static, Tropical Editorial Hybrid, premium tropical lifestyle/current gummies, established green chameleon Trancy, Home/Flavors/reusable Flavor Detail/About/Contact. Worlds storytelling stays inside Flavors. No Studio build/runtime dependency or real Flavor publication. Future apparel remains unapproved strategy. Source assets/public copy/release remain separately gated.

## Existing source baseline

Jekyll 4.4.1, local Minimal Mistakes 4.26.2, Liquid 4.0.4, Sass converter 3.1.0/sass-embedded 1.86.3, Bundler 2.6.2; CI specifies Ruby 3.2. Gemfile uses local gemspec. package.json declares legacy Uglify/Codex purposes, no npm scripts. No installation/runtime compatibility test is claimed.

Root routes: `/`, `/about/`, `/contact/`; anchors `/#products` and `/#trancy`. No actual Flavor Detail routes. Placeholder products/claims/contact/images are unverified and not approved migration content. Existing `_site` is ignored stale output, not a production baseline.

Baseline Git tree: `d1437f01c4a2dfbc10aef538da453f68c02f107a` (`761` tracked paths). Exact tracked source can be recovered by reading the baseline commit/history; it is not reconstructed from stale output. A private local session inventory also hashes all existing source/ignored file bytes for preservation checks; environment values/private ignored file contents are not disclosed. Key pre-edit SHA-256 identities follow. The Jekyll workflow is the only existing tracked file removed in this slice; all remaining listed files are protected.

| Baseline path | SHA-256 of original bytes |
|---|---|
| `.github/workflows/jekyll.yml` | `e8739e9ea5f0be8c5a11c7ee5306fa41f80894494bab4cdba768a3fd88074d98` |
| `Gemfile` | `438000041f52b3e8a73bd3b032688c4cdedb566293e7128495e872cda9ba085c` |
| `Gemfile.lock` | `f4639e37d8d03027700c73ba7b8161d3fddceb5d1eec2a0aadc47c62dfb18f9e` |
| `package.json` | `06af7bef3674d3f980b40ce254eca22a141af6aecb2fc965df16a5e2714578d4` |
| `package-lock.json` | `f3bbbde16e80277392e552a8518ebb3ec3d19c834dbf30047d10863e64c83b26` |
| `_config.yml` | `6d1585146b241564c1d61603b089d5b9d68479c09ca14b7a27aa984bf0c8f9b5` |
| `index.md` | `ffc0dc06c757e32f7441020b4bb5fa6a0f8ac122543f79a2efe5ab26dfba0225` |
| `about.md` | `f1486007c415c31e87190d453b30dbb4f375755154b76bb26cad18ebb4cf56c4` |
| `contact.md` | `750a6cd9d9b07434652c701c4424f5cb9536e6c8b0df0ef9bd23de3261c321b2` |
| `_data/navigation.yml` | `63929c39d8ae37404a6e11dce828080cea30207d0159776918dfefe6dfca9bff` |
| `assets/css/main.scss` | `58ceec69443df613c677cd16b744598dc336a57d5a112ea8881ac4d9d30d61ea` |
| `assets/js/custom-scroll.js` | `216391db61ba73e99d91913105dfa9739bb562465c61c9ae3ed1836734af791b` |
| `assets/images/TRANCY-01.png` | `61088b9e5e4b1ec9f80c2b17e8ab79d3443b5af63347cb141684de5cc02dab5d` |
| `assets/images/trancy_v1.0.jpeg` | `d6ea8ffa67f6e1a64718238ffdda15b7a5f6150cee2639114249f70910c7fafb` |
| `assets/images/tropicaltrance-banner-transparente.png` | `6b14c34d27c93a8ded1773297dfac36349c5e9e589a1485591d29caa612fbb4c` |
| `assets/images/tropicaltrance-banner.png` | `a16e3acd7ad22b86b46fa01a6d6fe01bb988dcd4636344e7ed68ccb75a19d3ce` |
| `assets/images/tropicaltrance-logo-black.png` | `a6ddb3770ef12db8ba26f1629888f3eed8159d306ce002a5b07151ef3b384ca8` |
| `assets/images/tropicaltrance-logo-green.png` | `f912f1528eadfdaf3537810bf062d699441ee6161e75990e228f01d3f678eb84` |

Candidate logos/banners/Trancy files are protected existing bytes, not established web-approved assets. Canonical originals remain outside this repository and are not read/copied/transformed. All Jekyll pages/themes/assets, license/history, package files, existing untracked and ignored files remain preserved. Retirement candidates include old layouts/includes/Sass/data/gemspec/Rakefile/theme scripts/demos/staticman config, but every retirement decision is deferred to separately authorized review; do not clean ignored dependencies/output.

## Local CI isolation and remote gate

Old jekyll.yml triggers PRs to master/manual dispatch with Pages/OIDC write permissions, Pages artifact and unconditional deploy-pages job. This is a source risk, not proof of successful deployment. It is removed on this uncommitted migration working tree; original branch/history and remote/default branch still retain their original contents. No remote workflow is disabled by this local edit.

New validate.yml uses the JSON subset of YAML, pull_request to master only, contents:read, one hosted ubuntu-24.04 policy job and no environment/secrets/build/install/deploy/artifact step. The sole action is [checkout v6.1.0 reviewed commit](https://github.com/actions/checkout/commit/d23441a48e516b6c34aea4fa41551a30e30af803), pinned to its full SHA, with credential persistence and cleanup disabled. Its Node action runtime is supplied by the hosted runner; no website Node or Astro installation is needed.

Run locally: `python3 -B .github/ci/check_policy.py --self-test`. The Python standard-library JSON parser safely parses the deliberately restricted YAML subset and rejects duplicate keys; generic YAML workflows are rejected for explicit review rather than parsed heuristically. Local independent PyYAML safe parsing is also performed for this slice. No new parser dependency is needed in CI. Policy allowlists the single workflow/job/action/command; added events, privileges, deployment/reusable jobs, environments/secrets/artifacts and arbitrary commands fail. Negative cases exercise those controls. Future Astro jobs require an authorized deliberate policy update; they are not added now. This is bounded source validation, not proof against a malicious PR rewriting the checker; human exact-diff review and remote least-privilege settings remain required.

**LOCAL CI ISOLATION: PASS** after recorded local checks. **REMOTE PR/DEPLOYMENT ISOLATION: UNVERIFIED.** Read-only gh API calls for repository Pages and Actions permissions were unavailable. No settings were changed. Owner must inspect: current default-branch workflows/chains; Pages build source/branch and environments; Actions default token/fork settings and protections; repository/environment secrets without exposing values; Cloudflare/other connected project production/preview branches and hooks; GitHub Apps/webhooks/deploy keys/other external PR publishing triggers. Confirm they cannot publish a PR before any separately authorized PR/external preview. Absence from YAML proves no external provider is disabled. Overall PR safety is not certified.

## Future toolchain recommendation — no installation

Recommend Node 24 LTS and npm, retaining one website-owned package-lock policy. [Node releases](https://nodejs.org/en/about/previous-releases) currently identifies 24 as LTS; [Astro prerequisites](https://docs.astro.build/en/install-and-setup/) currently state Node >=22.12 and exclude odd versions. This supports the runtime family recommendation, not a tested exact Astro dependency set.

Patch strategy: at separately authorized Slice 2 kickoff, verify the supported latest security patch in Node 24 from the official release/checksum metadata and pin that exact patch consistently for local/CI builds. Select and pin its verified npm version; do not silently upgrade npm independently. Select an exact stable Astro version after checking that release's package engines, release notes/support and transitive native dependencies; do not use a moving @latest during reproducible CI. Exact Node/Astro/npm pins are UNRESOLVED now. No .nvmrc, package.json or lockfile is edited.

Target environments: macOS ARM64 developer machine and hosted ubuntu-24.04 Linux x64 CI. Verify official runtime distributions, chosen Astro/Vite/native package support and engine requirements on both before installing. No cross-platform build compatibility result is invented. Current CI only requires preinstalled Python 3 and the runner-supported checkout action runtime.

Future lockfile policy: one committed npm lockfile generated deliberately under reviewed Node/npm, [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/) for repeat locked installations after authorization; reject package/lock drift, retain consistent flags and test two-build output reproducibility later. Registry installation and lifecycle scripts are distinct from public-content access. Inspect transitive install/postinstall scripts, native binaries and audit findings before allowing execution; use ignore-scripts only if validated compatible, not as a blind guarantee. No lifecycle scripts or audit/install commands execute in Slice 1.

Minimal tooling: zero new dependencies for current policy tests; future Node built-in tests, one reviewed closed-schema validator and one HTML parser only when needed. Browser/a11y tooling is selected in its later slice. Reject pnpm/Yarn/Bun/monorepo layers, client frameworks, SSR adapters, CMS/database/Workers and inherited Uglify/Codex for foundation delivery absent separately justified need. They add no required value to this small static foundation.

Brand owner remains accountable human decision authority. A named technical maintainer/upgrade owner has NOT been assigned. Owner must designate responsibility before installation: supported-version/security tracking, intentional package/action SHA updates, lockfile review, cross-platform checks and evidence retention. Routine updates require reviewed dependency diff/tests; major/architectural changes require applicable new authorization. No new ADR is created.

Slice 2 must first obtain separate authorization, reverify branch/base/status, assign maintainer, resolve exact Node/npm/Astro/check dependencies, inspect lifecycle/engine/native support, review installation/path scope and prove locked independent static builds. None of these installation or Astro implementation steps is authorized by Slice 1.

## Rollback and stop

Retain the original branch and baseline commit for traceable reviewed source recovery. Later changes use reviewed Git history/diffs; do not reset/clean or overwrite unrelated work. Do not blindly restore the deploying workflow when recovering site code. No verified production output or service rollback is claimed; release/rollback requires its own authorization.

Stop after Slice 1 report. No Astro UI/content mapper, real artwork/Flavor content, Jekyll retirement, build, hosting migration, PR, commit, push or deployment follows.
