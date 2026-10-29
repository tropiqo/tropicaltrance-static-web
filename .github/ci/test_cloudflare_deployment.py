import json
import os
import unittest
from io import BytesIO
from unittest.mock import patch
from urllib.error import HTTPError

from cloudflare_deployment import (MetadataVerificationError, RETRY_DELAYS,
                                   cloudflare_request, identify_new_deployments,
                                   wait_for_deployment)


class CloudflareDeploymentMetadataTests(unittest.TestCase):
    now = "2026-10-27T12:00:00Z"
    source = "a" * 40
    message = "v1.2.3 (GitHub release 12; workflow run 345)"

    def deployment(self, **changes):
        value = {"id": "fresh-id", "url": "https://fresh.example.pages.dev",
                 "created_on": "2026-10-27T12:00:03Z", "environment": "production",
                 "deployment_trigger": {"metadata": {"branch": "master", "commit_hash": self.source,
                                                        "commit_message": self.message}},
                 "latest_stage": {"status": "success"}}
        value.update(changes)
        return value

    def test_delayed_visibility_succeeds_without_another_upload(self):
        replies = [[], [], [self.deployment()]]
        sleeps = []
        result = wait_for_deployment(lambda: replies.pop(0), {"old"}, self.now,
                                     self.message, self.source, sleep=sleeps.append)
        self.assertEqual(result["id"], "fresh-id")
        self.assertEqual(sleeps, [2, 4])

    def test_mismatched_source_sha_is_rejected(self):
        bad = self.deployment()
        bad["deployment_trigger"]["metadata"]["commit_hash"] = "b" * 40
        with self.assertRaisesRegex(MetadataVerificationError, "source SHA"):
            identify_new_deployments([bad], set(), self.now, self.message, self.source)

    def test_stale_same_commit_deployment_is_not_selected(self):
        old = self.deployment(id="old", created_on="2026-10-27T11:59:59Z")
        with self.assertRaisesRegex(MetadataVerificationError, "timeout"):
            wait_for_deployment(lambda: [old], set(), self.now, self.message,
                                self.source, sleep=lambda _: None)

    def test_preexisting_id_is_never_selected_even_if_other_fields_match(self):
        old = self.deployment()
        self.assertIsNone(identify_new_deployments([old], {"fresh-id"}, self.now,
                                                   self.message, self.source))

    def test_timeout_is_bounded_and_does_not_retry_upload(self):
        sleeps = []
        with self.assertRaisesRegex(MetadataVerificationError, "did not become verifiable"):
            wait_for_deployment(lambda: [], set(), self.now, self.message,
                                self.source, sleep=sleeps.append)
        self.assertEqual(sleeps, list(RETRY_DELAYS))

    def test_cloudflare_http_errors_show_api_reason_without_credentials(self):
        token = "secret-cloudflare-token"
        error_body = json.dumps({"success": False, "errors": [
            {"code": 10042, "message": "Invalid deployment list parameter"}
        ]}).encode("utf-8")
        error = HTTPError("https://api.cloudflare.com/", 400, "Bad Request", {}, BytesIO(error_body))
        environment = {
            "CLOUDFLARE_ACCOUNT_ID": "a" * 32,
            "CLOUDFLARE_PAGES_PROJECT": "tropicaltrance-web",
            "CLOUDFLARE_API_TOKEN": token,
        }
        with patch.dict(os.environ, environment, clear=False), \
                patch("urllib.request.urlopen", side_effect=error):
            with self.assertRaisesRegex(MetadataVerificationError,
                                        "HTTP 400: 10042: Invalid deployment list parameter") as raised:
                cloudflare_request(1)
        self.assertNotIn(token, str(raised.exception))

    def test_only_exact_branch_and_run_message_match(self):
        wrong_branch = self.deployment()
        wrong_branch["deployment_trigger"]["metadata"]["branch"] = "preview"
        with self.assertRaisesRegex(MetadataVerificationError, "branch"):
            identify_new_deployments([wrong_branch], set(), self.now, self.message, self.source)


if __name__ == "__main__":
    unittest.main()
