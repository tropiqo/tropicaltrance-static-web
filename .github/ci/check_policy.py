"""Slice 2 local CI policy. Only approved locked installs and static checks; no deployment.

Active workflows must use the JSON subset of YAML so Python's standard-library
parser can validate them without installing a YAML package. This is a bounded
allowlist for the current slice, not a general GitHub Actions security analyser.
Future build jobs or actions require explicit review of this policy.
"""

import argparse
import copy
import json
from pathlib import Path

CHECKOUT = "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803"
COMMAND = "python3 -B .github/ci/check_policy.py --self-test"


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
    require(type(job["timeout-minutes"]) is int and job["timeout-minutes"] == 5,
            "policy job timeout must be five minutes")
    steps = job["steps"]
    require(isinstance(steps, list) and len(steps) == 5,
            "exactly reviewed checkout, policy, runtime, locked install and static checks are allowed")
    checkout, check, setup, install, build = steps
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
    require(setup["uses"] == "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38", "runtime action must match reviewed SHA")
    require(setup["with"] == {"node-version": "24.21.0", "package-manager-cache": False}, "runtime version/cache differs")
    require(set(install) == {"name", "run"} and install["run"] == "npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org", "only reviewed locked official-registry install allowed")
    require(set(build) == {"name", "run"} and build["run"] == "npm run build && npm test", "only static build/tests allowed")
    require(isinstance(checkout["name"], str) and isinstance(check["name"], str),
            "step names must be text")


def unique_object(pairs):
    obj = {}
    for key, value in pairs:
        require(key not in obj, "duplicate workflow key")
        obj[key] = value
    return obj


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
        "nonexistent Astro command": lambda w: w["jobs"]["policy"]["steps"][1].update({"run": "npm run build"}),
        "dependency installation": lambda w: w["jobs"]["policy"]["steps"][1].update({"run": "npm ci"}),
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    directory = root / ".github/workflows"
    require(not directory.is_symlink(), "workflow directory must not be a symlink")
    active = sorted(p for p in directory.iterdir() if p.suffix.lower() in {".yml", ".yaml"})
    require([p.name for p in active] == ["validate.yml"],
            "only validate.yml may be active in this slice; additional workflows need review")
    workflow = load_workflow(active[0])
    check_workflow(workflow)
    require((root / ".github/ci/check_policy.py").is_file(), "policy command file is missing")
    require((root / "docs/migration/astro-foundation-baseline.md").is_file(), "baseline document is missing")
    package = json.loads((root / "package.json").read_text())
    require(all(k in package["scripts"] for k in ["build", "test"]), "referenced npm scripts must exist")
    require((root / "package-lock.json").is_file(), "locked install requires lockfile")
    if args.self_test:
        negative_checks(workflow)
    print("LOCAL CI ISOLATION: PASS (bounded source policy; remote controls unverified)")


if __name__ == "__main__":
    try:
        main()
    except (PolicyError, OSError) as exc:
        raise SystemExit("LOCAL CI ISOLATION: FAIL: " + str(exc))
