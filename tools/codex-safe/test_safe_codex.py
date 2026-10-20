import contextlib
import io
from pathlib import Path
import tempfile
import tomllib
import unittest
from unittest import mock
import subprocess

import safe_codex


class SafeCodexTests(unittest.TestCase):
    def test_inspect_uses_read_only_and_disables_network_and_integrations(self):
        command = safe_codex.command_for("inspect", "website", "/codex")
        self.assertIn("read-only", command)
        self.assertIn("--ask-for-approval", command)
        self.assertIn("never", command)
        self.assertIn("--strict-config", command)
        self.assertIn("--no-daemon", command)
        self.assertIn("sandbox_workspace_write.network_access=false", command)
        self.assertIn("sandbox_workspace_write.exclude_slash_tmp=true", command)
        self.assertIn("sandbox_workspace_write.exclude_tmpdir_env_var=true", command)
        set_override = next(
            command[index + 1]
            for index, item in enumerate(command[:-1])
            if item == "-c" and command[index + 1].startswith("shell_environment_policy.set=")
        )
        self.assertIn('"GIT_CONFIG_KEY_0"="credential.helper"', set_override)
        self.assertIn('"GIT_CONFIG_VALUE_0"=""', set_override)
        self.assertIn('"GH_CONFIG_DIR"=', set_override)
        self.assertIn("mcp_servers={}", command)
        self.assertIn("plugins={}", command)

    def test_develop_uses_workspace_write_without_extra_writable_roots(self):
        command = safe_codex.command_for("develop", "studio", "/codex")
        self.assertIn("workspace-write", command)
        self.assertIn("sandbox_workspace_write.writable_roots=[]", command)
        self.assertIn("sandbox_workspace_write.network_access=false", command)

    def test_github_write_mode_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "github-write is disabled"):
            safe_codex.command_for("github-write", "website", "/codex")

    def test_unlisted_repository_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "allowlisted"):
            safe_codex.command_for("develop", "minimal-mistakes", "/codex")

    def test_path_traversal_repository_name_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "allowlisted"):
            safe_codex.resolve_repository("../tropical-trance-studio")

    def test_symlinked_repository_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            alias = Path(temp) / "website"
            alias.symlink_to(safe_codex.REPOSITORIES["website"], target_is_directory=True)
            with mock.patch.dict(safe_codex.REPOSITORIES, {"website": alias}):
                with self.assertRaisesRegex(ValueError, "path changed"):
                    safe_codex.resolve_repository("website")

    def test_external_git_common_directory_is_rejected(self):
        root = safe_codex.REPOSITORIES["website"].resolve()
        responses = [
            subprocess.CompletedProcess([], 0, stdout=f"{root}\n", stderr=""),
            subprocess.CompletedProcess([], 0, stdout=f"{safe_codex.ROOT.parent}\n", stderr=""),
        ]
        with mock.patch.object(safe_codex.subprocess, "run", side_effect=responses):
            with self.assertRaisesRegex(ValueError, "Git metadata resolves outside"):
                safe_codex.resolve_repository("website")

    def test_codex_executable_from_workspace_is_rejected(self):
        with tempfile.TemporaryDirectory(dir=safe_codex.ROOT) as temp:
            fake = Path(temp) / "codex"
            fake.write_text("#!/bin/sh\nexit 0\n")
            fake.chmod(0o700)
            with mock.patch.object(safe_codex.shutil, "which", return_value=str(fake)):
                with self.assertRaisesRegex(ValueError, "must not come from"):
                    safe_codex.resolve_codex_binary()

    def test_sensitive_git_ssh_and_github_environment_is_removed(self):
        synthetic = {
            "PATH": "/usr/bin",
            "GH_PROFILE": "synthetic",
            "GITHUB_TOKEN": "synthetic",
            "GIT_CONFIG_COUNT": "synthetic",
            "GIT_SSH_COMMAND": "synthetic",
            "SSH_AUTH_SOCK": "synthetic",
            "SSH_AGENT_PID": "synthetic",
            "APP_SECRET": "synthetic",
            "APP_TOKEN": "synthetic",
            "OPENAI_API_KEY": "synthetic",
            "LANG": "C",
        }
        cleaned = safe_codex.sanitized_environment(synthetic)
        self.assertEqual(cleaned, {"PATH": "/usr/bin", "LANG": "C"})

    def test_codex_startup_failure_is_returned_without_fallback(self):
        real_run = subprocess.run
        calls = []

        def run(argv, **kwargs):
            if argv[0] == "git":
                return real_run(argv, **kwargs)
            calls.append((argv, kwargs))
            return subprocess.CompletedProcess(argv, 17)

        with mock.patch.object(safe_codex, "resolve_codex_binary", return_value="/trusted/codex"):
            with mock.patch.object(safe_codex.subprocess, "run", side_effect=run):
                result = safe_codex.main(["develop", "website"])
        self.assertEqual(result, 17)
        self.assertEqual(len(calls), 1)
        self.assertIn("--sandbox", calls[0][0])
        self.assertNotIn("--dangerously-bypass-approvals-and-sandbox", calls[0][0])

    def test_extra_arguments_are_rejected_before_codex_launch(self):
        error = io.StringIO()
        with mock.patch.object(safe_codex.shutil, "which") as which:
            with contextlib.redirect_stderr(error):
                result = safe_codex.main(["develop", "website", "--dangerously-bypass-approvals-and-sandbox"])
        self.assertEqual(result, 2)
        which.assert_not_called()
        self.assertIn("usage:", error.getvalue())

    def test_no_user_command_is_forwarded_to_codex(self):
        command = safe_codex.command_for("develop", "website", "/codex")
        self.assertEqual(command[1:3], ["--strict-config", "--no-daemon"])
        self.assertNotIn("exec", command)
        self.assertFalse(any(item.startswith("--dangerously") for item in command))

    def test_all_cli_config_overrides_are_valid_toml(self):
        command = safe_codex.command_for("develop", "website", "/codex")
        overrides = [command[index + 1] for index, item in enumerate(command[:-1]) if item == "-c"]
        self.assertGreaterEqual(len(overrides), 10)
        for override in overrides:
            with self.subTest(override=override):
                self.assertEqual(len(tomllib.loads(override)), 1)


if __name__ == "__main__":
    unittest.main()
