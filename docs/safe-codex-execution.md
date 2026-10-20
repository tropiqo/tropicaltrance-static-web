# Codex runtime prototypes — retired

The 016A native launcher and 016B Docker isolation prototype are discontinued. Do not use the old `safe_codex.py` or `docker_runtime.py` commands; their implementations were removed from the current source tree. The historical commits remain in Git.

The 016C `tt` prototype is also not an operational runtime. Its `work` command only validates an allowlisted repository and then refuses to launch. It does not start a disposable workspace or Codex, and it has no native unsandboxed fallback. The separate `tt` prototype files currently present in the working tree are untracked development artifacts and are not part of the Astro migration source.

No authenticated Codex session was tested in Docker. The 016C.1 feasibility review found that a container with networking would also expose networking to generated commands without an additional verified boundary; `--network none` blocks model traffic as well. No owner credentials or API keys were supplied. Do not add credential injection, a broker, a launcher, or Docker runtime as part of the Astro master migration.

For the native Codex security assessment and recommended per-invocation settings, see the Change 017A preparation report. Native sandbox configuration limits shell command behavior, but it is not a credential or GitHub operation allowlist; host configuration and integrations require separate review.
