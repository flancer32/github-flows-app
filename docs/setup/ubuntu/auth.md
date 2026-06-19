# GitHub and Codex Credentials Setup

- Path: `docs/setup/ubuntu/auth.md`
- Template Version: `20260508`

## Purpose

This document describes how to configure credentials for GitHub CLI and Codex CLI when running Codex agents through GitHub Flows.

The credentials are used by Docker-isolated agent executions.

This document covers:

- GitHub personal access token storage;
- GitHub CLI authentication through `GH_TOKEN`;
- Codex authentication through persisted Codex auth state;
- profile configuration for passing credentials into the agent container;
- execution-scoped credential files prepared before one container run.

This document does not describe Docker image creation, application deployment, Apache configuration, or GitHub webhook setup.

## Runtime Assumptions

The runtime user is referenced as `user`.

The application is deployed into:

```text
/home/user/app/github-flows/
```

The runtime workspace is located under:

```text
/home/user/app/github-flows/var/work/
```

The Codex agent image is:

```text
github-flows-agent-codex:latest
```

The GitHub token file is:

```text
/home/user/.secrets/gh-token
```

The Codex auth state directory is:

```text
/home/user/.secrets/codex/
```

Inside the container:

```text
/run/secrets/gh-token      GitHub token file
/home/user/.codex          Codex auth state
/workspace                 per-run workspace
```

Before the container starts, a selected runtime profile may also create
execution-scoped files on the host through `hostScript`. Those files should be
mounted only into the run that needs them.

## GitHub Account Access

The GitHub account used by the agent must have access to the target repository.

For a private organization repository, organization membership alone may not be enough. The account must have repository access through direct repository permissions, team membership, or another approved organization access policy.

For a Codex agent that reads issues, modifies files, pushes branches, and opens pull requests, the GitHub account typically needs write access to the target repository.

## GitHub Token

Create a fine-grained personal access token for the GitHub account used by the agent.

Recommended repository access:

```text
Only selected repositories:
  owner/repository
```

Recommended repository permissions:

```text
Metadata: Read
Contents: Read and write
Issues: Read and write
Pull requests: Read and write
```

If the repository belongs to an organization, the token may require organization owner approval before it can access private organization resources.

For organization approval, use the organization settings:

```text
Organization
  -> Settings
  -> Personal access tokens
  -> Pending requests
  -> select the token request
  -> Approve
```

## Store the GitHub Token

Run under the runtime user:

```bash
sudo -iu user
```

Create the secrets directory:

```bash
mkdir -p /home/user/.secrets
chmod 700 /home/user/.secrets
```

Create the token file:

```bash
nano /home/user/.secrets/gh-token
chmod 600 /home/user/.secrets/gh-token
```

The file must contain only the raw GitHub token value.

Check that the runtime user can read the token:

```bash
test -r /home/user/.secrets/gh-token && echo gh-token-ok
```

## Verify GitHub Token in the Container

Check the GitHub identity exposed by the token:

```bash
docker run --rm \
  --mount type=bind,src=/home/user/.secrets/gh-token,dst=/run/secrets/gh-token,readonly \
  -e GH_TOKEN_FILE=/run/secrets/gh-token \
  github-flows-agent-codex:latest \
  bash -lc 'export GH_TOKEN="$(tr -d "\r\n" < "$GH_TOKEN_FILE")"; export GITHUB_TOKEN="$GH_TOKEN"; gh api user --jq .login'
```

Check repository access:

```bash
docker run --rm \
  --mount type=bind,src=/home/user/.secrets/gh-token,dst=/run/secrets/gh-token,readonly \
  -e GH_TOKEN_FILE=/run/secrets/gh-token \
  github-flows-agent-codex:latest \
  bash -lc 'export GH_TOKEN="$(tr -d "\r\n" < "$GH_TOKEN_FILE")"; export GITHUB_TOKEN="$GH_TOKEN"; gh repo view owner/repository'
```

The `tr -d "\r\n"` command removes line endings from the token file before exporting the token.

## Codex Authentication

Codex CLI supports authentication through a ChatGPT account or through an OpenAI API key.

For subscription-based Codex use, authenticate Codex through ChatGPT sign-in and persist the Codex auth state outside the container image.

Create the Codex auth directory:

```bash
sudo -iu user

mkdir -p /home/user/.secrets/codex
chmod 700 /home/user/.secrets/codex
```

Run Codex login interactively:

```bash
docker run --rm -it \
  --name github-flows-codex-login \
  --mount type=bind,src=/home/user/.secrets/codex,dst=/home/user/.codex \
  --mount type=bind,src=/home/user/app/github-flows/var/work,dst=/workspace \
  -w /workspace \
  github-flows-agent-codex:latest \
  codex login
```

Complete the browser or device authentication flow shown by Codex.

After login, check that Codex auth state was written:

```bash
find /home/user/.secrets/codex -maxdepth 3 -type f -ls
```

## Choose and Persist Codex Model

Run Codex interactively with the persisted auth state:

```bash
docker run --rm -it \
  --name github-flows-codex-interactive \
  --mount type=bind,src=/home/user/.secrets/codex,dst=/home/user/.codex \
  --mount type=bind,src=/home/user/app/github-flows/var/work,dst=/workspace \
  -w /workspace \
  github-flows-agent-codex:latest \
  codex
```

Inside Codex, select the model:

```text
/model
```

Check the active session settings:

```text
/status
```

The selected model and Codex settings are stored in the mounted Codex auth/config directory.

## Profile Credential Configuration

A profile can mount both long-lived credential sources into the container:

