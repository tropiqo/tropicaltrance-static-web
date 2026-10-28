"""Fail-closed validation helpers for release-driven Cloudflare Pages deployments."""

import json
import os
import re
import subprocess
import urllib.error
import urllib.request

TAG = re.compile(r"^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
SHA = re.compile(r"^[0-9a-f]{40}$")


class ReleaseError(ValueError):
    pass


def validate_tag(tag):
    if not isinstance(tag, str) or not TAG.fullmatch(tag):
        raise ReleaseError("release tag must be canonical vMAJOR.MINOR.PATCH")
    return tag


def validate_release(tag, release):
    validate_tag(tag)
    if not isinstance(release, dict) or release.get("tag_name") != tag:
        raise ReleaseError("GitHub Release tag_name does not match requested tag")
    if release.get("draft") is not False or not release.get("published_at"):
        raise ReleaseError("release must be published and not a draft")
    if not isinstance(release.get("id"), int) or not release.get("html_url"):
        raise ReleaseError("release metadata is incomplete")
    return release


def resolve_tag_object(ref, get_object):
    """Peel GitHub git-ref objects safely. get_object(type, sha) returns API JSON."""
    if not isinstance(ref, dict) or ref.get("ref", "").startswith("refs/tags/") is False:
        raise ReleaseError("GitHub tag ref is missing or malformed")
    obj = ref.get("object")
    seen = set()
    for _ in range(16):
        if not isinstance(obj, dict) or obj.get("type") not in {"commit", "tag"}:
            raise ReleaseError("tag points to an unsupported Git object")
        sha, kind = obj.get("sha"), obj.get("type")
        if not isinstance(sha, str) or not SHA.fullmatch(sha) or sha in seen:
            raise ReleaseError("invalid or cyclic tag object")
        seen.add(sha)
        if kind == "commit":
            return sha
        tag_obj = get_object("tags", sha)
        if not isinstance(tag_obj, dict) or tag_obj.get("object", {}).get("type") not in {"commit", "tag"}:
            raise ReleaseError("annotated tag object is malformed")
        obj = tag_obj["object"]
    raise ReleaseError("annotated tag nesting exceeds safety limit")


def validate_selected_release(tag, release, ref, get_object, is_master_ancestor):
    validate_release(tag, release)
    source = resolve_tag_object(ref, get_object)
    if not is_master_ancestor(source):
        raise ReleaseError("release commit is not in protected master history")
    return source


def require_source_sha(*shas):
    if not shas or any(not isinstance(sha, str) or not SHA.fullmatch(sha) for sha in shas):
        raise ReleaseError("source SHA must be a full lowercase commit SHA")
    if len(set(shas)) != 1:
        raise ReleaseError("authorization, build, and deployment source SHAs differ")
    return shas[0]


def require_stable_reference(source_sha, tag_object_sha, release_id,
                             expected_source_sha="", expected_tag_object_sha="", expected_release_id=""):
    require_source_sha(source_sha)
    if expected_source_sha and source_sha != expected_source_sha:
        raise ReleaseError("release tag moved or source SHA differs from authorization")
    if expected_tag_object_sha and tag_object_sha != expected_tag_object_sha:
        raise ReleaseError("Git tag reference object changed after authorization")
    if expected_release_id and str(release_id) != expected_release_id:
        raise ReleaseError("GitHub Release identity changed after authorization")


def github_get(endpoint, token):
    request = urllib.request.Request("https://api.github.com/" + endpoint,
        headers={"Accept": "application/vnd.github+json", "Authorization": "Bearer " + token,
                 "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "tropicaltrance-release-deploy"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)
    except (urllib.error.URLError, json.JSONDecodeError) as exc:
        raise ReleaseError("GitHub API request failed") from exc


def run_validation():
    tag = os.environ.get("RELEASE_TAG", "")
    ref = os.environ.get("GITHUB_REF", "")
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    if ref != "refs/heads/master" or not token or not re.fullmatch(r"[^/]+/[^/]+", repo):
        raise ReleaseError("run must use master and have read-only GitHub API context")
    release = github_get("repos/" + repo + "/releases/tags/" + validate_tag(tag), token)
    tag_ref = github_get("repos/" + repo + "/git/ref/tags/" + tag, token)
    source = validate_selected_release(tag, release, tag_ref,
        lambda kind, sha: github_get("repos/" + repo + "/git/" + kind + "/" + sha, token),
        lambda sha: subprocess.run(["git", "merge-base", "--is-ancestor", sha, "refs/remotes/origin/master"],
                                   check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0)
    local = subprocess.check_output(["git", "rev-parse", "--verify", "refs/tags/" + tag + "^{commit}"], text=True).strip()
    if source != local:
        raise ReleaseError("GitHub API tag resolution differs from fetched Git tag")
    tag_object_sha = tag_ref.get("object", {}).get("sha")
    if not isinstance(tag_object_sha, str) or not SHA.fullmatch(tag_object_sha):
        raise ReleaseError("GitHub tag reference object SHA is invalid")
    require_stable_reference(source, tag_object_sha, release.get("id"),
                             os.environ.get("EXPECTED_SOURCE_SHA", ""),
                             os.environ.get("EXPECTED_TAG_OBJECT_SHA", ""),
                             os.environ.get("EXPECTED_RELEASE_ID", ""))
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as stream:
            stream.write("source_sha=" + source + "\nrelease_id=" + str(release["id"]) +
                         "\nrelease_url=" + release["html_url"] + "\ntag_object_sha=" + tag_object_sha + "\n")
    print("Validated release " + tag + " at " + source)


if __name__ == "__main__":
    try:
        run_validation()
    except (ReleaseError, OSError, subprocess.CalledProcessError) as exc:
        raise SystemExit("Release deployment refused: " + str(exc))
