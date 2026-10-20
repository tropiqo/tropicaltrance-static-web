# Safe Codex execution

This repository includes a small launcher for native Codex CLI sandbox modes. It is a prototype, not a proven security boundary, GitHub deployment tool, or credential broker. Native macOS sandbox behavior has not been verified on the target host. Isolated host-side smoke tests are required before trusting this harness, especially with untrusted code or any credentials.

## Available modes

Run from the Website checkout:

```sh
python3 -B tools/codex-safe/safe_codex.py inspect website
python3 -B tools/codex-safe/safe_codex.py develop website
python3 -B tools/codex-safe/safe_codex.py inspect studio
python3 -B tools/codex-safe/safe_codex.py develop studio
```

- **inspect** launches Codex in `read-only` mode.
- **develop** launches Codex in `workspace-write` mode rooted at exactly the selected Website or Studio Git checkout. Local editing, tests, branches, and commits are within scope.
- Both modes set approval to `never`, use strict config parsing and a private CLI process (no shared daemon), turn off network access for sandboxed shell commands, clear extra writable roots and temporary writable paths, filter GitHub/Git/SSH/token/secret/API-key environment variables, point `gh` at a fresh empty temporary config directory, override Git's credential helper with an empty helper list in shell-tool processes, and disable MCP servers, plugins, and optional web search. An operation outside the sandbox must fail; the launcher does not ask to elevate it.
- The launcher accepts exactly a mode and an allowlisted repository. It does not accept commands, arbitrary Codex flags, or prompts as arguments, and uses an argument array (`shell=False` behavior) to start the Codex executable.
- `github-write` is deliberately rejected and is not implemented. GitHub writing is disabled. Do not provide production credentials to this prototype.

Native Codex sandboxing is intended to be the enforcement boundary for shell tools; prompts and this Python dispatch code are not that boundary. Its behavior remains unverified in this environment, so do not assume the sandbox is working until the isolated host-side smoke tests below are completed successfully. Codex documents sandbox modes for filesystem/network access and configuration for writable roots, network, environment filters, MCP, and plugins in its [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference). `--strict-config` is intended to make unknown options fail at startup rather than be silently ignored. Confirm the behavior of the installed CLI version when upgrading it; the launcher does not continue if startup exits with an error.

## Modes and future GitHub-write policy

| Mode | Current behavior | Allowed side effects |
| --- | --- | --- |
| inspect | Implemented; native `read-only` | Read repository files; no edits or shell network |
| develop | Implemented; native `workspace-write` | Edit/test one allowlisted checkout; local branches and commits; no shell network |
| github-write | Not implemented | No push, PR, branch, administration, or deployment operations |

Before any future GitHub-write implementation, require a separate security-reviewed design with:

- Exact repository identifiers: `tropiqo/tropicaltrance-static-web` and the owner-confirmed Studio repository identifier. Resolve and verify Studio's actual GitHub owner/name before allowing it; do not infer an identifier from local directory name.
- Feature branch names only, with a strict prefix and grammar (proposed `codex/<ticket>-<short-slug>`); reject `master`, the production branch, and all other refs.
- GitHub-side protected `master` and production branches with required reviews/checks. Confirm the configured branch rules remotely before enabling a writer.
- Only push the exact allowlisted feature branch and create a draft PR to the explicitly approved base. No force push, branch deletion, merge, GitHub administration, settings changes, workflow/deployment operation, or arbitrary API endpoint.
- A dedicated GitHub App or narrowly scoped fine-grained credential, restricted to the exact repositories and minimum Contents/Pull requests permissions. Keep the credential outside the agent workspace; expose it only through a narrow credential broker that authorizes repository, ref, and draft-PR operations. Never make the token available to shell, MCP, plugins, or model context.
- No privileged shell helper that checks command text and then executes arbitrary commands. A future broker should expose typed operations and independently validate arguments; it should not execute caller-provided shell strings.
- An isolated container/VM and clean, dedicated identity with no personal GitHub CLI profile, SSH agent/keychain, unrelated repositories, or general credentials mounted. Provide only the exact checkout and broker endpoint. Restrict egress to required Codex and broker endpoints.
- Negative tests for foreign repositories, `master`/production refs, malformed branch names, force/deletion/merge/admin/deployment operations, non-draft PRs, and broker outage. Test the broker's actual server-side authorization, not a prompt or local string filter.

GitHub CLI inspection found two local profiles whose authentication status is invalid. The harness does not read, repair, or use those credentials and removes `GH_*`/`GITHUB_*` variables from its Codex parent and shell-tool environments. This is not proof that credentials stored in the macOS Keychain or other paths are inaccessible to the host process. Do not enable GitHub writes on this workstation based on this launcher.

