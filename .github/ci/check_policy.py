"""Local CI policy for validation and gated Pages deployment.

Active workflows must use the JSON subset of YAML so Python's standard-library
parser can validate them without installing a YAML package. This is a bounded
allowlist for the current slice, not a general GitHub Actions security analyser.
Future jobs, triggers, credentials, or actions require explicit review here.
"""

import argparse
import copy
import json
import re
import subprocess
import tempfile
from pathlib import Path

from release_version import latest_version, next_version

CHECKOUT = "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803"
SETUP_NODE = "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38"
UPLOAD_ARTIFACT = "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"
DOWNLOAD_ARTIFACT = "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093"
COMMAND = "python3 -B .github/ci/check_policy.py --self-test"
LOCKED_INSTALL = "npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org"
PIN_NPM = 'npm install --global npm@11.19.0 --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org && test "$(npm --version)" = "11.19.0"'
DEPLOY_SCRIPT_DIGESTS = {
    "authorize": "5bc0beff093c5ce1e3723b3e1ca9d67270392c949b1b9b2c11ea1354ab0450fb",
    "build": "c3aab6b1a8a7a4a256166342656f1be1458c91850024198bfd37705b61456f49",
    "access": "44eea2c5128f6cd5b1a2238bb794267abca06a04af849844ee5aaa39a36754b2",
    "project-preflight": "434de15ae412706ff5a53206aa41ec5f5a6f94c3615a094304c7631dd3a3dbb6",
    "publish": "290545c87cedb7346dff06b1a2f2e2a647e1a03288bd84b1ab56af3860fa6588",
    "wrangler-install": "49404a8b9bff235daab65fd0c4ad3823b5af7659972b859a6d74037aaa2c7005",
}
WRANGLER_VERSION_PATTERN = re.compile(r"(?<![0-9A-Za-z.+-])v?4\.152\.0(?![0-9A-Za-z.+-])")
RELEASE_SCRIPT_DIGESTS = {
    "authorize": "e50be684e910a9701279e4ede962ed24c9bf4ac002cf06f430c60ce3d200163e",
    "source": "78c297dd73e09277eb0d0518a96595bcf18e6408e42d041bf8183e44ba4ecebb",
    "ci": "d07a71cbe13547a8dbea001b9cb6c670737ec2965867cd9f79d6f6f1fbd2da03",
    "version": "d0fd509c30a22dcde62199d18616643da0a9b5a90f4aa63d106959ca66a2dfd8",
    "tag": "5ba34960597199417ea510084d36c2dcb3306bba4eb27a210e393f5e6db5c668",
    "publish": "44b886f63af7176dae7ff00950244723a14d1c5895451d8783b5f822b4686aaf",
}
DEVELOPMENT_SCRIPT_DIGESTS = {
    "build": "b4ee3ddd832327904091f7fc7eebd520f361111ea92869c9cd7ee5ec2858c784",
    "authorization": "87778cf63a0981506c60f5196b468e0875d0d83ba7355bb99a09fa23feb98920",
    "wrangler-install": "49404a8b9bff235daab65fd0c4ad3823b5af7659972b859a6d74037aaa2c7005",
    "project-preflight": "fa392c513b91eae01584adc20361c48f6abfd84d894cce672b1010b3023e1ef9",
    "publish": "d97fbe107bf682cf365f6d4f66dc6f1784d953f0171ad2b5b28f07a782e4d450",
}
VALIDATION_STEPS = [
    ("Test release version calculation", "python3 -B -m unittest discover -s .github/ci -p 'test_release_version.py' -v"),
    ("Validate application and isolated review builds", "npm run validate"),
    ("Install Chromium and required Linux dependencies", "npx playwright install --with-deps chromium"),
    ("Run isolated Chromium browser checks", "npm run test:e2e"),
]


class PolicyError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise PolicyError(message)


def check_workflow(workflow):
    require(isinstance(workflow, dict), "workflow must be a mapping")
    require(set(workflow) == {"name", "on", "permissions", "jobs"},
            "unexpected workflow keys or missing policy fields")
    require(isinstance(workflow["name"], str), "workflow name must be text")
    require(workflow["on"] == {
        "pull_request": {"branches": ["development", "master"]},
        "push": {"branches": ["master"]},
    }, "validation may run for pull requests to development/master and pushes to master only")
    require(workflow["permissions"] == {"contents": "read"},
            "only contents:read permissions are allowed")
    jobs = workflow["jobs"]
    require(isinstance(jobs, dict) and set(jobs) == {"policy"},
            "only the policy job is allowed; no deployment or workflow chain")
    job = jobs["policy"]
    require(isinstance(job, dict) and set(job) == {"runs-on", "timeout-minutes", "steps"},
            "unexpected job fields: environment, secrets, services and reusable jobs forbidden")
    require(job["runs-on"] == "ubuntu-24.04", "only hosted ubuntu-24.04 is allowed")
    require(type(job["timeout-minutes"]) is int and job["timeout-minutes"] == 20,
            "policy job timeout must be twenty minutes")
    steps = job["steps"]
    require(isinstance(steps, list) and len(steps) == 9,
            "exactly reviewed checkout, policy, runtime, npm pin, locked install, website validation, and browser steps are allowed")
    checkout, check, setup, pin_npm, install, *validation = steps
    require(isinstance(checkout, dict) and set(checkout) == {"name", "uses", "with"},
            "unexpected checkout step fields")
    require(checkout["uses"] == CHECKOUT, "action must match the reviewed full checkout SHA")
    options = checkout["with"]
    require(isinstance(options, dict) and set(options) == {"persist-credentials", "fetch-depth", "clean"},
            "unexpected checkout options")
    require(options["persist-credentials"] is False and options["clean"] is False,
            "checkout credentials and destructive cleanup must be disabled")
    require(type(options["fetch-depth"]) is int and options["fetch-depth"] == 1,
            "checkout fetch depth must be one")
    require(isinstance(check, dict) and set(check) == {"name", "run"},
            "unexpected validation step fields; no env or secrets")
    require(check["run"] == COMMAND, "only the existing dependency-free policy command is allowed")
    require(set(setup) == {"name", "uses", "with"}, "unexpected runtime setup fields")
    require(setup["uses"] == SETUP_NODE, "runtime action must match reviewed SHA")
    require(setup["with"] == {"node-version": "24.21.0", "package-manager-cache": False}, "runtime version/cache differs")
    require(set(pin_npm) == {"name", "run"} and pin_npm["run"] == PIN_NPM,
            "only repository-pinned npm may be installed from the official registry")
    require(set(install) == {"name", "run"} and install["run"] == LOCKED_INSTALL,
            "only reviewed locked official-registry install allowed")
    require(len(validation) == len(VALIDATION_STEPS), "validation step count differs from reviewed pipeline")
    for step, (name, command) in zip(validation, VALIDATION_STEPS):
        require(set(step) == {"name", "run"} and step["name"] == name and step["run"] == command,
                "validation commands must match the reviewed local-only pipeline")
    require(isinstance(checkout["name"], str) and isinstance(check["name"], str),
            "step names must be text")


