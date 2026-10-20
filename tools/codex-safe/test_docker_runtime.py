import ast
from pathlib import Path
import unittest

import docker_runtime


class DockerRuntimeTests(unittest.TestCase):
    def test_runtime_mounts_only_disposable_workspace_and_has_restrictions(self):
        class Completed:
            returncode = 0
            stdout = '{"uid":10001}\n'
            stderr = ""

        calls = []
        mount_fixture_exists = []

        def fake_run(argv, **kwargs):
            calls.append((argv, kwargs))
            if "inspect" in argv:
                return Completed()
            mount = next(item for item in argv if item.startswith("type=bind,"))
            workspace = Path(mount.split("src=", 1)[1].split(",", 1)[0])
            mount_fixture_exists.append((workspace / "fixture.txt").is_file())
            (workspace / "container-write-check.txt").write_text("fixture result")
            return Completed()

        from unittest import mock

        with mock.patch.object(docker_runtime, "docker_binary", return_value="/usr/bin/docker"):
            with mock.patch.object(docker_runtime.subprocess, "run", side_effect=fake_run):
                self.assertEqual(docker_runtime.run_offline_test(), 0)

        run_argv = next(argv for argv, _ in calls if "run" in argv)
        joined = " ".join(run_argv)
        for required in ("--network none", "--read-only", "--cap-drop ALL", "no-new-privileges:true", "--user 10001:10001", "--pids-limit 64", "--memory 384m", "--cpus 1"):
            self.assertIn(required, joined)
        mount_args = [item for item in run_argv if item.startswith("type=bind,")]
        self.assertEqual(len(mount_args), 1)
        mount_fields = mount_args[0].split(",")
        self.assertTrue(all("=" in field for field in mount_fields))
        mount = dict(field.split("=", 1) for field in mount_fields)
        self.assertEqual(set(mount), {"type", "src", "dst"})
        self.assertEqual(mount["type"], "bind")
        self.assertEqual(mount["dst"], "/workspace")
        self.assertEqual(mount_fixture_exists, [True])
        self.assertNotIn("rw", mount_fields)
        for forbidden in ("/var/run/docker.sock", ".ssh", ".codex", ".config/gh", ".envrc"):
            self.assertNotIn(forbidden, joined)

    def test_missing_image_fails_without_running_container(self):
        calls = []

        class Missing:
            returncode = 1
            stderr = "Error: No such image: tropical-trance-safe-codex:016b"

        from unittest import mock

        with mock.patch.object(docker_runtime, "docker_binary", return_value="docker"):
            with mock.patch.object(docker_runtime.subprocess, "run", side_effect=lambda *a, **k: (calls.append(a[0]) or Missing())):
                with self.assertRaisesRegex(RuntimeError, "separate build command"):
                    docker_runtime.run_offline_test()
        self.assertEqual(len(calls), 1)
        self.assertIn("inspect", calls[0])

    def test_container_failure_is_returned_without_retry(self):
        calls = []

        class Completed:
            returncode = 0
            stdout = ""
            stderr = ""

        class Failed:
            returncode = 23
            stdout = ""
            stderr = "probe failed"

        from unittest import mock

        def fake_run(argv, **kwargs):
            calls.append(argv)
            return Completed() if "inspect" in argv else Failed()

        with mock.patch.object(docker_runtime, "docker_binary", return_value="docker"):
            with mock.patch.object(docker_runtime.subprocess, "run", side_effect=fake_run):
                self.assertEqual(docker_runtime.run_offline_test(), 23)
        self.assertEqual(len(calls), 2)
        self.assertIn("run", calls[1])

    def test_image_and_probe_python_syntax(self):
        for path in (Path(docker_runtime.__file__), docker_runtime.DOCKER_DIR / "offline_probe.py"):
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


if __name__ == "__main__":
    unittest.main()
