# Automated GitHub releases — implementation report

## Branch and starting point

- Feature branch: `feat/automated-github-releases`
- Feature branch HEAD and locally cached `origin/master`: `941337be35fdd6d4ad8bdfec097683006f7d6f38`.
- This cached commit is merge commit `941337b`, “Merge pull request #9 from tropiqo/feat/cloudflare-private-deployment”. The feature branch is an ancestor/descendant match with the cached `origin/master` (zero commits ahead and zero behind); thus the branch includes PR #9 locally.
- A fresh `git fetch origin master` was attempted during synchronization but failed because SSH could not resolve `github.com` (`Could not resolve hostname github.com`). It is therefore not possible to assert that the cached `origin/master` is the latest remote state, or that no later master changes exist.
- No merge was needed against the cached ref, so there were no Git conflicts to resolve. The uncommitted implementation and untracked files were preserved.

## Files changed

- `.github/workflows/create-release.yml` — manually triggered, master-only release flow.
- `.github/workflows/validate.yml` — also runs validation on pushes to master so the exact merged source commit has a CI run that the release workflow can verify.
- `.github/ci/check_policy.py` — workflow allowlist, release security policy, script digests, and negative policy cases.
- `.github/ci/release_version.py` — strict version tag parsing and next-version calculation.
- `.github/ci/test_release_version.py` — tests for baseline, patch/minor/major math, malformed tags, duplicate tags, and invalid bumps.
- `docs/github-release-management.md` — version policy, workflow operation, tag protection, recovery, GitHub App option, and release/deployment separation.
- `reports/automated-github-releases-implementation.md` — this report.

No website application code, Cloudflare workflow, tag ruleset, DNS, or external settings were changed.

## Synchronization review

- The cached `origin/master` includes PR #9 and the feature branch points to that same commit. Because the normal fetch failed, synchronization with any remote commits newer than cached `941337b` remains unverified and must be repeated when GitHub DNS/network access is available.
- No conflict was present in `.github/ci/check_policy.py`: the Cloudflare workflow checks remain, including `private_deployment_approved`, while the release workflow checks and their negative cases are added. The policy self-test exercises negative cases for both Cloudflare deployment and release creation.
- `.github/workflows/deploy-cloudflare.yml` still requires the `DEPLOY_TO_PAGES` confirmation, the `private_deployment_approved` authorization, Access readiness, protected environment, and master-only execution. The Wrangler setup still creates `$TMP_PREFIX/lib/node_modules` and `$TMP_PREFIX/bin` before installing pinned Wrangler `4.152.0` with the reviewed lifecycle-script allowlist.
- The `validate.yml` master push trigger runs the validation workflow after a merge on the exact master commit. The release workflow queries `validate.yml` runs by exact `head_sha`, master branch, completed status, and push event, rejecting a missing or unsuccessful latest run. Local workflow lint and policy checks pass. Remote GitHub Actions behavior was not exercised.

## Design decisions

- `create-release.yml` is triggered only by `workflow_dispatch`, requires the `master` ref, a `patch`/`minor`/`major` choice defaulting to `patch`, and the exact `CREATE_RELEASE` confirmation.
- The workflow checks out the dispatch SHA, records it, fetches master and tags, and verifies the source commit is in `origin/master` history.
- It requires the latest completed `validate.yml` push run for that exact SHA on master to have succeeded. The CI workflow now runs on master pushes as well as pull requests. If other required checks are added, the release gate must be reviewed and extended before use.
- Version calculation uses `v0.1.0` as a baseline and accepts only `vMAJOR.MINOR.PATCH` tags without leading zeros or suffixes. Malformed `v` tags and duplicate entries fail closed. Patch, minor, and major increment behavior is unit tested.
- The workflow refuses a second versioned Release for the same source commit. It creates an annotated Git tag object and reference pointing to the checked source SHA, verifies the tag target, publishes with GitHub-generated notes, and verifies the tag/release association.
- Releases remain prereleases during private development. A prerelease is not private when the repository is public.
- Concurrency serializes release runs. Authorization and preparation jobs are read-only; only the separate tag and publish jobs receive `contents:write`. The preparation job uses `actions:read` only to verify the exact commit's CI run. No personal access token or Cloudflare credential is used.
- If tag creation is blocked, the run stops and leaves repository rules unchanged. If a tag exists but release publication or verification fails, the workflow reports the partial state and does not delete or retag it. The documentation describes a narrowly installed GitHub App with a separately reviewed tag-ruleset bypass only if later approved.
- No tag, release, Cloudflare deployment, or publication was created during this implementation.