def check_cloudflare_workflow(workflow):
    """Bound the new privileged workflow to an explicit manual production path."""
    require(isinstance(workflow, dict), "deployment workflow must be a mapping")
    require(set(workflow) == {"name", "on", "permissions", "concurrency", "jobs"},
            "unexpected deployment workflow keys")
    require(workflow["on"] == {"workflow_dispatch": {"inputs": {
        "confirmation": {"description": "Type DEPLOY_TO_PAGES to confirm only a Cloudflare Access-protected private deployment; this does not authorize public publication, indexing, custom domains, DNS changes, or sales activation",
                         "required": True, "type": "string"},
        "access_protection_verified": {
            "description": "Confirm Cloudflare Access rejects anonymous requests to pages.dev",
            "required": True, "type": "boolean", "default": False},
        "private_deployment_approved": {
            "description": "Confirm this exact master commit is authorized only for a private Cloudflare Access-protected deployment; public publication, indexing, custom domains, DNS changes, and sales activation remain unauthorized",
            "required": True, "type": "boolean", "default": False},
    }}}, "manual dispatch with explicit confirmations is the only trigger")
    require(workflow["permissions"] == {"contents": "read"},
            "deployment workflow token must remain read-only")
    require(workflow["concurrency"] == {"group": "cloudflare-production", "cancel-in-progress": False},
            "production deployments must be serialized")
    jobs = workflow["jobs"]
    require(isinstance(jobs, dict) and set(jobs) == {"authorize", "build", "deploy"},
            "unexpected deployment jobs")

    authorize = jobs["authorize"]
    require(set(authorize) == {"runs-on", "timeout-minutes", "steps"} and
            authorize["runs-on"] == "ubuntu-24.04" and authorize["timeout-minutes"] == 2,
            "authorization must run without an environment or secrets")
    auth_steps = authorize["steps"]
    require(len(auth_steps) == 1 and set(auth_steps[0]) == {"name", "env", "run"},
            "authorization step shape differs")
    require(auth_steps[0]["env"] == {
        "GITHUB_REF": "${{ github.ref }}",
        "CONFIRMATION": "${{ inputs.confirmation }}",
        "ACCESS_PROTECTION_VERIFIED": "${{ inputs.access_protection_verified }}",
        "PRIVATE_DEPLOYMENT_APPROVED": "${{ inputs.private_deployment_approved }}",
    }, "authorization may read only ref and explicit confirmations")
    require(script_digest(auth_steps[0]["run"]) == DEPLOY_SCRIPT_DIGESTS["authorize"],
            "authorization must match the reviewed fail-closed private-deployment script")

    build = jobs["build"]
    require(build.get("needs") == "authorize" and build.get("if") == "github.ref == 'refs/heads/master'",
            "build must require authorization and protected master")
    require(set(build) == {"needs", "if", "runs-on", "timeout-minutes", "steps"} and
            build["runs-on"] == "ubuntu-24.04" and build["timeout-minutes"] == 20,
            "unexpected build job settings")
    steps = build["steps"]
    require(len(steps) == 6, "build must use the reviewed six-step sequence")
    checkout, setup, pin_npm, install, build_output, upload = steps
    require(checkout == {
        "name": "Check out authorized source",
        "uses": CHECKOUT,
        "with": {"persist-credentials": False, "fetch-depth": 1, "clean": False},
    }, "deployment checkout must be pinned and non-persistent")
    require(setup == {"name": "Use pinned Node.js", "uses": SETUP_NODE,
                      "with": {"node-version": "24.21.0", "package-manager-cache": False}},
            "build runtime pin differs")
    require(pin_npm == {"name": "Use repository-pinned npm", "run": PIN_NPM},
            "build npm version must match repository pin")
    require(install == {"name": "Install locked dependencies without lifecycle scripts",
                        "run": LOCKED_INSTALL}, "build install must remain locked and script-free")
    require(set(build_output) == {"name", "env", "run"} and
            build_output["env"] == {"TROPICAL_INDEXING_AUTHORIZATION": "",
                                    "TROPICAL_SEO_ORIGIN": ""},
            "build must not be given indexing authorization or production origin")
    require(script_digest(build_output["run"]) == DEPLOY_SCRIPT_DIGESTS["build"],
            "build commands and development-indexing safeguards differ from reviewed script")
    require("secrets." not in json.dumps(build), "Cloudflare secrets must not enter the build job")
    require(upload == {"name": "Upload validated site artifact", "uses": UPLOAD_ARTIFACT,
                       "with": {"name": "cloudflare-pages-dist", "path": "dist/",
                                "if-no-files-found": "error", "retention-days": 1}},
            "validated artifact upload differs from reviewed pin")

    deploy = jobs["deploy"]
    require(deploy.get("needs") == "build" and deploy.get("if") == "github.ref == 'refs/heads/master'",
            "deployment must require successful build and protected master")
    require(deploy.get("environment") == "cloudflare-production" and
            deploy.get("runs-on") == "ubuntu-24.04" and deploy.get("timeout-minutes") == 10 and
            set(deploy) == {"needs", "if", "runs-on", "timeout-minutes", "environment", "steps"},
            "deployment must use only the production environment and reviewed settings")
    deploy_steps = deploy["steps"]
    require(len(deploy_steps) == 7, "deployment must use the reviewed seven-step sequence")
    download, access, setup_wrangler_node, pin_wrangler_npm, install_wrangler, preflight, publish = deploy_steps
    require(download == {"name": "Download validated site artifact", "uses": DOWNLOAD_ARTIFACT,
                         "with": {"name": "cloudflare-pages-dist", "path": "dist"}},
            "deployment must consume the build artifact with the pinned download action")
    require(set(access) == {"name", "env", "run"} and access["env"] == {
        "CLOUDFLARE_PAGES_PROJECT": "${{ vars.CLOUDFLARE_PAGES_PROJECT }}",
        "CLOUDFLARE_ACCESS_READY": "${{ vars.CLOUDFLARE_ACCESS_READY }}",
    }, "Access and project checks must use environment variables only")
    require(script_digest(access["run"]) == DEPLOY_SCRIPT_DIGESTS["access"],
            "project/access readiness and artifact checks differ from reviewed script")
    require(setup_wrangler_node == {"name": "Use pinned Node.js for Wrangler", "uses": SETUP_NODE,
                                    "with": {"node-version": "24.21.0", "package-manager-cache": False}},
            "Wrangler must use the repository's pinned Node.js")
    require(pin_wrangler_npm == {"name": "Use repository-pinned npm for Wrangler", "run": PIN_NPM},
            "Wrangler must use the repository's pinned npm")
    require(set(install_wrangler) == {"name", "run"} and
            install_wrangler["name"] == "Install pinned Wrangler with only reviewed dependency scripts" and
            script_digest(install_wrangler["run"]) == DEPLOY_SCRIPT_DIGESTS["wrangler-install"],
            "Wrangler install must use the pinned package and selective strict lifecycle-script policy")
    require(set(preflight) == {"name", "env", "run"} and preflight["env"] == {
        "CLOUDFLARE_API_TOKEN": "${{ secrets.CLOUDFLARE_API_TOKEN }}",
        "CLOUDFLARE_ACCOUNT_ID": "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
        "CLOUDFLARE_PAGES_PROJECT": "${{ vars.CLOUDFLARE_PAGES_PROJECT }}",
    }, "Cloudflare credentials may be referenced only in dedicated deployment steps")
    require(script_digest(preflight["run"]) == DEPLOY_SCRIPT_DIGESTS["project-preflight"],
            "credentialed preflight differs from reviewed read-only project check")
    require(set(publish) == {"name", "env", "run"} and publish["env"] == preflight["env"],
            "only the final deploy step may receive Cloudflare credentials")
    require(script_digest(publish["run"]) == DEPLOY_SCRIPT_DIGESTS["publish"],
            "Direct Upload command differs from reviewed production command")


