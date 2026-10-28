"""Snapshot and verify one Cloudflare Pages deployment without repeating uploads."""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RETRY_DELAYS = (2, 4, 8, 12, 15, 15, 15)
SNAPSHOT_PATH = Path("deployment-snapshot.json")


class MetadataVerificationError(RuntimeError):
    pass


def parse_time(value):
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def deployment_marker(deployment):
    trigger = deployment.get("deployment_trigger") or {}
    metadata = trigger.get("metadata") or {}
    return metadata


def identify_new_deployments(deployments, known_ids, started_at, commit_message,
                             source_sha, branch="master"):
    """Return a successful new matching deploy, or raise on conflicting run identity."""
    started = parse_time(started_at)
    if started is None:
        raise MetadataVerificationError("upload start time is invalid")
    identified = []
    for deployment in deployments:
        if not isinstance(deployment, dict):
            continue
        deployment_id = deployment.get("id")
        if not isinstance(deployment_id, str) or not deployment_id or deployment_id in known_ids:
            continue
        created = parse_time(deployment.get("created_on"))
        metadata = deployment_marker(deployment)
        if created is None or created < started or metadata.get("commit_message") != commit_message:
            continue
        identified.append(deployment)

    if not identified:
        return None
    if len(identified) > 1:
        raise MetadataVerificationError("multiple new deployments carry this workflow run's unique commit message")
    deployment = identified[0]
    metadata = deployment_marker(deployment)
    if deployment.get("environment") != "production":
        raise MetadataVerificationError("new deployment is not a production deployment")
    if metadata.get("branch") != branch:
        raise MetadataVerificationError("new deployment branch does not match the protected production branch")
    if metadata.get("commit_hash") != source_sha:
        raise MetadataVerificationError("new deployment source SHA does not match the selected release")
    status = (deployment.get("latest_stage") or {}).get("status")
    if status in {"failure", "failed", "canceled", "cancelled"}:
        raise MetadataVerificationError("Cloudflare reports the new deployment failed: " + str(status))
    if status != "success":
        return None
    url = deployment.get("url")
    if not isinstance(url, str) or not url:
        raise MetadataVerificationError("successful deployment has no URL")
    return {"id": deployment["id"], "url": url, "created_on": deployment["created_on"],
            "source_sha": source_sha, "branch": branch}


def wait_for_deployment(fetch_deployments, known_ids, started_at, commit_message,
                        source_sha, branch="master", sleep=time.sleep):
    """Poll with bounded backoff. This function only reads metadata; it never uploads."""
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            deployments = fetch_deployments()
        except Exception as exc:
            if attempt == len(RETRY_DELAYS):
                raise MetadataVerificationError("Cloudflare metadata lookup timed out after upload") from exc
            sleep(RETRY_DELAYS[attempt])
            continue
        result = identify_new_deployments(deployments, known_ids, started_at,
                                          commit_message, source_sha, branch)
        if result:
            return result
        if attempt < len(RETRY_DELAYS):
            sleep(RETRY_DELAYS[attempt])
    raise MetadataVerificationError("Cloudflare upload succeeded, but its deployment metadata did not become verifiable before timeout")


def cloudflare_request(page):
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    project = os.environ.get("CLOUDFLARE_PAGES_PROJECT", "")
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    if len(account) != 32 or not project or not token:
        raise MetadataVerificationError("Cloudflare API credentials or project configuration are missing")
    query = urllib.parse.urlencode({"per_page": 100, "page": page})
    url = ("https://api.cloudflare.com/client/v4/accounts/" + account + "/pages/projects/" +
           urllib.parse.quote(project, safe="") + "/deployments?" + query)
    request = urllib.request.Request(url, headers={"Authorization": "Bearer " + token,
        "Accept": "application/json", "User-Agent": "tropicaltrance-deployment-verifier"})
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.load(response)
    if not isinstance(payload, dict) or payload.get("success") is not True or not isinstance(payload.get("result"), list):
        raise MetadataVerificationError("Cloudflare returned an invalid deployments response")
    return payload


def list_deployments(max_pages=10, require_complete=False):
    deployments = []
    page = 1
    while page <= max_pages:
        payload = cloudflare_request(page)
        result = payload["result"]
        deployments.extend(result)
        info = payload.get("result_info") or {}
        total_pages = info.get("total_pages")
        if isinstance(total_pages, int):
            if page >= total_pages:
                return deployments
            if page >= max_pages and not require_complete:
                return deployments
        elif len(result) < 100:
            return deployments
        page += 1
    if require_complete:
        raise MetadataVerificationError("deployment snapshot exceeded the bounded API page limit")
    return deployments


def snapshot():
    deployments = list_deployments(max_pages=10, require_complete=True)
    ids = sorted({item["id"] for item in deployments if isinstance(item, dict) and isinstance(item.get("id"), str)})
    SNAPSHOT_PATH.write_text(json.dumps({"captured_at": datetime.now(timezone.utc).isoformat(),
                                         "deployment_ids": ids}, indent=2) + "\n", encoding="utf-8")
    print("Recorded pre-upload Cloudflare deployment IDs: " + str(len(ids)))


def verify():
    try:
        snapshot_data = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise MetadataVerificationError("pre-upload deployment snapshot is unavailable") from exc
    known_ids = set(snapshot_data.get("deployment_ids", []))
    started_at = os.environ.get("UPLOAD_STARTED_AT", "")
    source_sha = os.environ.get("SOURCE_SHA", "")
    commit_message = os.environ.get("DEPLOYMENT_COMMIT_MESSAGE", "")
    if not source_sha or not commit_message:
        raise MetadataVerificationError("selected source SHA or unique deployment identity is missing")
    deployment = wait_for_deployment(lambda: list_deployments(max_pages=3), known_ids, started_at,
                                     commit_message, source_sha, "master")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write("Cloudflare deployment ID: " + deployment["id"] + "\n")
            stream.write("Cloudflare deployment URL: " + deployment["url"] + "\n")
            stream.write("Cloudflare deployment created: " + deployment["created_on"] + "\n")
    print("Cloudflare metadata verification succeeded for deployment " + deployment["id"])


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2 or sys.argv[1] not in {"snapshot", "verify"}:
            raise MetadataVerificationError("usage: cloudflare_deployment.py snapshot|verify")
        snapshot() if sys.argv[1] == "snapshot" else verify()
    except (MetadataVerificationError, OSError) as exc:
        raise SystemExit("Cloudflare metadata verification failed: " + str(exc))
