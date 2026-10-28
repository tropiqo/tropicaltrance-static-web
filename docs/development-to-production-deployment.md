# Development to production: the short version

There are two separate deployment paths. Feature work goes to the development preview first. Production is deployed only from an explicitly selected GitHub Release.

## Deploy and test in development

1. Create a feature branch from `development`, make the change, and push it:

   ```sh
   git switch development
   git pull --ff-only origin development
   git switch -c feat/short-description
   git push -u origin feat/short-description
   ```

2. In GitHub, open a PR from the feature branch into `development`. Wait for **Validate website** to pass, review, then merge.
3. The merge push starts **Cloudflare Pages development deployment**. It validates and builds before uploading the `development` preview using the `cloudflare-development` environment. If the run stops at authorization, an owner must verify Cloudflare Access and the development environment gates before enabling deployment.
4. In the successful Actions run, open the deployment URL. Test while signed in through Access; confirm an anonymous session is denied. Development output stays `noindex` and has no sitemap.

## Promote the tested change to production

1. In GitHub, open a PR from `development` into `master`. Wait for **Validate website** to pass, review, then merge. A master merge does not itself deploy production.
2. In **Actions → Create GitHub Release**, select `master`, choose the version bump, enter `CREATE_RELEASE`, and run it. Review the resulting `vMAJOR.MINOR.PATCH` pre-release and source commit.
3. In **Actions → Manual Cloudflare Pages deployment**, select `master`, enter that exact release tag, and confirm the private deployment and Access checks. Approve the existing `cloudflare-production` environment if GitHub prompts for its configured approval.
4. Confirm the run summary shows the selected tag, source SHA, Cloudflare deployment ID, and URL. Verify Access on the production URL.

## Roll back and identify the deployed version

- **Identify:** use the latest successful deployment run summary. It records the release tag, source commit SHA, run ID, deployment ID, and URL. Cloudflare Pages deployment history should show the same SHA and production branch.
- **Roll back:** in Cloudflare Pages, select the previous known-good production deployment and use Cloudflare's supported rollback action. Then verify the serving URL and Access. Rollback changes the active deployment; it does not change the GitHub Release. See [Cloudflare's rollback instructions](https://developers.cloudflare.com/pages/configuration/rollbacks/).

## Keep the two paths separate

- Development pushes update only the Pages `development` preview branch, after the dev environment readiness gates pass.
- Production never deploys automatically from a push, pull request, tag, or release event. It requires a separate manual run with a published release selected.
- The two workflows use separate GitHub environments and separate Cloudflare credentials. Development secrets are not passed to the production workflow, or vice versa.
- A failed development deploy does not change production. A production release is not deployed just because it was created.
- GitHub branch protection, rulesets, environment settings, Cloudflare Access, DNS, and account configuration are managed separately; these workflows do not change them.

See [development deployment operations](cloudflare-development-deployment.md) and [production deployment operations](cloudflare-deployment-operations.md) for the detailed checks and recovery procedures.