def check_cloudflare_development_workflow(workflow):
    require(isinstance(workflow, dict) and
            set(workflow) == {"name", "on", "permissions", "concurrency", "jobs"},
            "unexpected development deployment workflow shape")
    require(workflow["name"] == "Cloudflare Pages development deployment" and
            workflow["on"] == {"push": {"branches": ["development"]}},
            "development workflow must run only on pushes to development")
    require(workflow["permissions"] == {"contents": "read"},
            "development workflow token must remain read-only")
    require(workflow["concurrency"] == {
        "group": "cloudflare-development", "cancel-in-progress": False},
        "development deployments must be serialized")
    jobs = workflow["jobs"]
    require(isinstance(jobs, dict) and set(jobs) == {"build", "deploy"},
            "unexpected development workflow jobs")

    build = jobs["build"]
    require(set(build) == {"runs-on", "timeout-minutes", "steps"} and
            build["runs-on"] == "ubuntu-24.04" and build["timeout-minutes"] == 40,
            "development build must use the reviewed unprivileged runner")
    steps = build["steps"]
    require(len(steps) == 12, "development build steps differ from the reviewed validation pipeline")
    checkout, setup, pin_npm, install, policy, release_tests, validate, reproducible, chromium, e2e, artifact_build, upload = steps
    require(checkout == {
        "name": "Read development source", "uses": CHECKOUT,
        "with": {"persist-credentials": False, "fetch-depth": 1, "clean": False},
    }, "development checkout must be pinned and must not persist credentials")
    require(set(setup) == {"name", "uses", "with"} and setup["uses"] == SETUP_NODE and
            setup["with"] == {"node-version": "24.21.0", "package-manager-cache": False},
            "development build must use the pinned Node release without cache")
    require(pin_npm == {"name": "Use repository-pinned npm", "run": PIN_NPM},
            "development build must use the repository-pinned npm release")
    require(install == {"name": "Install locked dependencies without lifecycle scripts", "run": LOCKED_INSTALL},
            "development build must install only the reviewed lockfile without lifecycle scripts")
    require(policy == {"name": "Check all workflow security policies", "run": COMMAND},
            "development workflow must execute the repository security policy self-tests")
    require(release_tests == {
        "name": "Test release version calculation",
        "run": "python3 -B -m unittest discover -s .github/ci -p 'test_release_version.py' -v",
    }, "development workflow must retain release version tests")
    require(validate == {"name": "Run website validation", "run": "npm run validate"},
            "development pushes must run the full website validation")
    require(reproducible == {"name": "Verify reproducible builds", "run": "npm run verify:reproducible"},
            "development pushes must verify reproducible builds")
    require(chromium == {
        "name": "Install Chromium and required Linux dependencies",
        "run": "npx playwright install --with-deps chromium",
    } and e2e == {"name": "Run isolated Chromium browser checks", "run": "npm run test:e2e"},
            "development pushes must run the reviewed browser validation")
    require(artifact_build == {
        "name": "Build and validate the development artifact",
        "env": {"TROPICAL_INDEXING_AUTHORIZATION": "", "TROPICAL_SEO_ORIGIN": ""},
        "run": artifact_build.get("run"),
    } and script_digest(artifact_build["run"]) == DEVELOPMENT_SCRIPT_DIGESTS["build"],
            "development artifact must be built with indexing inputs cleared and validated")
    require(upload == {
        "name": "Upload validated development artifact", "uses": UPLOAD_ARTIFACT,
        "with": {"name": "cloudflare-development-dist", "path": "dist/",
                 "if-no-files-found": "error", "retention-days": 1},
    }, "development workflow must upload only the validated artifact with a short retention")
    require("secrets." not in json.dumps(build).lower() and
            "CLOUDFLARE_API_TOKEN" not in json.dumps(build),
            "development build must not receive Cloudflare credentials")

    deploy = jobs["deploy"]
    require(set(deploy) == {"needs", "if", "runs-on", "timeout-minutes", "permissions", "environment", "steps"} and
            deploy["needs"] == "build" and deploy["if"] == "github.ref == 'refs/heads/development'" and
            deploy["runs-on"] == "ubuntu-24.04" and deploy["timeout-minutes"] == 15 and
            deploy["permissions"] == {"contents": "read"} and
            deploy["environment"] == "cloudflare-development",
            "only the development branch may deploy using its dedicated environment and read-only GitHub token")
    deploy_steps = deploy["steps"]
    require(len(deploy_steps) == 7, "development deployment steps differ from the reviewed gated sequence")
    download, authorization, setup_wrangler, pin_wrangler_npm, wrangler, preflight, publish = deploy_steps
    require(download == {
        "name": "Download validated development artifact", "uses": DOWNLOAD_ARTIFACT,
        "with": {"name": "cloudflare-development-dist", "path": "dist"},
    }, "development deploy must consume only its validated artifact")
    require(authorization.get("name") == "Require explicit deployment and Access authorization" and
            set(authorization) == {"name", "env", "run"} and authorization["env"] == {
                "GITHUB_REF": "${{ github.ref }}",
                "CLOUDFLARE_DEV_ACCESS_READY": "${{ vars.CLOUDFLARE_DEV_ACCESS_READY }}",
                "CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED": "${{ vars.CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED }}",
            } and script_digest(authorization["run"]) == DEVELOPMENT_SCRIPT_DIGESTS["authorization"],
            "development deployment must fail closed unless branch, Access, and explicit enablement match")
    require(set(setup_wrangler) == {"name", "uses", "with"} and
            setup_wrangler["uses"] == SETUP_NODE and
            setup_wrangler["with"] == {"node-version": "24.21.0", "package-manager-cache": False},
            "Wrangler must use the pinned Node release")
    require(pin_wrangler_npm == {"name": "Use repository-pinned npm for Wrangler", "run": PIN_NPM},
            "Wrangler must use the repository-pinned npm release")
    require(wrangler["name"] == "Install pinned Wrangler with only reviewed dependency scripts" and
            set(wrangler) == {"name", "run"} and
            script_digest(wrangler["run"]) == DEVELOPMENT_SCRIPT_DIGESTS["wrangler-install"],
            "Wrangler install must retain the pinned version and reviewed script allowlist")
    require(preflight["name"] == "Verify the existing Pages project and production branch" and
            set(preflight) == {"name", "env", "run"} and preflight["env"] == {
                "CLOUDFLARE_DEV_API_TOKEN": "${{ secrets.CLOUDFLARE_DEV_API_TOKEN }}",
                "CLOUDFLARE_DEV_ACCOUNT_ID": "${{ secrets.CLOUDFLARE_DEV_ACCOUNT_ID }}",
            } and script_digest(preflight["run"]) == DEVELOPMENT_SCRIPT_DIGESTS["project-preflight"],
            "only the read-only existing-project check may receive deployment credentials before upload")
    require(publish["name"] == "Upload development branch to existing Pages project" and
            set(publish) == {"name", "env", "run"} and publish["env"] == {
                "CLOUDFLARE_API_TOKEN": "${{ secrets.CLOUDFLARE_DEV_API_TOKEN }}",
                "CLOUDFLARE_ACCOUNT_ID": "${{ secrets.CLOUDFLARE_DEV_ACCOUNT_ID }}",
                "GH_TOKEN": "${{ github.token }}",
                "GITHUB_REPOSITORY": "${{ github.repository }}",
                "SOURCE_SHA": "${{ github.sha }}",
            } and
            script_digest(publish["run"]) == DEVELOPMENT_SCRIPT_DIGESTS["publish"],
            "development credentials and read token must be confined to the final stale-checked upload")
    serialized = json.dumps(workflow).lower()
    require("cloudflare-production" not in serialized and "--branch master" not in serialized and
            "project create" not in serialized and "vars.cloudflare_pages_project" not in serialized and
            "secrets.cloudflare_api_token" not in serialized and "secrets.cloudflare_account_id" not in serialized and
            "--project-name tropicaltrance-web" in publish["run"] and
            '.result.production_branch == "master"' in preflight["run"],
            "development workflow must preserve the production branch and never create projects")


