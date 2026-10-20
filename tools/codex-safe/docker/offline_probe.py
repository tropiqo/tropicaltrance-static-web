"""Offline, credential-free Docker isolation checks for a synthetic workspace."""

from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import sys


def main() -> int:
    workspace = Path("/workspace")
    if not workspace.is_dir():
        raise SystemExit("workspace mount is missing")

    marker = workspace / "container-write-check.txt"
    marker.write_text("disposable Docker workspace write succeeded\n", encoding="utf-8")

    denied_writes: dict[str, bool] = {}
    for target in (Path("/outside-workspace-check"), Path("/tmp/outside-workspace-check")):
        try:
            target.write_text("must not be writable\n", encoding="utf-8")
        except OSError:
            denied_writes[str(target)] = True
        else:
            target.unlink(missing_ok=True)
            denied_writes[str(target)] = False

    network_denied = False
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
            connection.settimeout(1.0)
            connection.connect(("192.0.2.1", 9))
    except OSError:
        network_denied = True

    status = Path("/proc/self/status").read_text(encoding="ascii")
    cap_eff = next(line.split(":", 1)[1].strip() for line in status.splitlines() if line.startswith("CapEff:"))
    uid = os.getuid()

    report = {
        "uid": uid,
        "non_root": uid != 0,
        "workspace_write": marker.is_file(),
        "outside_writes_denied": denied_writes,
        "network_denied": network_denied,
        "effective_capabilities": cap_eff,
        "no_effective_capabilities": int(cap_eff, 16) == 0,
        "docker_socket_absent": not Path("/var/run/docker.sock").exists(),
        "host_mount_sentinels_absent": all(
            not Path(item).exists()
            for item in ("/host-home", "/host-credentials", "/host-ssh", "/host-gh", "/host-cloud")
        ),
    }
    print(json.dumps(report, sort_keys=True))
    passed = (
        report["non_root"]
        and report["workspace_write"]
        and all(denied_writes.values())
        and network_denied
        and report["no_effective_capabilities"]
        and report["docker_socket_absent"]
        and report["host_mount_sentinels_absent"]
    )
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