## Validation results

- `actionlint .github/workflows/create-release.yml .github/workflows/validate.yml .github/workflows/deploy-cloudflare.yml` — passed.
- `python3 -B .github/ci/check_policy.py --self-test` — passed, including negative cases for automatic triggers/deployment, wrong ref/confirmation, missing ancestry and CI checks, duplicate-release checks, lightweight or mismatched tags, broader token permissions, missing generated notes, stable publication, Cloudflare credentials, and missing concurrency.
- `python3 -B -m unittest discover -s .github/ci -p 'test_release_version.py' -v` — passed, 5 tests.
- Workflow JSON parsing, embedded shell syntax (`bash -n`), and Python syntax checks — passed.
- `npm run validate` — attempted and blocked: the worktree has no installed dependencies; Node failed resolving package `sharp`. No dependency installation was attempted.
- `npm run verify:reproducible` — attempted and blocked for the same missing `sharp` dependency.
- `git diff --check` — passed.
- Available local runtime is Node `v23.2.0` / npm `10.9.0`; the repository pins Node `24.21.0` / npm `11.19.0`. The npm validations could not reach application checks in this worktree; pinned-runtime validation remains outstanding. No Node/npm runtime was installed or changed.
- `git fetch origin master` — blocked by DNS resolution for `github.com`; remote freshness remains unverified.
- GitHub API behavior, tag protection enforcement, repository branch protections, and remote CI were not exercised. No release or tag was created.

## Risks and owner checks

- Cached `origin/master` contains PR #9 and equals the feature branch HEAD, but it may be behind the actual remote; fetch and compare again before review/merge.
- Confirm `master` protection requires PR review and the validation workflow check, and confirm the existing `v*` tag rules prevent updates/deletion. This implementation does not modify or bypass those protections.
- Confirm the repository's required CI set remains represented by successful `validate.yml` push runs. Additional required checks need an explicit release-gate update.
- If the existing tag rules block `GITHUB_TOKEN`, keep the ruleset intact. Any GitHub App bypass needs a separate least-privilege review and owner authorization.
- GitHub prereleases remain visible on public repositories. Prerelease status is a stability label, not access control.
- GitHub's tag creation and release publication are separate API operations; a partial state is possible. The workflow reports it and requires owner-reviewed recovery without deleting protected tags.

## Exact next steps

1. From the feature worktree when GitHub DNS/network access is available, run `git fetch origin master`, then compare `git rev-list --left-right --count origin/master...feat/automated-github-releases`. If remote master advanced, preserve the current local changes and integrate with a normal merge; review any conflicts, especially the additive policy sections. Do not rebase or force.
2. Review this branch and confirm master branch protection, required checks, and existing `v*` tag rules. Keep protections unchanged unless separately approved.
3. Run the branch through the normal pull request and CI process. After merge, wait for a successful `validate.yml` push run on the exact resulting master SHA.
4. Only after owner review, manually dispatch **Create GitHub Release** from `master`, choose the bump, and enter `CREATE_RELEASE`. Inspect the run summary and resulting tag/release association.
5. Keep Cloudflare deployment, public website publication, indexing, DNS, and sales activation as separate approvals.

## Git status

- Branch: `feat/automated-github-releases`, HEAD `941337be35fdd6d4ad8bdfec097683006f7d6f38`, same as locally cached `origin/master` (which includes PR #9); remote freshness is unknown because fetch failed.
- Feature worktree has uncommitted changes in `.github/ci/check_policy.py` and `.github/workflows/validate.yml`, plus untracked `.github/ci/release_version.py`, `.github/ci/test_release_version.py`, `.github/workflows/create-release.yml`, `docs/github-release-management.md`, and this report. Nothing is staged.
- Existing artwork, media, reports, and `tools/` untracked in the original `feat/cloudflare-private-deployment` worktree remain untouched.
- No commit, push, merge, tag, release, Cloudflare operation, or deployment occurred.
