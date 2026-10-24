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
from pathlib import Path

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
VALIDATION_STEPS = [
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
    require(workflow["on"] == {"pull_request": {"branches": ["master"]}},
            "only nonprivileged pull_request to master is allowed")
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
    require([p.name for p in active] == ["deploy-cloudflare.yml", "validate.yml"],
            "only the reviewed validation and manual Cloudflare deployment workflows are allowed")
    workflows = {path.name: load_workflow(path) for path in active}
    workflow = workflows["validate.yml"]
    check_workflow(workflow)
    cloudflare = workflows["deploy-cloudflare.yml"]
    check_cloudflare_workflow(cloudflare)
    require((root / ".github/ci/check_policy.py").is_file(), "policy command file is missing")
    require((root / "docs/migration/astro-foundation-baseline.md").is_file(), "baseline document is missing")
    package = json.loads((root / "package.json").read_text())
    require(all(k in package["scripts"] for k in ["validate", "verify:reproducible", "test:e2e"]), "referenced npm scripts must exist")
    require((root / "package-lock.json").is_file(), "locked install requires lockfile")
    if args.self_test:
        negative_checks(workflow)
        cloudflare_negative_checks(cloudflare)
    print("LOCAL CI ISOLATION: PASS (bounded source policy; remote controls unverified)")


if __name__ == "__main__":
    try:
        main()
    except (PolicyError, OSError) as exc:
        raise SystemExit("LOCAL CI ISOLATION: FAIL: " + str(exc))
