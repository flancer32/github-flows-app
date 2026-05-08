# Codex Agent Docker Image Setup

- Path: `docs/setup/docker/agent-codex.md`
- Template Version: `20260508`

## Purpose

This document describes how to build an isolated Docker image for running a Codex agent under GitHub Flows.

The image is referenced as:

```text
github-flows-agent-codex
```

The image contains Codex CLI and common command-line tools used by agents when working with source repositories.

This document does not describe Docker installation, GitHub Flows application deployment, Apache configuration, webhook processing, or per-run workspace preparation.

The image does not define a default agent command. GitHub Flows must provide the exact command when starting the container.

## Prerequisites

Docker must be installed and running on the host.

Check Docker status:

```bash
sudo systemctl status docker
```

The runtime user referenced as `user` must be able to run Docker commands.

Check Docker access under the runtime user:

```bash
sudo -iu user
docker ps
```

If Docker reports that the legacy builder is deprecated, install the BuildKit buildx plugin:

```bash
sudo apt update
sudo apt install -y docker-buildx-plugin
```

Check buildx:

```bash
docker buildx version
```

## Create Dockerfile

Create the Dockerfile location:

```bash
mkdir -p docker/agents/codex
nano docker/agents/codex/Dockerfile
```

Use this Dockerfile:

```dockerfile
FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

ARG UID=1000
ARG GID=1000
ARG CODEX_VERSION=latest

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    file \
    git \
    gh \
    jq \
    less \
    make \
    g++ \
    openssh-client \
    procps \
    python3 \
    python3-pip \
    ripgrep \
    rsync \
    tar \
    unzip \
    xz-utils \
    zip \
  && npm install -g @openai/codex@${CODEX_VERSION} \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN groupadd -g ${GID} user \
  && useradd -m -u ${UID} -g ${GID} -s /bin/bash user

RUN mkdir -p /home/user/.config /home/user/.cache /home/user/.ssh /workspace \
  && chown -R user:user /home/user /workspace \
  && chmod 700 /home/user/.ssh

USER user

ENV HOME=/home/user
ENV NPM_CONFIG_PREFIX=/home/user/.npm-global
ENV PATH=/home/user/.npm-global/bin:/home/user/.local/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin

RUN git config --global --add safe.directory /workspace

WORKDIR /workspace
```

The image intentionally has no `CMD` instruction. The container command is supplied by GitHub Flows for each agent execution.

The `/workspace` directory is created before switching to the non-root user. This allows Docker to use it as the working directory even when no host workspace is mounted. In normal execution, `/workspace` is replaced by the mounted per-run workspace.

## Build the Image

Build the image from the repository root.

Preferred command with buildx:

```bash
docker buildx build --load \
  -f docker/agents/codex/Dockerfile \
  --build-arg UID=$(id -u user) \
  --build-arg GID=$(id -g user) \
  -t github-flows-agent-codex:latest .
```

The `--load` option stores the built image in the local Docker image store.

If buildx is not available, use the legacy builder:

```bash
docker build \
  -f docker/agents/codex/Dockerfile \
  --build-arg UID=$(id -u user) \
  --build-arg GID=$(id -g user) \
  -t github-flows-agent-codex:latest .
```

The image name is structured as:

```text
github-flows-agent-codex
```

The least significant qualifier, `codex`, is placed at the end.

Check the image:

```bash
docker images | grep github-flows-agent-codex
```

Docker stores locally built images in the local Docker image store on the host. Do not manage image files directly under `/var/lib/docker/`; use Docker CLI commands instead.

Check Docker disk usage:

```bash
docker system df
```

## Optional Version Pinning

The image uses the latest Codex CLI version by default:

```text
CODEX_VERSION=latest
```

Pin a specific Codex CLI version if strict reproducibility is required:

```bash
docker buildx build --load \
  -f docker/agents/codex/Dockerfile \
  --build-arg UID=$(id -u user) \
  --build-arg GID=$(id -g user) \
  --build-arg CODEX_VERSION=<version> \
  -t github-flows-agent-codex:<version> .
```

## Build Notes

The slim base image may print this warning during package installation:

```text
debconf: delaying package configuration, since apt-utils is not installed
```

This is expected for slim Debian-based images and can be ignored if the package installation completes successfully.

