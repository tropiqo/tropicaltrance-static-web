#!/usr/bin/env python3
"""Build or offline-test the credential-free Docker isolation prototype."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[2]
DOCKER_DIR = Path(__file__).resolve().parent / "docker"
IMAGE = "tropical-trance-safe-codex:016b"


def docker_binary() -> str:
    binary = shutil.which("docker")
    if binary is None:
        raise RuntimeError("Docker CLI is unavailable; refusing any fallback")
    return binary


def build() -> int:
    argv = [docker_binary(), "build", "--tag", IMAGE, str(DOCKER_DIR)]
    return subprocess.run(argv, check=False).returncode


def run_offline_test() -> int:
    binary = docker_binary()
    image_check = subprocess.run(
        [binary, "image", "inspect", IMAGE],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if image_check.returncode != 0:
        detail = image_check.stderr.strip()
        if "No such image" in detail or "not known" in detail:
            raise RuntimeError(f"image {IMAGE} is not present; run the separate build command first")
        raise RuntimeError(f"Docker image inspection failed; refusing to run: {detail or 'engine unavailable'}")

    with tempfile.TemporaryDirectory(prefix="tt-codex-disposable-") as temp_root:
        root = Path(temp_root)
        workspace = root / "workspace"
        workspace.mkdir(mode=0o777)
        root.chmod(0o755)
        workspace.chmod(0o777)
        (workspace / "fixture.txt").write_text("synthetic disposable fixture\n", encoding="utf-8")

        argv = [
            binary,
            "run",
            "--rm",
            "--name",
            f"tt-safe-codex-test-{os.getpid()}",
            "--network",
            "none",
            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges:true",
            "--user",
            "10001:10001",
            "--pids-limit",
            "64",
            "--memory",
            "384m",
            "--cpus",
            "1",
            "--mount",
            f"type=bind,src={workspace},dst=/workspace",
            "--workdir",
            "/workspace",
            IMAGE,
        ]
        completed = subprocess.run(argv, check=False, capture_output=True, text=True)
        if completed.stdout:
            print(completed.stdout, end="")
        if completed.stderr:
            print(completed.stderr, end="", file=sys.stderr)
        if completed.returncode != 0:
            return completed.returncode

        try:
            result = json.loads(completed.stdout.strip().splitlines()[-1])
        except (IndexError, json.JSONDecodeError) as exc:
            raise RuntimeError("offline probe returned no valid result; no retry was attempted") from exc
        host_marker = workspace / "container-write-check.txt"
        if not host_marker.is_file():
            raise RuntimeError("container write did not appear in disposable workspace")
        if result.get("uid") != 10001:
            raise RuntimeError("container UID did not match the configured non-root user")
        return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("build", "test"))
    args = parser.parse_args(argv)
    try:
        return build() if args.action == "build" else run_offline_test()
    except (OSError, RuntimeError) as exc:
        print(f"docker-runtime: refused: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