def cloudflare_development_negative_checks(valid):
    check_cloudflare_development_workflow(valid)
    mutations = {
        "master push trigger": lambda w: w["on"]["push"].update({"branches": ["master"]}),
        "automatic pull request trigger": lambda w: w["on"].update({"pull_request": {"branches": ["development"]}}),
        "writable GitHub permissions": lambda w: w["permissions"].update({"contents": "write"}),
        "production environment": lambda w: w["jobs"]["deploy"].update({"environment": "cloudflare-production"}),
        "missing Access authorization": lambda w: w["jobs"]["deploy"]["steps"][1]["env"].pop("CLOUDFLARE_DEV_ACCESS_READY"),
        "missing owner enablement": lambda w: w["jobs"]["deploy"]["steps"][1]["env"].pop("CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED"),
        "malformed Access readiness accepted": lambda w: w["jobs"]["deploy"]["steps"][1].update({
            "run": w["jobs"]["deploy"]["steps"][1]["run"].replace(
                'CLOUDFLARE_DEV_ACCESS_READY" != \'true\'', 'CLOUDFLARE_DEV_ACCESS_READY" != \'false\'')}),
        "disabled deployment accepted": lambda w: w["jobs"]["deploy"]["steps"][1].update({
            "run": w["jobs"]["deploy"]["steps"][1]["run"].replace(
                'CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED" != \'true\'',
                'CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED" != \'false\'')}),
        "fail-open deployment gate": lambda w: w["jobs"]["deploy"]["steps"][1].update({"run": "true"}),
        "production-era readiness variable": lambda w: w["jobs"]["deploy"]["steps"][1]["env"].update({"CLOUDFLARE_ACCESS_READY": "${{ vars.CLOUDFLARE_ACCESS_READY }}"}),
        "shared project variable": lambda w: w["jobs"]["deploy"]["steps"][1]["env"].update({"CLOUDFLARE_PAGES_PROJECT": "${{ vars.CLOUDFLARE_PAGES_PROJECT }}"}),
        "production credential secret": lambda w: w["jobs"]["deploy"]["steps"][5]["env"].update({"CLOUDFLARE_API_TOKEN": "${{ secrets.CLOUDFLARE_API_TOKEN }}"}),
        "Cloudflare secret in build job": lambda w: w["jobs"]["build"]["steps"][0].update({"env": {"CLOUDFLARE_DEV_API_TOKEN": "${{ secrets.CLOUDFLARE_DEV_API_TOKEN }}"}}),
        "production deployment branch": lambda w: w["jobs"]["deploy"]["steps"][6].update({"run": "wrangler pages deploy dist --branch master"}),
        "project creation command": lambda w: w["jobs"]["deploy"]["steps"][6].update({"run": "wrangler pages project create tropicaltrance-web"}),
        "unreviewed Wrangler scripts": lambda w: w["jobs"]["deploy"]["steps"][4].update({"run": "npm install -g wrangler"}),
        "missing noindex validation": lambda w: w["jobs"]["build"]["steps"][10].update({"run": "npm run build"}),
        "missing production branch preflight": lambda w: w["jobs"]["deploy"]["steps"][5].update({"run": "curl"}),
        "missing stale deployment check": lambda w: w["jobs"]["deploy"]["steps"][6].update({
            "run": "wrangler pages deploy dist --project-name tropicaltrance-web --branch development"}),
        "stale check does not pin development branch": lambda w: w["jobs"]["deploy"]["steps"][6].update({
            "run": w["jobs"]["deploy"]["steps"][6]["run"].replace("/commits/development", "/commits/master")}),
        "wrong hard-coded Pages project": lambda w: w["jobs"]["deploy"]["steps"][6].update({
            "run": w["jobs"]["deploy"]["steps"][6]["run"].replace("tropicaltrance-web", "wrong-project")}),
    }
    for name, mutate in mutations.items():
        specimen = copy.deepcopy(valid)
        try:
            mutate(specimen)
            check_cloudflare_development_workflow(specimen)
        except (PolicyError, KeyError, AttributeError, TypeError):
            print("REJECTED development deployment negative case: " + name)
        else:
            raise PolicyError("development deployment negative case was incorrectly accepted: " + name)
    cloudflare_development_execution_checks(valid)