npm may also print a notice about a newer npm version. This is not an error. The image uses the npm version provided by the base Node.js image unless a specific change is required.

## Verify the Image

Check that the container starts and runs as the expected non-root user:

```bash
docker run --rm github-flows-agent-codex:latest whoami
```

Expected result:

```text
user
```

Check the working directory:

```bash
docker run --rm github-flows-agent-codex:latest pwd
```

Expected result:

```text
/workspace
```

Check installed tools:

```bash
docker run --rm github-flows-agent-codex:latest bash -lc '
node -v
npm -v
codex --version
git --version
gh --version
jq --version
rg --version
python3 --version
'
```

Check mounted workspace write access:

```bash
mkdir -p /home/user/app/github-flows/var/work/test-run

docker run --rm \
  -v /home/user/app/github-flows/var/work/test-run:/workspace \
  github-flows-agent-codex:latest \
  bash -lc 'pwd && echo test > check.txt && ls -lh check.txt'
```

Check the file on the host:

```bash
ls -lh /home/user/app/github-flows/var/work/test-run/check.txt
cat /home/user/app/github-flows/var/work/test-run/check.txt
```

Check file ownership:

```bash
stat -c '%U:%G %a %n' /home/user/app/github-flows/var/work/test-run/check.txt
```

If the image was built with the runtime user's UID and GID, the file should be owned by `user`.

Check Codex CLI help output:

```bash
docker run --rm github-flows-agent-codex:latest codex --help
```

## Isolated Runtime Model

The container is expected to receive only a per-run workspace.

Example workspace:

```text
/home/user/app/github-flows/var/work/run-123/
```

The workspace is mounted into the container as:

```text
/workspace
```

Example isolated run:

```bash
docker run --rm \
  --name github-flows-run-123 \
  --mount type=bind,src=/home/user/.secrets/codex,dst=/home/user/.codex \
  --mount type=bind,src=/home/user/.secrets/gh-token,dst=/run/secrets/gh-token,readonly \
  --mount type=bind,src=/home/user/app/github-flows/var/work/run-123,dst=/workspace \
  -w /workspace \
  -e GH_TOKEN_FILE=/run/secrets/gh-token \
  github-flows-agent-codex:latest \
  bash -lc 'export GH_TOKEN="$(tr -d "\r\n" < "$GH_TOKEN_FILE")"; export GITHUB_TOKEN="$GH_TOKEN"; exec codex exec'
```

The container receives the GitHub token as a mounted readonly file. The shell command exports `GH_TOKEN` and `GITHUB_TOKEN` before starting Codex.

## Restricted Mounts

Do not mount the runtime user home directory:

```bash
-v /home/user:/home/user
```

Do not mount SSH configuration:

```bash
-v /home/user/.ssh:/home/user/.ssh
```

Do not mount user configuration directories:

```bash
-v /home/user/.config:/home/user/.config
```

Do not mount the application `.env` file:

Do not mount the Docker socket:

```bash
-v /var/run/docker.sock:/var/run/docker.sock
```

Do not run the container with privileged host access:

```bash
--privileged
--network host
```

## Security Notes

The Docker image itself does not expose host secrets.

Host secrets become available to the agent only if they are mounted into the container or passed through environment variables.

Sensitive host paths include:

```text
/home/user/.ssh/
/home/user/.config/
/home/user/.npmrc
/home/user/.bash_history
/var/run/docker.sock
```

The container must receive only the per-run workspace and the minimum credentials required for the specific agent execution.

Matching the container UID and GID to the host runtime user is useful for file ownership in mounted workspaces, but it also means that any accidentally mounted user-owned host directory can become readable or writable by the agent.

## Result

After this setup:

- the Dockerfile exists at `docker/agents/codex/Dockerfile`;
- the Docker image `github-flows-agent-codex:latest` exists in the local Docker image store;
- the image contains Codex CLI;
- the image contains common agent tooling: git, GitHub CLI, SSH client, jq, ripgrep, Python, build tools, and archive tools;
- the container runs as non-root user `user`;
- the workspace is expected at `/workspace`;
- the image does not define a default agent command;
- GitHub Flows must provide the exact command when starting the container;
- the host home directory is not mounted into the container;
- secrets are available only if explicitly passed at runtime;
- the image can be used by GitHub Flows to run isolated Codex agent executions.
