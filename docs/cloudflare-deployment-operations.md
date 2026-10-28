# Release-driven Cloudflare Pages deployment operations

This procedure deploys an explicitly selected, already published GitHub Release to the existing Cloudflare Pages production project. The workflow is manual only and remains restricted to a dispatch from `master`. GitHub Release publication and Cloudflare deployment are separate actions. A prerelease may be selected while the site remains private; publication does not make the website public.

## Create and select a release

Create a release using the repository's **Create GitHub Release** workflow. Review its summary for the canonical `vMAJOR.MINOR.PATCH` tag and exact source commit. The deployment workflow accepts only this format and requires a non-draft published Release; prereleases are allowed. The release tag must resolve to a commit in protected `master` history. The active `v*` tag ruleset was observed to prohibit tag updates and deletion; verify this remains active before relying on immutability.

## Manually deploy

1. Confirm the release is the intended build and that its content is approved for private deployment.
2. Confirm Cloudflare Access currently blocks anonymous requests to both the base `pages.dev` hostname and the immutable deployment URL pattern, and permits the intended reviewers.
3. In GitHub Actions, open **Manual Cloudflare Pages deployment**, choose `master`, provide the exact release tag, enter `DEPLOY_TO_PAGES`, and attest both Access readiness and private deployment approval.
4. Review the workflow authorization and build jobs. The run resolves the release tag through the GitHub API, checks GitHub Release publication and exact tag equality, peels annotated or lightweight tags, verifies master ancestry, and checks the tag against the local fetched object. It carries the resulting full SHA through authorization, build, and deployment. The build checks out that SHA, not current master HEAD.
5. Approve the `cloudflare-production` environment if an approval prompt is configured. Environment approval is an independent repository control; the workflow inputs do not replace it.
6. Confirm the existing Pages project and production branch (`master`) in the credentialed preflight. The workflow does not create a project, alter Cloudflare configuration, or enable automatic deployments.

## Verify and record

The workflow summary records the Release tag, source commit, GitHub run ID, Release URL, and—after successful verification—Cloudflare deployment ID and URL. Wrangler documents `--commit-hash` and `--commit-message`, but does not document a stable machine-readable deployment-ID output, so the workflow uses Cloudflare's Pages deployments API. Before upload it snapshots existing deployment IDs. It identifies the new deployment by its post-start timestamp, previously unseen ID, exact unique commit message containing the workflow run ID, production environment, `master` branch, and selected commit SHA. The verifier polls with bounded backoff while Cloudflare metadata propagates; it never repeats the upload. Record the IDs, URLs, operator, UTC time, approval context, Access test results, and authenticated/anonymous URL checks in the release record. Do not infer Access protection from `noindex` or `robots.txt`.

Read-only local checks (with a configured `gh` account) include:

```sh
gh release view vX.Y.Z --repo tropiqo/tropicaltrance-static-web
gh run view RUN_ID --repo tropiqo/tropicaltrance-static-web
```

## Failure investigation and recovery

- Authorization failures: check the dispatch branch, canonical tag spelling, published Release state, matching `tag_name`, GitHub tag object, and ancestry in master. Never move a tag to work around a failed check.
- Build or artifact failures: inspect the selected SHA, pinned Node/npm versions, locked dependency install, output validation, `noindex` marker, and absence of a sitemap. Do not approve the deploy environment until the failure is understood.
- Preflight failures: verify the existing project slug, production branch, environment variables, Access attestation, and the narrowly scoped Cloudflare token. Do not change Access, DNS, or project settings as part of failure recovery.
- Upload failures: the workflow reports `UPLOAD FAILED`; post-upload metadata verification did not start. Inspect Wrangler output and Cloudflare deployment history before any owner-authorized retry.
- Metadata verification failures: the workflow reports that upload succeeded before reporting the metadata problem. It does not upload again. Check Cloudflare deployment history for the exact run-specific commit message, source SHA, branch, deployment ID, and stage. Treat the upload as potentially live even when the action ultimately reports failure; do not rerun the workflow until an owner reviews the existing deployment.
- For an unsuccessful deployment, an owner may select the previous known-good production deployment in Cloudflare Pages and use Cloudflare's supported rollback action. This task does not perform a rollback. Confirm the restored deployment ID, source commit, URLs, and Access behavior afterward.

Cloudflare rollback restores a prior Pages deployment and does not change GitHub Release or source history. Redeploying an older approved Release creates a new deployment from that release's immutable source commit. Record both actions distinctly and reconcile the currently served Cloudflare deployment with the release history. Cloudflare's [Pages rollback guidance](https://developers.cloudflare.com/pages/configuration/rollbacks/) is authoritative for the current console/API procedure.

## Privacy, indexing, and owner authorization

Keep Access protection in force for the base project hostname and immutable deployment hostnames. If an anonymous request succeeds, stop release acceptance and ask the Cloudflare owner to restrict access; do not rely on search engine directives. Confirm output remains `noindex, nofollow`, `robots.txt` disallows crawling, and no sitemap is present. Public access, indexing, custom domains, DNS changes, commerce, token/ruleset/environment changes, deployment, and rollback require their own explicit owner authorization. No deployment or recovery action is performed by this implementation.
