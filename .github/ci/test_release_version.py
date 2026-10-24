"""Unit tests for strict release version calculations."""

import unittest

from release_version import latest_version, next_version, parse_version_tag


class ReleaseVersionTests(unittest.TestCase):
    def test_baseline_and_each_bump(self):
        self.assertEqual(next_version([], "patch"), "v0.1.1")
        self.assertEqual(next_version(["v0.1.0"], "minor"), "v0.2.0")
        self.assertEqual(next_version(["v0.1.0"], "major"), "v1.0.0")

    def test_uses_highest_existing_tag(self):
        tags = ["v0.1.0", "v2.4.8", "v1.9.99", "notes"]
        self.assertEqual(latest_version(tags), (2, 4, 8))
        self.assertEqual(next_version(tags, "patch"), "v2.4.9")

    def test_rejects_leading_zero_and_non_semver_v_tags(self):
        for tag in ("v01.2.3", "v1.02.3", "v1.2.03", "v1.2", "v1.2.3-rc.1", "V1.2.3"):
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                parse_version_tag(tag) if tag.startswith("v") else latest_version([tag])

    def test_rejects_duplicate_and_conflicting_entries(self):
        with self.assertRaisesRegex(ValueError, "duplicate tag entry"):
            latest_version(["v1.2.3", "v1.2.3"])
        with self.assertRaises(ValueError):
            latest_version(["v1.2.3", "v01.2.3"])

    def test_rejects_unknown_bump(self):
        with self.assertRaisesRegex(ValueError, "version bump"):
            next_version([], "release")


if __name__ == "__main__":
    unittest.main()
