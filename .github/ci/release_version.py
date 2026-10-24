"""Strict semantic-version tag parsing and next-version calculation."""

import argparse
import re
from pathlib import Path

TAG_PATTERN = re.compile(r"^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
BASELINE = (0, 1, 0)


def parse_version_tag(tag):
    match = TAG_PATTERN.fullmatch(tag)
    if not match:
        raise ValueError(f"malformed version tag: {tag!r}")
    return tuple(int(part) for part in match.groups())


def latest_version(tags):
    seen_names = set()
    seen_versions = {}
    latest = BASELINE
    for tag in tags:
        if tag in seen_names:
            raise ValueError(f"duplicate tag entry: {tag}")
        seen_names.add(tag)
        if not tag.casefold().startswith("v"):
            continue
        version = parse_version_tag(tag)
        if version in seen_versions:
            raise ValueError(
                f"conflicting tags {seen_versions[version]!r} and {tag!r} resolve to one version"
            )
        seen_versions[version] = tag
        latest = max(latest, version)
    return latest


def next_version(tags, bump):
    current = latest_version(tags)
    major, minor, patch = current
    if bump == "patch":
        following = (major, minor, patch + 1)
    elif bump == "minor":
        following = (major, minor + 1, 0)
    elif bump == "major":
        following = (major + 1, 0, 0)
    else:
        raise ValueError("version bump must be patch, minor, or major")
    return "v{}.{}.{}".format(*following)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bump", choices=("patch", "minor", "major"), required=True)
    parser.add_argument("--tags-file", type=Path, required=True)
    args = parser.parse_args()
    try:
        tags = args.tags_file.read_text(encoding="utf-8").splitlines()
        print(next_version(tags, args.bump))
    except (OSError, ValueError) as error:
        raise SystemExit(f"Release version calculation refused: {error}") from error


if __name__ == "__main__":
    main()