## Security boundaries and limitations

- This is a prototype, not a proven security boundary. Native macOS sandbox behavior remains unverified. Complete isolated host-side smoke tests before trusting it.

- OS-enforced Codex read-only/workspace-write sandbox and disabled shell network: enforced by the installed Codex sandbox, not by policy prose. The launcher pins the mode and fails closed rather than allowing an approval escape. Its unit tests verify fixed invocation arguments and reject unsupported inputs; they do not independently prove the OS sandbox implementation.
- Exact repo/mode allowlist and no-argument-passthrough: enforced by this launcher and covered by unit tests.
- Secret and Git credential environment filtering: enforced by the CLI shell environment policy for model-run commands, plus parent environment removal for GitHub/Git/SSH/token/secret/API-key names. The shell-tool Git configuration resets the credential-helper list. This does not hide files, direct Keychain APIs, or keychain entries outside the checkout.
- GitHub branch protection, remote identity, credential scoping, and policy for GitHub writes: advisory/future requirements only; there is no GitHub write mode or broker.
- This host remains the user's macOS account. Workspace sandboxing does not provide VM-grade isolation from other readable local data, GUI sessions, direct keychain services, or host-level compromise. A VM/container with a dedicated identity and explicit mounts/network policy is required before exposing any GitHub write credential or using this for untrusted code.
- The Codex executable is resolved from the host `PATH`; the launcher rejects an executable inside the project workspace, but does not cryptographically verify the host installation. Keep the host `PATH` and Codex installation trusted.
- Global and project Codex configuration can be version-sensitive. The launcher overrides known sandbox and integration settings, uses `--strict-config`, and starts without the shared daemon. Hooks or other future host-side integrations are not independently audited here; use a clean isolated Codex home/configuration for untrusted repositories.
- Existing Git remotes are untouched. Local repository hooks/configuration remain repository content and must be reviewed as part of untrusted changes.

## Checks

Run the focused launcher tests with:

```sh
python3 -B -m unittest discover -s tools/codex-safe -p 'test_*.py'
```

These tests cover mode-to-sandbox mapping, disabled networking/integrations, rejected `github-write`, rejected repository names, and rejected flag/command injection through extra arguments. They do not test host sandbox internals, GitHub settings, or live credentials.

## Docker-isolated offline prototype

`tools/codex-safe/docker_runtime.py` has separate `build` and `test` actions. `build` builds the credential-free probe image from `tools/codex-safe/docker/Dockerfile`. `test` requires that image to exist already, creates a disposable synthetic workspace, and runs the offline isolation probe. It never starts Codex or accepts an authenticated mode. Build/bootstrap may need registry access; the actual probe container is run with no network.

The test container uses a non-root UID, drops all Linux capabilities, enables `no-new-privileges`, runs with a read-only root filesystem, has no network, and receives one writable bind mount for the generated fixture. The bind mount uses `type=bind,src=...,dst=/workspace`; Docker bind mounts are writable by default, so the mount specification has no extra bare `rw` field. CPU, memory, and process limits are set. It does not mount a Docker socket, home directory, SSH/GitHub/Codex configuration, `.envrc`, cloud credentials, or other host path. The probe checks workspace writes, denied writes outside it, network failure, UID, effective capabilities, Docker socket absence, and absence of credential-mount sentinel paths. These checks have not been exercised unless the Docker test command completes successfully on the host.

### Owner-reported Docker Desktop verification

The owner reports that the Docker offline test completed successfully on macOS after the mount syntax fix. This is owner-reported output and was not executed or independently observed by Codex. Reported values were: `docker_socket_absent: true`, `effective_capabilities: 0000000000000000`, `host_mount_sentinels_absent: true`, `network_denied: true`, `no_effective_capabilities: true`, `non_root: true`, `outside_writes_denied` true for both `/` and `/tmp`, `uid: 10001`, and `workspace_write: true`. Codex's managed environment still cannot access the Docker daemon, so it has not independently repeated this Docker Desktop test.

Run bootstrap and offline verification separately:

```sh
python3 -B tools/codex-safe/docker_runtime.py build
python3 -B tools/codex-safe/docker_runtime.py test
```

The Docker options are enforced by Docker for this container invocation; the existing Codex flags/environment filters are only requested inside the separate native Codex prototype. Neither set of controls has been verified by the other. The Python base image is version-tagged but not digest-pinned, so rebuilding is operationally reproducible at the configuration level, not guaranteed byte-for-byte or supply-chain immutable. Do not add Codex or credential injection to this prototype. Any later authenticated runtime requires a separately reviewed image pin, dedicated identity, narrowly scoped broker, and host-side isolation verification.
