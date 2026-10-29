"""Local CI policy for validation and manually gated Pages deployment.

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
    "authorize": "70338aa4bb784e4636858d1c7a997520795aa84fd1c23a90adac2d01d601a6d7",
    "source": "4bbb31b495bdf14ab8042d274a68a15dad4268c17909394115f2842e181c05de",
    "ci": "d07a71cbe13547a8dbea001b9cb6c670737ec2965867cd9f79d6f6f1fbd2da03",
    "version": "9a9c574d136cdc1f20db7588beb2800bc31c1cee6bef07cc4b06b470043d2d29",
    "tag": "34aaddb3f9ea1b3f19f56f23abd78f6f2e8ac3d4a055e4afa0b04a0437883784",
    "publish": "44b886f63af7176dae7ff00950244723a14d1c5895451d8783b5f822b4686aaf",
}
VALIDATION_STEPS = [
    ("Test release version calculation", "python3 -B -m unittest discover -s .github/ci -p 'test_release_version.py' -v"),
    ("Test release and deployment metadata validation", "python3 -B -m unittest discover -s .github/ci -p 'test_*deployment.py' -v"),
    ("Validate application and isolated review builds", "npm run validate"),
    ("Verify reproducible builds", "npm run verify:reproducible"),
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
    }, "validation may run only for pull requests to development/master and pushes to master")
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
    require(isinstance(steps, list) and len(steps) == 11,
            "exactly reviewed checkout, policy, runtime, npm pin, locked install and validation steps are allowed")
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
    """Enforce bounded release-driven deploy shape and credential isolation."""
    require(isinstance(workflow, dict) and set(workflow) == {"name", "on", "permissions", "concurrency", "jobs"}, "unexpected deployment workflow shape")
    dispatch = workflow["on"].get("workflow_dispatch", {})
    require(set(workflow["on"]) == {"workflow_dispatch"}, "deployment must remain manual only")
    inputs = dispatch.get("inputs", {})
    require(set(inputs) == {"release_tag", "access_protection_verified", "private_deployment_approved"}, "required deployment and release approval inputs differ")
    require(inputs["release_tag"].get("required") is True and inputs["release_tag"].get("type") == "string", "release tag must be explicitly selected")
    for gate in ("access_protection_verified", "private_deployment_approved"):
        require(inputs[gate].get("required") is True and inputs[gate].get("type") == "boolean" and inputs[gate].get("default") is False, "approval gate must default to false")
    require(workflow["permissions"] == {"contents": "read"}, "workflow token must remain read-only")
    require(workflow["concurrency"] == {"group": "cloudflare-production", "cancel-in-progress": False}, "deployment serialization changed")
    jobs = workflow["jobs"]
    require(set(jobs) == {"authorize", "build", "deploy"}, "unexpected deployment job")
    authorize, build, deploy = (jobs[k] for k in ("authorize", "build", "deploy"))
    require(set(authorize) == {"runs-on", "timeout-minutes", "outputs", "steps"} and authorize["runs-on"] == "ubuntu-24.04" and authorize["timeout-minutes"] == 5, "authorization job settings changed")
    require(authorize["outputs"] == {"source_sha": "${{ steps.release.outputs.source_sha }}", "release_id": "${{ steps.release.outputs.release_id }}", "release_url": "${{ steps.release.outputs.release_url }}", "tag_object_sha": "${{ steps.release.outputs.tag_object_sha }}"}, "release pins must be propagated as job outputs")
    auth_steps = authorize["steps"]
    require(len(auth_steps) == 3 and set(auth_steps[0]) == {"name", "uses", "with"} and auth_steps[0]["uses"] == CHECKOUT and auth_steps[0]["with"] == {"ref": "${{ github.sha }}", "fetch-depth": 0, "persist-credentials": False, "clean": False}, "authorization must fetch full master/tag history without persisted credentials")
    auth_gate = auth_steps[1]
    require(set(auth_gate) == {"name", "env", "run"} and auth_gate["env"] == {"GITHUB_REF": "${{ github.ref }}", "ACCESS_PROTECTION_VERIFIED": "${{ inputs.access_protection_verified }}", "PRIVATE_DEPLOYMENT_APPROVED": "${{ inputs.private_deployment_approved }}"}, "authorization input wiring changed")
    for required in ("refs/heads/master", "ACCESS_PROTECTION_VERIFIED", "PRIVATE_DEPLOYMENT_APPROVED"):
        require(required in auth_gate["run"], "authorization gate missing " + required)
    release_step = auth_steps[2]
    require(set(release_step) == {"name", "id", "env", "run"} and release_step["id"] == "release" and release_step["run"] == "python3 -B .github/ci/release_deployment.py", "release validation command changed")
    require(release_step["env"] == {"GITHUB_TOKEN": "${{ github.token }}", "GITHUB_REPOSITORY": "${{ github.repository }}", "GITHUB_REF": "${{ github.ref }}", "RELEASE_TAG": "${{ inputs.release_tag }}"}, "release API step has excess or missing inputs")
    require(set(build) == {"needs", "if", "runs-on", "timeout-minutes", "steps"} and build["needs"] == "authorize" and build["if"] == "github.ref == 'refs/heads/master'" and build["runs-on"] == "ubuntu-24.04" and build["timeout-minutes"] == 20, "build must require authorization and protected master")
    build_steps = build["steps"]
    require(len(build_steps) == 6, "build pipeline step count changed")
    require(build_steps[0].get("uses") == CHECKOUT and build_steps[0].get("with") == {"ref": "${{ needs.authorize.outputs.source_sha }}", "fetch-depth": 1, "persist-credentials": False, "clean": False}, "build must checkout the exact authorized release commit")
    require(build_steps[1] == {"name": "Use pinned Node.js", "uses": SETUP_NODE, "with": {"node-version": "24.21.0", "package-manager-cache": False}}, "build Node pin changed")
    require(build_steps[2] == {"name": "Use repository-pinned npm", "run": PIN_NPM} and build_steps[3] == {"name": "Install locked dependencies without lifecycle scripts", "run": LOCKED_INSTALL}, "build package manager policy changed")
    build_script = build_steps[4]
    require(set(build_script) == {"name", "env", "run"} and build_script["env"] == {"SOURCE_SHA": "${{ needs.authorize.outputs.source_sha }}", "TROPICAL_INDEXING_AUTHORIZATION": "", "TROPICAL_SEO_ORIGIN": ""}, "build authorization/output environment changed")
    for required in ("git rev-parse HEAD", "npm run build", "npm run validate:output", "noindex", "deployment-manifest.sha256"):
        require(required in build_script["run"], "release build verification missing " + required)
    require("secrets." not in json.dumps(build), "Cloudflare secrets must not enter build job")
    require(build_steps[5].get("uses") == UPLOAD_ARTIFACT and build_steps[5].get("with", {}).get("name") == "cloudflare-pages-dist", "validated artifact action changed")
    require(build_steps[5]["with"].get("if-no-files-found") == "error" and build_steps[5]["with"].get("retention-days") == 1 and "deployment-manifest.sha256" in build_steps[5]["with"].get("path", ""), "artifact must include its digest manifest")
    require(set(deploy) == {"needs", "if", "runs-on", "timeout-minutes", "environment", "steps"} and deploy["needs"] == ["authorize", "build"] and deploy["if"] == "github.ref == 'refs/heads/master'" and deploy["runs-on"] == "ubuntu-24.04" and deploy["environment"] == "cloudflare-production", "deploy job must require authorization/build and protected master")
    deploy_steps = deploy.get("steps", [])
    require(len(deploy_steps) == 9, "deployment sequence changed")
    require(deploy_steps[0].get("uses") == CHECKOUT and deploy_steps[0].get("with") == {"ref": "${{ github.sha }}", "fetch-depth": 0, "persist-credentials": False, "clean": False}, "deployment must checkout master/tag history before downloading artifacts")
    require(deploy_steps[1].get("uses") == DOWNLOAD_ARTIFACT and deploy_steps[1].get("with") == {"name": "cloudflare-pages-dist", "path": "."}, "deployment must download the verified artifact after checkout")
    require(deploy_steps[2].get("run") == "python3 -B .github/ci/release_deployment.py" and deploy_steps[2].get("env", {}).get("EXPECTED_SOURCE_SHA") == "${{ needs.authorize.outputs.source_sha }}" and deploy_steps[2].get("env", {}).get("EXPECTED_TAG_OBJECT_SHA") == "${{ needs.authorize.outputs.tag_object_sha }}" and deploy_steps[2].get("env", {}).get("EXPECTED_RELEASE_ID") == "${{ needs.authorize.outputs.release_id }}", "deployment must reject moved release/tag references")
    require("sha256sum --check --strict" in deploy_steps[3].get("run", "") and "CLOUDFLARE_ACCESS_READY" in deploy_steps[3].get("env", {}), "artifact and Access readiness checks missing")
    require(deploy_steps[4].get("uses") == SETUP_NODE and deploy_steps[4].get("with", {}).get("node-version") == "24.21.0", "Wrangler Node pin changed")
    require(deploy_steps[5].get("run") == PIN_NPM, "Wrangler npm pin changed")
    wrangler_install = deploy_steps[6].get("run", "")
    require("wrangler@4.152.0" in wrangler_install and "--strict-allow-scripts" in wrangler_install, "Wrangler dependency install policy changed")
    for index in (7, 8):
        require(deploy_steps[index].get("env", {}).get("CLOUDFLARE_API_TOKEN") == "${{ secrets.CLOUDFLARE_API_TOKEN }}" and deploy_steps[index].get("env", {}).get("CLOUDFLARE_ACCOUNT_ID") == "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}", "Cloudflare credentials may only be available in preflight/upload steps")
    require("secrets." not in json.dumps(deploy_steps[:7]), "Cloudflare credentials exposed before preflight")
    require("python3 -B .github/ci/cloudflare_deployment.py snapshot" in deploy_steps[7].get("run", ""), "pre-upload deployment snapshot missing")
    upload_script = deploy_steps[8].get("run", "")
    require("wrangler pages deploy dist" in upload_script and "UPLOAD SUCCEEDED" in upload_script and "UPLOAD FAILED" in upload_script, "upload and post-upload failure states must be distinguished")
    require("python3 -B .github/ci/cloudflare_deployment.py verify" in upload_script and "without retrying upload" in deploy_steps[8].get("name", ""), "metadata verification must be bounded and must not repeat upload")
    require("$SOURCE_SHA" in upload_script and "$DEPLOYMENT_COMMIT_MESSAGE" in upload_script, "upload identity must include source SHA and unique run marker")
    require(deploy.get("environment") == "cloudflare-production", "deployment environment protection must remain")
    serialized = json.dumps(deploy)
    require("${{ needs.authorize.outputs.source_sha }}" in serialized, "deploy must consume authorization SHA")
    require("${{ secrets.CLOUDFLARE_API_TOKEN }}" in serialized and "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}" in serialized, "deploy credentials missing")
    require("wrangler pages deploy dist" in serialized and "--branch master" in serialized and "--commit-hash" in serialized, "upload must target existing production branch with source metadata")
    deploy_commands = "\n".join(step.get("run", "") for step in deploy.get("steps", []))
    require("wrangler pages deploy dist" in deploy_commands and "--commit-hash \"$SOURCE_SHA\"" in deploy_commands and "$RELEASE_TAG" in deploy_commands, "deployment metadata must use the selected release SHA and tag")
    require("project create" not in serialized and "wrangler pages project" not in serialized, "workflow must not create or mutate Pages projects")
    require("CLOUDFLARE_ACCESS_READY" in serialized and "cloudflare-production" in serialized, "Access/environment readiness weakened")
    require("python3 -B .github/ci/release_deployment.py" in json.dumps(authorize) and "python3 -B .github/ci/release_deployment.py" in serialized, "release and tag must be checked before deployment")
    for job_name, job in jobs.items():
        require(job.get("runs-on") == "ubuntu-24.04", "unreviewed runner in " + job_name)
    require("actions/checkout@" + "d23441a48e516b6c34aea4fa41551a30e30af803" in json.dumps(workflow), "checkout action pin changed")
    require("actions/setup-node@" + "249970729cb0ef3589644e2896645e5dc5ba9c38" in json.dumps(workflow), "Node action pin changed")


def check_cloudflare_development_workflow(workflow):
    """Require a push-only dev preview deploy with isolated credentials and Access gates."""
    require(isinstance(workflow, dict) and
            set(workflow) == {"name", "on", "permissions", "concurrency", "jobs"},
            "unexpected development workflow shape")
    require(workflow["name"] == "Cloudflare Pages development deployment" and
            workflow["on"] == {"push": {"branches": ["development"]}},
            "development deployment must run only after pushes to development")
    require(workflow["permissions"] == {"contents": "read"},
            "development workflow token must remain read-only")
    require(workflow["concurrency"] == {
        "group": "cloudflare-development", "cancel-in-progress": False},
        "development deployments must be serialized")
    jobs = workflow["jobs"]
    require(isinstance(jobs, dict) and set(jobs) == {"build", "deploy"},
            "unexpected development deployment jobs")

    build = jobs["build"]
    require(set(build) == {"runs-on", "timeout-minutes", "steps"} and
            build["runs-on"] == "ubuntu-24.04" and build["timeout-minutes"] == 40,
            "development build runner or timeout changed")
    steps = build["steps"]
    require(len(steps) == 12, "development build and validation sequence changed")
    checkout, setup, pin_npm, install, policy, release_tests, validate, reproducible, chromium, e2e, artifact_build, upload = steps
    require(checkout == {"name": "Read development source", "uses": CHECKOUT,
                         "with": {"persist-credentials": False, "fetch-depth": 1, "clean": False}},
            "development checkout must use the pinned action without persisted credentials")
    require(setup == {"name": "Use pinned Node.js", "uses": SETUP_NODE,
                      "with": {"node-version": "24.21.0", "package-manager-cache": False}},
            "development build must use pinned Node.js")
    require(pin_npm == {"name": "Use repository-pinned npm", "run": PIN_NPM} and
            install == {"name": "Install locked dependencies without lifecycle scripts", "run": LOCKED_INSTALL},
            "development build must use pinned npm and locked installation")
    require(policy == {"name": "Check all workflow security policies", "run": COMMAND},
            "development deployment must run the local policy checks")
    require(release_tests == {"name": "Test release version calculation",
                              "run": "python3 -B -m unittest discover -s .github/ci -p 'test_release_version.py' -v"},
            "development deployment must run release version tests")
    require(validate == {"name": "Run website validation", "run": "npm run validate"} and
            reproducible == {"name": "Verify reproducible builds", "run": "npm run verify:reproducible"},
            "development deployment must validate the website and reproducible build")
    require(chromium == {"name": "Install Chromium and required Linux dependencies",
                         "run": "npx playwright install --with-deps chromium"} and
            e2e == {"name": "Run isolated Chromium browser checks", "run": "npm run test:e2e"},
            "development deployment must retain browser tests")
    require(set(artifact_build) == {"name", "env", "run"} and
            artifact_build["env"] == {"TROPICAL_INDEXING_AUTHORIZATION": "", "TROPICAL_SEO_ORIGIN": ""} and
            all(value in artifact_build["run"] for value in
                ("npm run build", "npm run validate:output", "noindex", "robots.txt", "sitemap.xml")),
            "development artifact must retain private and non-indexable output checks")
    require(upload == {"name": "Upload validated development artifact", "uses": UPLOAD_ARTIFACT,
                       "with": {"name": "cloudflare-development-dist", "path": "dist/",
                                "if-no-files-found": "error", "retention-days": 1}},
            "development workflow must upload only the validated short-lived artifact")
    require("secrets." not in json.dumps(build), "Cloudflare credentials must not enter the build job")

    deploy = jobs["deploy"]
    require(set(deploy) == {"needs", "if", "runs-on", "timeout-minutes", "permissions", "environment", "steps"} and
            deploy["needs"] == "build" and deploy["if"] == "github.ref == 'refs/heads/development'" and
            deploy["runs-on"] == "ubuntu-24.04" and deploy["timeout-minutes"] == 15 and
            deploy["permissions"] == {"contents": "read"} and deploy["environment"] == "cloudflare-development",
            "only development may deploy through the isolated development environment")
    deploy_steps = deploy["steps"]
    require(len(deploy_steps) == 7, "development deploy sequence changed")
    download, gate, setup_wrangler, npm_wrangler, install_wrangler, preflight, publish = deploy_steps
    require(download == {"name": "Download validated development artifact", "uses": DOWNLOAD_ARTIFACT,
                         "with": {"name": "cloudflare-development-dist", "path": "dist"}},
            "development deployment must consume its validated artifact")
    require(set(gate) == {"name", "env", "run"} and gate["env"] == {
        "GITHUB_REF": "${{ github.ref }}",
        "CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED": "${{ vars.CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED }}",
        "CLOUDFLARE_DEV_ACCESS_READY": "${{ vars.CLOUDFLARE_DEV_ACCESS_READY }}",
    } and all(value in gate["run"] for value in
              ("refs/heads/development", "CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED", "CLOUDFLARE_DEV_ACCESS_READY", "'true'")),
            "development deployment must fail closed on its branch, enablement, and Access gates")
    require(setup_wrangler == {"name": "Use pinned Node.js for Wrangler", "uses": SETUP_NODE,
                               "with": {"node-version": "24.21.0", "package-manager-cache": False}} and
            npm_wrangler == {"name": "Use repository-pinned npm for Wrangler", "run": PIN_NPM},
            "development Wrangler runtime must remain pinned")
    require(install_wrangler["name"] == "Install pinned Wrangler with only reviewed dependency scripts" and
            set(install_wrangler) == {"name", "run"} and "wrangler@4.152.0" in install_wrangler["run"] and
            "--strict-allow-scripts" in install_wrangler["run"],
            "development Wrangler install must remain pinned and restricted")
    expected_dev_credentials = {
        "CLOUDFLARE_DEV_API_TOKEN": "${{ secrets.CLOUDFLARE_DEV_API_TOKEN }}",
        "CLOUDFLARE_DEV_ACCOUNT_ID": "${{ secrets.CLOUDFLARE_DEV_ACCOUNT_ID }}",
    }
    require(set(preflight) == {"name", "env", "run"} and preflight.get("env") == expected_dev_credentials and
            '.result.production_branch == "master"' in preflight.get("run", ""),
            "development preflight may use only dev credentials and must retain master as production branch")
    require(set(publish) == {"name", "env", "run"} and publish.get("env") == {
            "CLOUDFLARE_API_TOKEN": "${{ secrets.CLOUDFLARE_DEV_API_TOKEN }}",
            "CLOUDFLARE_ACCOUNT_ID": "${{ secrets.CLOUDFLARE_DEV_ACCOUNT_ID }}",
            "GH_TOKEN": "${{ github.token }}",
            "GITHUB_REPOSITORY": "${{ github.repository }}",
            "SOURCE_SHA": "${{ github.sha }}",
        } and
            "gh api" in publish.get("run", "") and "/commits/development" in publish.get("run", "") and
            "--project-name tropicaltrance-web" in publish.get("run", "") and
            "--branch development" in publish.get("run", "") and "--commit-hash \"$SOURCE_SHA\"" in publish.get("run", ""),
            "development deployment must use only dev credentials and the development preview branch")
    serialized = json.dumps(deploy)
    require("secrets.CLOUDFLARE_API_TOKEN" not in serialized and
            "secrets.CLOUDFLARE_ACCOUNT_ID" not in serialized and
            "cloudflare-production" not in serialized,
            "production credentials and environment must remain unavailable to dev deployment")


def cloudflare_development_negative_checks(valid):
    check_cloudflare_development_workflow(valid)
    mutations = {
        "master push trigger": lambda w: w["on"]["push"].update({"branches": ["master"]}),
        "extra automatic trigger": lambda w: w["on"].update({"pull_request": {"branches": ["development"]}}),
        "writable workflow permission": lambda w: w["permissions"].update({"contents": "write"}),
        "production environment": lambda w: w["jobs"]["deploy"].update({"environment": "cloudflare-production"}),
        "missing Access gate": lambda w: w["jobs"]["deploy"]["steps"][1]["env"].pop("CLOUDFLARE_DEV_ACCESS_READY"),
        "missing deployment enablement": lambda w: w["jobs"]["deploy"]["steps"][1]["env"].pop("CLOUDFLARE_DEVELOPMENT_DEPLOYMENT_ENABLED"),
        "production secret in dev": lambda w: w["jobs"]["deploy"]["steps"][5]["env"].update({"CLOUDFLARE_API_TOKEN": "${{ secrets.CLOUDFLARE_API_TOKEN }}"}),
        "wrong Cloudflare branch": lambda w: w["jobs"]["deploy"]["steps"][6].update({"run": "wrangler pages deploy dist --branch master"}),
        "missing output privacy checks": lambda w: w["jobs"]["build"]["steps"][10].update({"run": "npm run build"}),
    }
    for name, mutate in mutations.items():
        specimen = copy.deepcopy(valid)
        mutate(specimen)
        try:
            check_cloudflare_development_workflow(specimen)
        except (PolicyError, KeyError, AttributeError, TypeError):
            print("REJECTED development deployment negative case: " + name)
        else:
            raise PolicyError("development deployment negative case was incorrectly accepted: " + name)


def check_release_workflow(workflow):
    require(isinstance(workflow, dict) and
            set(workflow) == {"name", "on", "permissions", "concurrency", "jobs"},
            "unexpected release workflow shape")
    require(workflow["name"] == "Create GitHub Release", "release workflow name differs")
    require(workflow["on"] == {
        "workflow_run": {"workflows": ["Validate website"], "branches": ["master"], "types": ["completed"]},
        "workflow_dispatch": {"inputs": {
            "version_bump": {"description": "Semantic version increment", "required": True,
                              "type": "choice", "options": ["patch", "minor", "major"],
                              "default": "patch"},
            "confirmation": {"description": "Type CREATE_RELEASE to authorize an annotated tag and prerelease for this exact master commit",
                             "required": True, "type": "string"},
        }},
    }, "release trigger must be a completed Validate website run on master plus the manual recovery path")
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
            auth_steps[0]["name"] == "Authorize validated master release or manual recovery" and
            auth_steps[0]["env"] == {
                "EVENT_NAME": "${{ github.event_name }}",
                "GITHUB_REF": "${{ github.ref }}",
                "WORKFLOW_RUN_CONCLUSION": "${{ github.event.workflow_run.conclusion }}",
                "WORKFLOW_RUN_EVENT": "${{ github.event.workflow_run.event }}",
                "WORKFLOW_RUN_BRANCH": "${{ github.event.workflow_run.head_branch }}",
                "WORKFLOW_RUN_NAME": "${{ github.event.workflow_run.name }}",
                "SOURCE_SHA": "${{ github.event.workflow_run.head_sha || github.sha }}",
                "VERSION_BUMP": "${{ inputs.version_bump || 'patch' }}",
                "CONFIRMATION": "${{ inputs.confirmation }}",
            } and script_digest(auth_steps[0]["run"]) == RELEASE_SCRIPT_DIGESTS["authorize"],
            "authorization must accept only validated master pushes or explicitly confirmed master recovery")

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
        "name": "Check out the validated master commit",
        "uses": CHECKOUT,
        "with": {"ref": "${{ github.event.workflow_run.head_sha || github.sha }}", "fetch-depth": 0, "persist-credentials": False},
    }, "release source checkout must be pinned to the validated run SHA without persisted credentials")
    for step, key, name in ((source, "source", "Pin source commit and verify current master"),
                            (ci, "ci", "Require successful master validation for this commit"),
                            (version, "version", "Calculate version and reject an existing release for this commit")):
        expected_keys = {"name", "run", "env"}
        if key in {"source", "version"}:
            expected_keys.add("id")
        require(set(step) == expected_keys and
                step["name"] == name and script_digest(step["run"]) == RELEASE_SCRIPT_DIGESTS[key],
                "release prepare step differs from reviewed policy: " + name)
    check_gh_api_flag_compatibility(version["run"])
    require(source["id"] == "source" and source["env"] == {
        "SOURCE_SHA_INPUT": "${{ github.event.workflow_run.head_sha || github.sha }}"
    }, "source SHA must be pinned to the successful validation run or manual master dispatch")
    require(ci["env"] == {
        "GH_TOKEN": "${{ github.token }}",
        "GITHUB_REPOSITORY": "${{ github.repository }}",
        "SOURCE_SHA": "${{ steps.source.outputs.source_sha }}",
    }, "CI verification may use only a read-scoped token and pinned SHA")
    require(version["id"] == "version" and version["env"] == {
        "GH_TOKEN": "${{ github.token }}",
        "GITHUB_REPOSITORY": "${{ github.repository }}",
        "SOURCE_SHA": "${{ steps.source.outputs.source_sha }}",
        "VERSION_BUMP": "${{ inputs.version_bump || 'patch' }}",
    }, "version check may use only read-scoped token and the chosen/manual-or-default automatic patch bump")

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
    auth_script = valid["jobs"]["authorize"]["steps"][0]["run"]
    automatic = {
        "EVENT_NAME": "workflow_run",
        "GITHUB_REF": "refs/heads/master",
        "WORKFLOW_RUN_CONCLUSION": "success",
        "WORKFLOW_RUN_EVENT": "push",
        "WORKFLOW_RUN_BRANCH": "master",
        "WORKFLOW_RUN_NAME": "Validate website",
        "SOURCE_SHA": "a" * 40,
        "VERSION_BUMP": "patch",
        "CONFIRMATION": "",
    }
    manual = {
        **automatic,
        "EVENT_NAME": "workflow_dispatch",
        "GITHUB_REF": "refs/heads/master",
        "VERSION_BUMP": "minor",
        "CONFIRMATION": "CREATE_RELEASE",
    }
    for name, context in (("automatic validated master push", automatic),
                          ("confirmed manual recovery", manual)):
        result = subprocess.run(["/bin/bash", "-c", auth_script], env=context,
                                capture_output=True, text=True, check=False)
        require(result.returncode == 0,
                "release authorization rejected valid case: " + name + "; " + result.stderr)
        print("ACCEPTED release trigger positive case: " + name)
    for name, updates in (
        ("failed validation", {"WORKFLOW_RUN_CONCLUSION": "failure"}),
        ("development push", {"WORKFLOW_RUN_BRANCH": "development"}),
        ("pull request validation", {"WORKFLOW_RUN_EVENT": "pull_request"}),
        ("wrong validation workflow", {"WORKFLOW_RUN_NAME": "Unreviewed workflow"}),
        ("malformed source SHA", {"SOURCE_SHA": "not-a-commit"}),
        ("manual dispatch from development", {"EVENT_NAME": "workflow_dispatch", "GITHUB_REF": "refs/heads/development", "CONFIRMATION": "CREATE_RELEASE"}),
        ("manual dispatch without confirmation", {"EVENT_NAME": "workflow_dispatch", "CONFIRMATION": ""}),
        ("unsupported event", {"EVENT_NAME": "push"}),
    ):
        context = {**automatic, **updates}
        result = subprocess.run(["/bin/bash", "-c", auth_script], env=context,
                                capture_output=True, text=True, check=False)
        require(result.returncode != 0,
                "release authorization accepted forbidden case: " + name)
        print("REJECTED release trigger negative case: " + name)
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
        "unexpected direct push release trigger": lambda w: w["on"].update({"push": {"branches": ["master"]}}),
        "wrong upstream workflow": lambda w: w["on"]["workflow_run"].update({"workflows": ["Unreviewed workflow"]}),
        "wrong upstream branch": lambda w: w["on"]["workflow_run"].update({"branches": ["development"]}),
        "non-completion upstream activity": lambda w: w["on"]["workflow_run"].update({"types": ["requested"]}),
        "pull request upstream event": lambda w: w["on"].update({"pull_request": {"branches": ["master"]}}),
        "missing manual recovery": lambda w: w["on"].pop("workflow_dispatch"),
        "wrong default bump": lambda w: w["on"]["workflow_dispatch"]["inputs"]["version_bump"].update({"default": "major"}),
        "missing confirmation": lambda w: w["on"]["workflow_dispatch"]["inputs"].pop("confirmation"),
        "wrong ref authorization": lambda w: w["jobs"]["authorize"]["steps"][0].update({"run": "echo authorized"}),
        "accept failed validation run": lambda w: w["jobs"]["authorize"]["steps"][0].update({"run": w["jobs"]["authorize"]["steps"][0]["run"].replace("$WORKFLOW_RUN_CONCLUSION\" != 'success'", "$WORKFLOW_RUN_CONCLUSION\" = 'success'")}),
        "accept development validation run": lambda w: w["jobs"]["authorize"]["steps"][0].update({"run": w["jobs"]["authorize"]["steps"][0]["run"].replace("$WORKFLOW_RUN_BRANCH\" != 'master'", "$WORKFLOW_RUN_BRANCH\" = 'master'")}),
        "accept pull request validation run": lambda w: w["jobs"]["authorize"]["steps"][0].update({"run": w["jobs"]["authorize"]["steps"][0]["run"].replace("$WORKFLOW_RUN_EVENT\" != 'push'", "$WORKFLOW_RUN_EVENT\" = 'push'")}),
        "missing source ancestry check": lambda w: w["jobs"]["prepare"]["steps"][1].update({"run": "echo source"}),
        "release stale master commit": lambda w: w["jobs"]["prepare"]["steps"][1].update({"run": w["jobs"]["prepare"]["steps"][1]["run"].replace("if [ \"$SOURCE_SHA\" != \"$MASTER_SHA\" ]; then echo 'Refused: master advanced after validation; only its latest commit can be released automatically.' >&2; exit 1; fi\n", "")}),
        "missing CI verification": lambda w: w["jobs"]["prepare"]["steps"][2].update({"run": "true"}),
        "missing duplicate-release check": lambda w: w["jobs"]["prepare"]["steps"][3].update({"run": "echo version"}),
        "allow duplicate source tag": lambda w: w["jobs"]["prepare"]["steps"][3].update({"run": w["jobs"]["prepare"]["steps"][3]["run"].replace("if [ \"$tagged_commit\" = \"$SOURCE_SHA\" ]; then echo \"Refused: version tag $existing_tag already points to this source commit.\" >&2; exit 1; fi\n", "")}),
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
        "PR deployment job": lambda w: w["jobs"].update({"deploy": {"needs": "policy"}}),
        "pages write": lambda w: w["permissions"].update({"pages": "write"}),
        "OIDC write": lambda w: w["permissions"].update({"id-token": "write"}),
        "contents write": lambda w: w["permissions"].update({"contents": "write"}),
        "pull_request_target": lambda w: w["on"].update({"pull_request_target": {}}),
        "missing development PR validation": lambda w: w["on"]["pull_request"].update({"branches": ["master"]}),
        "unexpected validation PR branch": lambda w: w["on"]["pull_request"]["branches"].append("main"),
        "workflow_run": lambda w: w["on"].update({"workflow_run": {"workflows": ["release"]}}),
        "production environment": lambda w: w["jobs"]["policy"].update({"environment": "production"}),
        "deployment action": lambda w: w["jobs"]["policy"]["steps"][0].update({"uses": "actions/deploy-pages@v4"}),
        "Pages artifact": lambda w: w["jobs"]["policy"]["steps"][0].update({"uses": "actions/upload-pages-artifact@v3"}),
        "Cloudflare action": lambda w: w["jobs"]["policy"]["steps"][0].update({"uses": "cloudflare/wrangler-action@v3"}),
        "persisted credentials": lambda w: w["jobs"]["policy"]["steps"][0]["with"].update({"persist-credentials": True}),
        "production secret": lambda w: w["jobs"]["policy"].update({"env": {"TOKEN": "${{ secrets.PRODUCTION_TOKEN }}"}}),
        "reusable release workflow": lambda w: w["jobs"]["policy"].update({"uses": "./.github/workflows/release.yml"}),
        "nonexistent Astro command": lambda w: w["jobs"]["policy"]["steps"][5].update({"run": "npm run build"}),
        "dependency installation": lambda w: w["jobs"]["policy"]["steps"][5].update({"run": "npm ci"}),
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
    mutations = {
        "automatic push trigger": lambda w: w["on"].update({"push": {"branches": ["master"]}}),
        "automatic PR trigger": lambda w: w["on"].update({"pull_request": {}}),
        "legacy public publication input": lambda w: w["on"]["workflow_dispatch"]["inputs"].update({
            "publication_approved": {"description": "Approve public publishing", "required": True,
                                     "type": "boolean", "default": False}}),
        "redundant deployment confirmation": lambda w: w["on"]["workflow_dispatch"]["inputs"].update({
            "confirmation": {"description": "Type DEPLOY_TO_PAGES", "required": True, "type": "string"}}),
        "writable workflow token": lambda w: w["permissions"].update({"contents": "write"}),
        "missing release tag input": lambda w: w["on"]["workflow_dispatch"]["inputs"].pop("release_tag"),
        "missing branch restriction": lambda w: w["jobs"]["build"].update({"if": "always()"}),
        "missing Access confirmation": lambda w: w["on"]["workflow_dispatch"]["inputs"].pop("access_protection_verified"),
        "missing private deployment approval": lambda w: w["on"]["workflow_dispatch"]["inputs"].pop("private_deployment_approved"),
        "unprotected build ref": lambda w: w["jobs"]["build"].update({"if": "always()"}),
        "production secret in build": lambda w: w["jobs"]["build"].update({"env": {"TOKEN": "${{ secrets.CLOUDFLARE_API_TOKEN }}"}}),
        "missing protected environment": lambda w: w["jobs"]["deploy"].pop("environment"),
        "project creation": lambda w: w["jobs"]["deploy"]["steps"].append({"run": "wrangler pages project create bad"}),
        "deployment current head": lambda w: w["jobs"]["deploy"]["steps"][-1].update({"run": "wrangler pages deploy dist --branch master --commit-hash $GITHUB_SHA"}),
        "checkout after artifact download": lambda w: w["jobs"]["deploy"]["steps"].__setitem__(slice(0, 2), reversed(w["jobs"]["deploy"]["steps"][:2])),
        "Cloudflare credentials in build": lambda w: w["jobs"]["build"]["steps"][0].update({"env": {"TOKEN": "${{ secrets.CLOUDFLARE_API_TOKEN }}"}}),
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
    require([p.name for p in active] == ["create-release.yml", "deploy-cloudflare-development.yml", "deploy-cloudflare.yml", "validate.yml"],
            "only the reviewed validation, release, development deploy, and production deploy workflows are allowed")
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