def cloudflare_development_execution_checks(workflow):
    """Exercise the real auth/staleness scripts using only synthetic local tools."""
    steps = workflow["jobs"]["deploy"]["steps"]
    authorization = steps[1]["run"]
    publish = steps[6]["run"]
    with tempfile.TemporaryDirectory(prefix="tt-deploy-policy-") as directory:
        root = Path(directory)
        dist = root / "dist"
        dist.mkdir()
        (dist / "index.html").write_text('<meta name="robots" content="noindex, nofollow">')
        (dist / "robots.txt").write_text("User-agent: *\nDisallow: /\n")
        gate_values = {
            "PATH": "/usr/bin:/bin",
            "GITHUB_REF": "refs/heads/development",
            "CLOUDFLARE_DEV_ACCESS_READY": "true",
            "CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED": "true",
        }
        result = subprocess.run(["/bin/bash", "-c", authorization], cwd=root, env=gate_values,
                                text=True, capture_output=True, check=False)
        require(result.returncode == 0, "authorized development gate fixture did not pass")
        for name, override in (
            ("missing readiness", {"CLOUDFLARE_DEV_ACCESS_READY": None}),
            ("missing enablement", {"CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED": None}),
            ("malformed readiness", {"CLOUDFLARE_DEV_ACCESS_READY": "TRUE"}),
            ("malformed enablement", {"CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED": "1"}),
            ("disabled deployment", {"CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED": "false"}),
            ("wrong branch", {"GITHUB_REF": "refs/heads/master"}),
        ):
            env = gate_values.copy()
            for key, value in override.items():
                if value is None:
                    env.pop(key, None)
                else:
                    env[key] = value
            result = subprocess.run(["/bin/bash", "-c", authorization], cwd=root, env=env,
                                    text=True, capture_output=True, check=False)
            require(result.returncode != 0, "development authorization accepted " + name)

        fake_bin = root / "bin"
        fake_bin.mkdir()
        marker = root / "wrangler-ran"
        gh = fake_bin / "gh"
        gh.write_text("#!/bin/sh\n[ \"$FAKE_GH_FAIL\" != true ] || exit 1\nprintf '%s\\n' \"$FAKE_GH_SHA\"\n")
        gh.chmod(0o700)
        wrangler = fake_bin / "wrangler"
        wrangler.write_text("#!/bin/sh\nprintf ran > \"$FAKE_WRANGLER_MARKER\"\n")
        wrangler.chmod(0o700)
        source_sha = "a" * 40
        base = {
            "PATH": str(fake_bin), "GH_TOKEN": "synthetic-test-token",
            "GITHUB_REPOSITORY": "example/disposable-fixture", "SOURCE_SHA": source_sha,
            "FAKE_GH_SHA": source_sha, "FAKE_GH_FAIL": "false",
            "FAKE_WRANGLER_MARKER": str(marker),
        }
        result = subprocess.run(["/bin/bash", "-c", publish], cwd=root, env=base,
                                text=True, capture_output=True, check=False)
        require(result.returncode == 0 and marker.is_file(),
                "current development HEAD did not reach the synthetic upload command")
        marker.unlink()
        for name, override in (
            ("stale workflow SHA", {"FAKE_GH_SHA": "b" * 40}),
            ("unverifiable remote SHA", {"FAKE_GH_FAIL": "true"}),
            ("malformed remote SHA", {"FAKE_GH_SHA": "not-a-commit"}),
            ("malformed workflow SHA", {"SOURCE_SHA": "not-a-commit"}),
        ):
            env = base.copy()
            env.update(override)
            result = subprocess.run(["/bin/bash", "-c", publish], cwd=root, env=env,
                                    text=True, capture_output=True, check=False)
            require(result.returncode != 0 and not marker.exists(),
                    "staleness guard allowed upload for " + name)


