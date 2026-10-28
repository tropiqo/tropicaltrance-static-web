import unittest

from release_deployment import (ReleaseError, require_source_sha, require_stable_reference, resolve_tag_object,
                                validate_release, validate_selected_release, validate_tag)


class ReleaseDeploymentTests(unittest.TestCase):
    sha = "a" * 40
    release = {"id": 7, "tag_name": "v1.2.3", "draft": False,
               "published_at": "2026-01-01T00:00:00Z", "html_url": "https://example.invalid/release"}

    def test_canonical_tags(self):
        for tag in ("v0.0.0", "v1.2.3", "v10.20.30"):
            self.assertEqual(validate_tag(tag), tag)
        for tag in ("1.2.3", "v01.2.3", "v1.02.3", "v1.2.03", "v1.2", "v1.2.3-rc.1", ""):
            with self.subTest(tag=tag), self.assertRaises(ReleaseError):
                validate_tag(tag)

    def test_published_matching_release_required(self):
        validate_release("v1.2.3", self.release)
        for changes in ({"draft": True}, {"published_at": None}, {"tag_name": "v1.2.4"}):
            with self.subTest(changes=changes), self.assertRaises(ReleaseError):
                validate_release("v1.2.3", {**self.release, **changes})

    def test_lightweight_and_annotated_tags_resolve(self):
        self.assertEqual(resolve_tag_object({"ref": "refs/tags/v1.2.3", "object": {"type": "commit", "sha": self.sha}}, lambda *_: None), self.sha)
        tag_sha = "b" * 40
        self.assertEqual(resolve_tag_object({"ref": "refs/tags/v1.2.3", "object": {"type": "tag", "sha": tag_sha}}, lambda kind, sha: {"object": {"type": "commit", "sha": self.sha}}), self.sha)

    def test_master_ancestry_and_tag_movement_fail_closed(self):
        ref = {"ref": "refs/tags/v1.2.3", "object": {"type": "commit", "sha": self.sha}}
        self.assertEqual(validate_selected_release("v1.2.3", self.release, ref, lambda *_: None, lambda sha: sha == self.sha), self.sha)
        with self.assertRaises(ReleaseError):
            validate_selected_release("v1.2.3", self.release, ref, lambda *_: None, lambda _: False)
        with self.assertRaises(ReleaseError):
            require_source_sha(self.sha, "c" * 40, self.sha)

    def test_source_sha_is_pinned_across_jobs(self):
        self.assertEqual(require_source_sha(self.sha, self.sha, self.sha), self.sha)

    def test_release_ref_and_identity_cannot_change_between_jobs(self):
        require_stable_reference(self.sha, "b" * 40, 7, self.sha, "b" * 40, "7")
        for values in (("c" * 40, "b" * 40, 7), (self.sha, "c" * 40, 7), (self.sha, "b" * 40, 8)):
            with self.subTest(values=values), self.assertRaises(ReleaseError):
                require_stable_reference(*values, self.sha, "b" * 40, "7")


if __name__ == "__main__":
    unittest.main()
