#!/usr/bin/env python3
"""Launch Codex with a fixed native sandbox for one allowlisted repository."""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[3]
REPOSITORIES = {
    "website": ROOT / "tropicaltrance-static-web",
    "studio": ROOT / "tropical-trance-studio",
}
SANDBOXES = {"inspect": "read-only", "develop": "workspace-write"}


def resolve_repository(name: str) -> Path:
    candidate = REPOSITORIES.get(name)
    if candidate is None or not candidate.is_dir():
        raise ValueError("repository must be one of the existing allowlisted repositories")
    resolved = candidate.resolve(strict=True)
    if resolved != candidate or not (resolved / ".git").exists():
        raise ValueError("repository path changed or is not a Git checkout; refusing to launch")
    top_level = subprocess.run(
        ["git", "-C", str(resolved), "rev-parse", "--show-toplevel"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if Path(top_level).resolve() != resolved:
        raise ValueError("repository root does not match the exact allowlisted path")
    git_common_dir = subprocess.run(
        ["git", "-C", str(resolved), "rev-parse", "--git-common-dir"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    common_path = Path(git_common_dir)
    if not common_path.is_absolute():
        common_path = resolved / common_path
    common_path = common_path.resolve(strict=True)
    if not common_path.is_relative_to(resolved):
        raise ValueError("Git metadata resolves outside the allowlisted repository")
    return resolved


def resolve_codex_binary() -> str:
    found = shutil.which("codex")
    if not found:
        raise FileNotFoundError("Codex CLI is not on PATH")
    executable = Path(found).resolve(strict=True)
    if not executable.is_file() or not os.access(executable, os.X_OK):
        raise ValueError("Codex CLI path is not an executable file")
    if executable.is_relative_to(ROOT):
        raise ValueError("Codex CLI executable must not come from the project workspace")
    return str(executable)


def sanitized_environment(source: dict[str, str]) -> dict[str, str]:
    env = source.copy()
    for key in list(env):
        upper_key = key.upper()
        if (
            upper_key.startswith(("GH_", "GITHUB_", "GIT_"))
            or "TOKEN" in upper_key
            or "SECRET" in upper_key
            or "API_KEY" in upper_key
            or upper_key in {"SSH_AUTH_SOCK", "SSH_AGENT_PID"}
        ):
            env.pop(key, None)
    return env


def command_for(
    mode: str,
    repository: str,
    codex: str = "codex",
    gh_config_dir: str = "/nonexistent/safe-codex-gh-config",
) -> list[str]:
    if mode not in SANDBOXES:
        raise ValueError("mode must be 'inspect' or 'develop'; github-write is disabled")
    root = resolve_repository(repository)
    command = [
        codex,
        "--strict-config",
        "--no-daemon",
        "--cd",
        str(root),
        "--sandbox",
        SANDBOXES[mode],
        "--ask-for-approval",
        "never",
        "-c",
        "sandbox_workspace_write.network_access=false",
        "-c",
        "sandbox_workspace_write.writable_roots=[]",
        "-c",
        "sandbox_workspace_write.exclude_slash_tmp=true",
        "-c",
        "sandbox_workspace_write.exclude_tmpdir_env_var=true",
        "-c",
        'shell_environment_policy.inherit="core"',
        "-c",
        "shell_environment_policy.ignore_default_excludes=false",
        "-c",
        'shell_environment_policy.filters={"GH_*"="exclude","GITHUB_*"="exclude","GIT_*"="exclude","SSH_AUTH_SOCK"="exclude","SSH_AGENT_PID"="exclude","*TOKEN*"="exclude","*SECRET*"="exclude","*API_KEY*"="exclude"}',
        "-c",
        'shell_environment_policy.set={"GIT_CONFIG_COUNT"="1","GIT_CONFIG_KEY_0"="credential.helper","GIT_CONFIG_VALUE_0"="","GH_CONFIG_DIR"='
        + json.dumps(gh_config_dir)
        + "}",
        "-c",
        "mcp_servers={}",
        "-c",
        "plugins={}",
        "-c",
        "tools.web_search=false",
    ]
    return command


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 2:
        print("usage: safe_codex.py <inspect|develop> <website|studio>", file=sys.stderr)
        return 2
    try:
        repository_root = resolve_repository(args[1])
        if args[0] not in SANDBOXES:
            raise ValueError("mode must be 'inspect' or 'develop'; github-write is disabled")
        codex_binary = resolve_codex_binary()
    except (ValueError, subprocess.SubprocessError, OSError) as exc:
        print(f"safe-codex: refused: {exc}", file=sys.stderr)
        return 2

    # Filter GitHub, Git, SSH and secret selectors from the Codex parent too.
    env = sanitized_environment(dict(os.environ))
    try:
        with tempfile.TemporaryDirectory(prefix="safe-codex-gh-config-") as gh_config_dir:
            command = command_for(args[0], args[1], codex_binary, gh_config_dir)
            return subprocess.run(command, cwd=repository_root, env=env, check=False).returncode
    except OSError as exc:
        print(f"safe-codex: could not start Codex: {exc}", file=sys.stderr)
        return 127


if __name__ == "__main__":
    raise SystemExit(main())