def check_release_workflow(workflow):
    require(isinstance(workflow, dict) and
            set(workflow) == {"name", "on", "permissions", "concurrency", "jobs"},
            "unexpected release workflow shape")
    require(workflow["name"] == "Create GitHub Release", "release workflow name differs")
    require(workflow["on"] == {"workflow_dispatch": {"inputs": {
        "version_bump": {"description": "Semantic version increment", "required": True,
                          "type": "choice", "options": ["patch", "minor", "major"],
                          "default": "patch"},
        "confirmation": {"description": "Type CREATE_RELEASE to authorize an annotated tag and prerelease for this exact master commit",
                         "required": True, "type": "string"},
    }}}, "release creation must be manual only with the reviewed inputs")
    require(workflow["permissions"] == {"contents": "read"},
            "release workflow defaults must be read-only")
    require(workflow["concurrency"] == {"group": "github-release-creation", "cancel-in-progress": False},
            "release creation must serialize runs without cancellation")
    jobs = workflow["jobs"]
    require(isinstance(jobs, dict) and set(jobs) == {"authorize", "prepare", "create_tag", "publish"},
            "unexpected release jobs or deployment job")
    authorize = jobs["authorize"]
    require(set(authorize) == {"runs-on", "timeout-minutes", "steps"} and
            authorize["runs-on"] == "ubuntu-24.04" and authorize["timeout-minutes"] == 2,
            "authorization must run without elevated token permissions")
    auth_steps = authorize["steps"]
    require(len(auth_steps) == 1 and set(auth_steps[0]) == {"name", "env", "run"} and
            auth_steps[0]["name"] == "Require master and explicit release confirmation" and
            auth_steps[0]["env"] == {
                "GITHUB_REF": "${{ github.ref }}",
                "VERSION_BUMP": "${{ inputs.version_bump }}",
                "CONFIRMATION": "${{ inputs.confirmation }}",
            } and script_digest(auth_steps[0]["run"]) == RELEASE_SCRIPT_DIGESTS["authorize"],
            "authorization must reject wrong refs, bumps, or missing confirmation")

    prepare = jobs["prepare"]
    require(set(prepare) == {"needs", "if", "runs-on", "timeout-minutes", "permissions", "outputs", "steps"} and
            prepare["needs"] == "authorize" and prepare["if"] == "needs.authorize.result == 'success'" and
            prepare["runs-on"] == "ubuntu-24.04" and prepare["timeout-minutes"] == 10 and
            prepare["permissions"] == {"contents": "read", "actions": "read"},
            "source and CI verification must use read-only token permissions")
    require(prepare["outputs"] == {
        "source_sha": "${{ steps.source.outputs.source_sha }}",
        "version": "${{ steps.version.outputs.version }}",
    }, "prepare job must expose only the validated source SHA and version")
    prep_steps = prepare["steps"]
    require(len(prep_steps) == 4, "prepare job must use checkout, source, CI, and version steps")
    checkout, source, ci, version = prep_steps
    require(checkout == {
        "name": "Check out the dispatched master commit",
        "uses": CHECKOUT,
        "with": {"ref": "${{ github.sha }}", "fetch-depth": 0, "persist-credentials": False},
    }, "release source checkout must be pinned to the dispatch SHA without persisted credentials")
    for step, key, name in ((source, "source", "Pin source commit and verify master ancestry"),
                            (ci, "ci", "Require successful master validation for this commit"),
                            (version, "version", "Calculate version and reject an existing release for this commit")):
        expected_keys = {"name", "run", "env"}
        if key in {"source", "version"}:
            expected_keys.add("id")
        require(set(step) == expected_keys and
                step["name"] == name and script_digest(step["run"]) == RELEASE_SCRIPT_DIGESTS[key],
                "release prepare step differs from reviewed policy: " + name)
    check_gh_api_flag_compatibility(version["run"])
    require(source["id"] == "source" and source["env"] == {"DISPATCH_SHA": "${{ github.sha }}"},
            "source SHA must be pinned to the dispatch commit")
    require(ci["env"] == {
        "GH_TOKEN": "${{ github.token }}",
        "GITHUB_REPOSITORY": "${{ github.repository }}",
        "SOURCE_SHA": "${{ steps.source.outputs.source_sha }}",
    }, "CI verification may use only a read-scoped token and pinned SHA")
    require(version["id"] == "version" and version["env"] == {
        "GH_TOKEN": "${{ github.token }}",
        "GITHUB_REPOSITORY": "${{ github.repository }}",
        "SOURCE_SHA": "${{ steps.source.outputs.source_sha }}",
        "VERSION_BUMP": "${{ inputs.version_bump }}",
    }, "version check may use only read-scoped token and approved release inputs")

    create_tag = jobs["create_tag"]
    require(set(create_tag) == {"needs", "if", "runs-on", "timeout-minutes", "permissions", "steps"} and
            create_tag["needs"] == "prepare" and create_tag["if"] == "needs.prepare.result == 'success'" and
            create_tag["runs-on"] == "ubuntu-24.04" and create_tag["timeout-minutes"] == 5 and
            create_tag["permissions"] == {"contents": "write"},
            "annotated tag creation must be the only step with contents:write at this stage")
    tag_steps = create_tag["steps"]
    require(len(tag_steps) == 1 and set(tag_steps[0]) == {"name", "run", "env"} and
            tag_steps[0]["name"] == "Create immutable annotated version tag" and
            script_digest(tag_steps[0]["run"]) == RELEASE_SCRIPT_DIGESTS["tag"] and
            tag_steps[0]["env"] == {
                "GH_TOKEN": "${{ github.token }}",
                "GITHUB_REPOSITORY": "${{ github.repository }}",
                "SOURCE_SHA": "${{ needs.prepare.outputs.source_sha }}",
                "VERSION": "${{ needs.prepare.outputs.version }}",
            }, "tag creation must use only the exact validated source and version")

    publish = jobs["publish"]
    require(set(publish) == {"needs", "if", "runs-on", "timeout-minutes", "permissions", "steps"} and
            publish["needs"] == ["prepare", "create_tag"] and publish["if"] == "needs.create_tag.result == 'success'" and
            publish["runs-on"] == "ubuntu-24.04" and publish["timeout-minutes"] == 5 and
            publish["permissions"] == {"contents": "write"},
            "release publication must use only contents:write")
    publish_steps = publish["steps"]
    require(len(publish_steps) == 1 and set(publish_steps[0]) == {"name", "id", "run", "env"} and
            publish_steps[0]["name"] == "Publish prerelease with generated notes" and
            publish_steps[0]["id"] == "published" and
            script_digest(publish_steps[0]["run"]) == RELEASE_SCRIPT_DIGESTS["publish"] and
            publish_steps[0]["env"] == tag_steps[0]["env"],
            "release publication must use the exact annotated tag and source SHA")
    serialized = json.dumps(workflow).lower()
    require("cloudflare" not in serialized and "wrangler" not in serialized and
            "secrets." not in serialized and "deployment" not in serialized,
            "release workflow must not contain deployment logic or external service credentials")


def check_gh_api_flag_compatibility(script):
    normalized = script.replace("\\\n", " ")
    for command in re.split(r"[;\n]", normalized):
        if re.search(r"\bgh\s+api\b", command):
            require(not ("--slurp" in command and "--jq" in command),
                    "gh api does not support combining --slurp with --jq")


