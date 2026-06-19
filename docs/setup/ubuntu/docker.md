# Codex Agent Docker Image Setup

- Path: `docs/setup/ubuntu/docker.md`
- Template Version: `20260508`

## Purpose

This document describes the Codex agent Docker image that is built from this repository.

The image is used by GitHub Flows launch/profile configuration when a Codex-based handler must run in an isolated container.

This document covers only the image build and basic verification. It does not cover application deployment, Apache configuration, webhook setup, credentials, or per-run profile configuration.

## Repository Contract

Dockerfile:

```text
etc/docker/Dockerfile.codex
```

Recommended image tag:

```text
github-flows-agent-codex:latest
```

The current Dockerfile:

- uses `node:20-bookworm-slim`;
- installs Git, GitHub CLI, CA certificates, OpenSSH client, and Codex CLI;
- accepts `UID` and `GID` build arguments;
- adjusts the bundled `node` user to the requested UID/GID;
- uses `/workspace` as the working directory;
- runs containers as the non-root `node` user.

The image does not define a default command. The execution command is supplied
by GitHub Flows launch/profile configuration.

In the current runtime model, host-side `hostScript` prepares host-local and
execution-scoped inputs before container launch, while `setupScript` performs
container-local startup checks after launch.

## Build the Image

Build from the repository root:

```bash
docker build \
  -f etc/docker/Dockerfile.codex \
  --build-arg UID=$(id -u) \
  --build-arg GID=$(id -g) \
  -t github-flows-agent-codex:latest \
  .
```

Check that the image exists:

```bash
docker images github-flows-agent-codex
```

## Verify the Image

Check the container user:

```bash
docker run --rm github-flows-agent-codex:latest whoami
```

Expected result:

```text
node
```

Check the working directory:

```bash
docker run --rm github-flows-agent-codex:latest pwd
```

Expected result:

```text
/workspace
```

Check the installed tools:

```bash
docker run --rm github-flows-agent-codex:latest bash -lc '
node -v
npm -v
codex --version
git --version
gh --version
ssh -V
'
```

## Workspace Mount

GitHub Flows should mount a per-run workspace into the container at:

```text
/workspace
```

In the current runtime model, host-side preparation may happen before the
container is created through a runtime-owned `hostScript`. The resulting mounts
or environment values are still part of runtime profile execution, not Docker
image behavior.

Example manual check:

```bash
mkdir -p ./var/work/test-run

docker run --rm \
  --mount type=bind,src="$(pwd)/var/work/test-run",dst=/workspace \
  github-flows-agent-codex:latest \
  bash -lc 'pwd && echo test > check.txt && ls -lh check.txt'
```

Check the file on the host:

```bash
ls -lh ./var/work/test-run/check.txt
cat ./var/work/test-run/check.txt
```

## Runtime Restrictions

The container should receive only the per-run workspace and the explicit
credentials required by the selected launch/profile configuration.

Prefer execution-scoped mounts produced for one run over broad long-lived host
directory mounts.

Do not mount:

- the runtime user's home directory;
- SSH configuration directories;
- general user configuration directories;
- the application `.env` file;
- the Docker socket.

Do not run the agent container with privileged host access.

If a profile prepares a temporary token file on the host, mount only that file
read-only and clean it up after the run.
If host-side preparation creates execution-scoped files for one run, mount only
those specific files or directories. Do not broaden the mount to the full
secrets directory just for convenience.

## Result

After this setup:

- the image `github-flows-agent-codex:latest` exists locally;
- the image is built from `etc/docker/Dockerfile.codex`;
- the container runs as non-root user `node`;
- `/workspace` is the container working directory;
- GitHub Flows launch/profile configuration remains responsible for the runtime command, mounts, environment, and credentials.
- host-side pre-launch preparation remains outside the image and inside the
  runtime-owned profile execution model.