```json
{
  "runtime": {
    "env": {
      "LOG_LEVEL": "info",
      "GH_TOKEN_FILE": "/run/secrets/gh-token"
    },
    "dockerArgs": [
      "--mount",
      "type=bind,src=/home/user/.secrets/codex,dst=/home/user/.codex",
      "--mount",
      "type=bind,src=/home/user/.secrets/gh-token,dst=/run/secrets/gh-token,readonly"
    ]
  }
}
```

This does not automatically create `GH_TOKEN`.

The profile command must read `GH_TOKEN_FILE` and export `GH_TOKEN` before starting Codex.

In the newer runtime model, prefer splitting host-side and container-side work:

- `hostScript` prepares execution-scoped artifacts on the host, such as a
  copied token file under a run-specific temporary directory;
- `setupScript` performs lightweight container checks after the mounts are in
  place;
- the execution command exports `GH_TOKEN` and starts Codex.

## Profile Example

This profile launches Codex through `bash -lc`, uses `hostScript` to prepare an
execution-scoped token file on the host, uses `setupScript` for an in-container
sanity check, then reads the mounted token and starts Codex.

```json
{
  "trigger": {
    "repository": "owner/repository",
    "event": "issue_comment",
    "action": "created"
  },
  "execution": {
    "handler": {
      "type": "agent",
      "command": ["bash", "-lc"],
      "args": [
        "export GH_TOKEN=\"$(tr -d '\\r\\n' < \"$GH_TOKEN_FILE\")\"; export GITHUB_TOKEN=\"$GH_TOKEN\"; exec codex exec --dangerously-bypass-approvals-and-sandbox -C /workspace/repo"
      ],
      "promptRef": "prompt.md",
      "promptVariables": {
        "REPOSITORY": "event.repository.full_name",
        "ISSUE_NUMBER": "event.issue.number",
        "ISSUE_TITLE": "event.issue.title",
        "ISSUE_BODY": "event.issue.body",
        "ISSUE_AUTHOR": "event.issue.user.login"
      }
    },
    "runtime": {
      "image": "github-flows-agent-codex:latest",
      "hostScript": "set -euo pipefail; exec_root=\"$(pwd)/tmp/gh-auth/${EVENT_ID}\"; rm -rf \"$exec_root\"; mkdir -p \"$exec_root\"; install -m 600 /home/user/.secrets/gh-token \"$exec_root/gh-token\"",
      "setupScript": "test -d repo && test -r /run/secrets/gh-token",
      "timeoutSec": 1800,
      "env": {
        "LOG_LEVEL": "info",
        "GH_TOKEN_FILE": "/run/secrets/gh-token"
      },
      "dockerArgs": [
        "--mount",
        "type=bind,src=/home/user/.secrets/codex,dst=/home/user/.codex",
        "--mount",
        "type=bind,src=/workspace/tmp/gh-auth/${EVENT_ID}/gh-token,dst=/run/secrets/gh-token,readonly"
      ]
    }
  }
}
```

The exact placeholder syntax for values such as `${EVENT_ID}` depends on the
runtime package version and its profile-templating model. The important
repository-level rule is the split of responsibilities:

- `hostScript` prepares a run-specific file on the host;
- `setupScript` validates the mounted result in the container;
- the long-lived source secret stays outside the workspace-visible runtime
  state.

## Manual Container Check

Prepare a test workspace:

```bash
mkdir -p /home/user/app/github-flows/var/work/auth-test
```

Run a container with both GitHub and Codex credentials mounted:

```bash
docker run --rm -it \
  --name github-flows-auth-test \
  --mount type=bind,src=/home/user/.secrets/codex,dst=/home/user/.codex \
  --mount type=bind,src=/home/user/.secrets/gh-token,dst=/run/secrets/gh-token,readonly \
  --mount type=bind,src=/home/user/app/github-flows/var/work/auth-test,dst=/workspace \
  -e GH_TOKEN_FILE=/run/secrets/gh-token \
  -w /workspace \
  github-flows-agent-codex:latest \
  bash -lc 'export GH_TOKEN="$(tr -d "\r\n" < "$GH_TOKEN_FILE")"; export GITHUB_TOKEN="$GH_TOKEN"; gh api user --jq .login && codex --help'
```

## Security Rules

Do not mount the runtime user home directory:

```text
/home/user
```

Do not mount SSH configuration:

```text
/home/user/.ssh/
```

Do not mount the full user configuration directory:

```text
/home/user/.config/
```

Do not mount the application `.env` file into the agent workspace:

```text
/home/user/app/github-flows/.env
```

Do not mount the Docker socket:

```text
/var/run/docker.sock
```

Do not place credentials inside:

```text
/home/user/app/github-flows/var/work/
```

The runtime workspace may be visible through logs or debugging tools. It must not contain long-lived credentials.

If `hostScript` creates a temporary credential file under a run-specific
workspace directory, remove it after the run and do not reuse it across
executions.

## Result

After this setup:

- the GitHub token is stored in `/home/user/.secrets/gh-token`;
- the GitHub token file is readable only by the runtime user;
- the Codex auth state is stored in `/home/user/.secrets/codex/`;
- GitHub CLI receives `GH_TOKEN` and `GITHUB_TOKEN` from the mounted token file;
- Codex CLI uses the mounted Codex auth state from `/home/user/.codex`;
- a selected profile may create an execution-scoped token copy for one run
  without moving the long-lived source secret into the workspace;
- profile execution can authenticate to GitHub without mounting the host home directory;
- profile execution can authenticate Codex without storing Codex credentials in the image;
- credentials are mounted into the container only at runtime;
- the per-run workspace remains separated from long-lived credentials.