def release_negative_checks(valid):
    check_release_workflow(valid)
    try:
        check_gh_api_flag_compatibility(
            "release_tags=$(gh api --paginate --slurp releases --jq 'flatten | .[].tag_name')")
    except PolicyError:
        print("REJECTED release negative case: incompatible gh api --slurp and --jq flags")
    else:
        raise PolicyError("incompatible gh api --slurp and --jq flags were accepted")
    require(next_version([], "patch") == "v0.1.1" and
            next_version(["v0.1.0"], "minor") == "v0.2.0" and
            next_version(["v0.1.0"], "major") == "v1.0.0" and
            next_version(["v1.2.9"], "patch") == "v1.2.10",
            "patch/minor/major calculations differ from the release policy")
    for fixture in (("v01.2.3",), ("v1.2",), ("v1.2.3-rc.1",), ("v1.2.3", "v1.2.3")):
        try:
            latest_version(fixture)
        except ValueError:
            continue
        raise PolicyError("malformed or duplicate version tag was accepted: " + repr(fixture))
    mutations = {
        "automatic release trigger": lambda w: w["on"].update({"push": {"branches": ["master"]}}),
        "wrong default bump": lambda w: w["on"]["workflow_dispatch"]["inputs"]["version_bump"].update({"default": "major"}),
        "missing confirmation": lambda w: w["on"]["workflow_dispatch"]["inputs"].pop("confirmation"),
        "wrong ref authorization": lambda w: w["jobs"]["authorize"]["steps"][0].update({"run": "echo authorized"}),
        "missing source ancestry check": lambda w: w["jobs"]["prepare"]["steps"][1].update({"run": "echo source"}),
        "missing CI verification": lambda w: w["jobs"]["prepare"]["steps"][2].update({"run": "true"}),
        "missing duplicate-release check": lambda w: w["jobs"]["prepare"]["steps"][3].update({"run": "echo version"}),
        "lightweight tag instead of annotated tag": lambda w: w["jobs"]["create_tag"]["steps"][0].update({"run": "git tag $VERSION"}),
        "tag not bound to source commit": lambda w: w["jobs"]["create_tag"]["steps"][0].update({"run": "gh api git/tags"}),
        "broadened token permissions": lambda w: w["jobs"]["publish"]["permissions"].update({"administration": "write"}),
        "missing generated notes": lambda w: w["jobs"]["publish"]["steps"][0].update({
            "run": w["jobs"]["publish"]["steps"][0]["run"].replace("--generate-notes ", "")}),
        "missing tag and release consistency checks": lambda w: w["jobs"]["publish"]["steps"][0].update({"run": "gh release create $VERSION"}),
        "Cloudflare secret": lambda w: w["jobs"]["publish"]["steps"][0]["env"].update({"CLOUDFLARE_API_TOKEN": "${{ secrets.CLOUDFLARE_API_TOKEN }}"}),
        "automatic deployment": lambda w: w["jobs"].update({"deploy": {"needs": "publish"}}),
        "stable release instead of prerelease": lambda w: w["jobs"]["publish"]["steps"][0].update({"run": "gh release create --verify-tag"}),
        "missing release concurrency": lambda w: w.update({"concurrency": {"group": "release", "cancel-in-progress": True}}),
    }
    for name, mutate in mutations.items():
        specimen = copy.deepcopy(valid)
        mutate(specimen)
        try:
            check_release_workflow(specimen)
        except (PolicyError, KeyError, AttributeError):
            print("REJECTED release negative case: " + name)
        else:
            raise PolicyError("release negative case was incorrectly accepted: " + name)

def unique_object(pairs):
    obj = {}
    for key, value in pairs:
        require(key not in obj, "duplicate workflow key")
        obj[key] = value
    return obj


def script_digest(script):
    import hashlib
    require(isinstance(script, str), "workflow shell commands must be text")
    return hashlib.sha256(script.encode("utf-8")).hexdigest()


def wrangler_version_matches(output):
    """Recognize the pinned semver token in Wrangler's first version-output line."""
    if not isinstance(output, str) or not output.splitlines():
        return False
    return WRANGLER_VERSION_PATTERN.search(output.splitlines()[0]) is not None


def load_workflow(path):
    require(path.is_file() and not path.is_symlink(), "workflow must be a regular local file")
    try:
        return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)
    except json.JSONDecodeError as exc:
        raise PolicyError("active workflow must use the JSON subset of YAML") from exc


def negative_checks(valid):
    check_workflow(valid)
    mutations = {
        "missing development PR target": lambda w: w["on"]["pull_request"].update({"branches": ["master"]}),
        "unexpected PR target": lambda w: w["on"]["pull_request"]["branches"].append("main"),
        "development push trigger": lambda w: w["on"]["push"].update({"branches": ["development", "master"]}),
        "unexpected validation event": lambda w: w["on"].update({"workflow_dispatch": {}}),
        "PR deployment job": lambda w: w["jobs"].update({"deploy": {"needs": "policy"}}),
        "pages write": lambda w: w["permissions"].update({"pages": "write"}),
        "OIDC write": lambda w: w["permissions"].update({"id-token": "write"}),
        "contents write": lambda w: w["permissions"].update({"contents": "write"}),
        "pull_request_target": lambda w: w["on"].update({"pull_request_target": {}}),
        "workflow_run": lambda w: w["on"].update({"workflow_run": {"workflows": ["release"]}}),
        "production environment": lambda w: w["jobs"]["policy"].update({"environment": "production"}),
        "deployment action": lambda w: w["jobs"]["policy"]["steps"][0].update({"uses": "actions/deploy-pages@v4"}),
        "Pages artifact": lambda w: w["jobs"]["policy"]["steps"][0].update({"uses": "actions/upload-pages-artifact@v3"}),
        "Cloudflare action": lambda w: w["jobs"]["policy"]["steps"][0].update({"uses": "cloudflare/wrangler-action@v3"}),
        "persisted credentials": lambda w: w["jobs"]["policy"]["steps"][0]["with"].update({"persist-credentials": True}),
        "production secret": lambda w: w["jobs"]["policy"].update({"env": {"TOKEN": "${{ secrets.PRODUCTION_TOKEN }}"}}),
        "reusable release workflow": lambda w: w["jobs"]["policy"].update({"uses": "./.github/workflows/release.yml"}),
        "nonexistent Astro command": lambda w: w["jobs"]["policy"]["steps"][6].update({"run": "npm run build"}),
        "dependency installation": lambda w: w["jobs"]["policy"]["steps"][6].update({"run": "npm ci"}),
        "all-browser installation": lambda w: w["jobs"]["policy"]["steps"][7].update({"run": "npx playwright install --with-deps"}),
        "external browser test target": lambda w: w["jobs"]["policy"]["steps"][8].update({"run": "npm run test:e2e -- --config=https://example.invalid"}),
        "extra command": lambda w: w["jobs"]["policy"]["steps"][1].update({"run": COMMAND + "\ncurl https://example.invalid"}),
    }
    for name, mutate in mutations.items():
        specimen = copy.deepcopy(valid)
        mutate(specimen)
        try:
            check_workflow(specimen)
        except PolicyError:
            print("REJECTED negative case: " + name)
        else:
            raise PolicyError("negative case was incorrectly accepted: " + name)
    try:
        json.loads('{"name": "a", "name": "b"}', object_pairs_hook=unique_object)
    except PolicyError:
        print("REJECTED negative case: duplicate YAML/JSON key")
    else:
        raise PolicyError("duplicate keys were incorrectly accepted")


def cloudflare_negative_checks(valid):
    check_cloudflare_workflow(valid)
    for output in ("4.152.0", "Wrangler 4.152.0", "☁ Wrangler v4.152.0"):
        if not wrangler_version_matches(output):
            raise PolicyError("expected Wrangler version output fixture was rejected: " + output)
    for output in ("4.152.1", "4.152.0-beta.1", "4.152.0.1", "Wrangler 4.151.3"):
        if wrangler_version_matches(output):
            raise PolicyError("incorrect Wrangler version output fixture was accepted: " + output)
    print("REJECTED deployment negative case: mismatched Wrangler version output")
    mutations = {
        "automatic push trigger": lambda w: w["on"].update({"push": {"branches": ["master"]}}),
        "automatic PR trigger": lambda w: w["on"].update({"pull_request": {}}),
        "legacy public publication input": lambda w: w["on"]["workflow_dispatch"]["inputs"].update({
            "publication_approved": {"description": "Approve public publishing", "required": True,
                                     "type": "boolean", "default": False}}),
        "public-launch wording": lambda w: w["on"]["workflow_dispatch"]["inputs"]["confirmation"].update({
            "description": "Type DEPLOY_TO_PAGES to approve public deployment"}),
        "writable workflow token": lambda w: w["permissions"].update({"contents": "write"}),
        "missing branch refusal": lambda w: w["jobs"]["authorize"]["steps"][0].update({
            "run": w["jobs"]["authorize"]["steps"][0]["run"].replace("refs/heads/master", "refs/heads/main")}),
        "missing Access confirmation": lambda w: w["jobs"]["authorize"]["steps"][0]["env"].pop("ACCESS_PROTECTION_VERIFIED"),
        "missing private deployment approval": lambda w: w["jobs"]["authorize"]["steps"][0]["env"].pop("PRIVATE_DEPLOYMENT_APPROVED"),
        "unprotected build ref": lambda w: w["jobs"]["build"].update({"if": "always()"}),
        "production secret in build": lambda w: w["jobs"]["build"].update({"env": {"TOKEN": "${{ secrets.CLOUDFLARE_API_TOKEN }}"}}),
        "missing protected environment": lambda w: w["jobs"]["deploy"].pop("environment"),
        "project creation": lambda w: w["jobs"]["deploy"]["steps"][5].update({"run": "wrangler pages project create bad"}),
        "unreviewed Wrangler install": lambda w: w["jobs"]["deploy"]["steps"][4].update({"run": "npm install -g wrangler"}),
        "uninitialized Wrangler prefix": lambda w: w["jobs"]["deploy"]["steps"][4].update({
            "run": w["jobs"]["deploy"]["steps"][4]["run"].replace(
                'mkdir -p "$TMP_PREFIX/lib/node_modules" "$TMP_PREFIX/bin"\n', "")}),
        "wrong production project branch": lambda w: w["jobs"]["deploy"]["steps"][6].update({"run": "wrangler pages deploy dist --branch feat/test"}),
        "additional Cloudflare action": lambda w: w["jobs"]["deploy"]["steps"][0].update({"uses": "cloudflare/wrangler-action@v4"}),
    }
    for name, mutate in mutations.items():
        specimen = copy.deepcopy(valid)
        mutate(specimen)
        try:
            check_cloudflare_workflow(specimen)
        except (PolicyError, KeyError, AttributeError):
            print("REJECTED deployment negative case: " + name)
        else:
            raise PolicyError("deployment negative case was incorrectly accepted: " + name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    directory = root / ".github/workflows"
    require(not directory.is_symlink(), "workflow directory must not be a symlink")
    active = sorted(p for p in directory.iterdir() if p.suffix.lower() in {".yml", ".yaml"})
    require([p.name for p in active] == ["create-release.yml", "deploy-cloudflare-development.yml",
                                         "deploy-cloudflare.yml", "validate.yml"],
            "only the reviewed validation, release, development deployment, and production deployment workflows are allowed")
    workflows = {path.name: load_workflow(path) for path in active}
    workflow = workflows["validate.yml"]
    check_workflow(workflow)
    cloudflare = workflows["deploy-cloudflare.yml"]
    check_cloudflare_workflow(cloudflare)
    cloudflare_development = workflows["deploy-cloudflare-development.yml"]
    check_cloudflare_development_workflow(cloudflare_development)
    release = workflows["create-release.yml"]
    check_release_workflow(release)
    require((root / ".github/ci/check_policy.py").is_file(), "policy command file is missing")
    require((root / "docs/migration/astro-foundation-baseline.md").is_file(), "baseline document is missing")
    package = json.loads((root / "package.json").read_text())
    require(all(k in package["scripts"] for k in ["validate", "verify:reproducible", "test:e2e"]), "referenced npm scripts must exist")
    require((root / "package-lock.json").is_file(), "locked install requires lockfile")
    if args.self_test:
        negative_checks(workflow)
        cloudflare_negative_checks(cloudflare)
        cloudflare_development_negative_checks(cloudflare_development)
        release_negative_checks(release)
    print("LOCAL CI ISOLATION: PASS (bounded source policy; remote controls unverified)")


if __name__ == "__main__":
    try:
        main()
    except (PolicyError, OSError) as exc:
        raise SystemExit("LOCAL CI ISOLATION: FAIL: " + str(exc))
