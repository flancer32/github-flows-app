# Runtime Workspace

- Path: `docs/workspace.md`
- Version: `20260514`

## Purpose

This document describes how `@flancer32/github-flows-app` uses the filesystem
workspace passed to `@teqfw/github-flows`.

## Workspace Root

The application reads `WORKSPACE_ROOT` from `.env`:

```env
WORKSPACE_ROOT=./var/work
LOG_RETENTION_DAYS=30
```

The path is passed to `@teqfw/github-flows` as the runtime `workspaceRoot`.

The application does not own the internal runtime meaning of this directory. It
only supplies the location and may expose selected subdirectories through the
read-only static surface.

When the runtime uses host-side `hostScript`, the host may also place
execution-scoped helper artifacts under a run-local workspace location before
container launch. Those artifacts remain temporary runtime support data, not
host-owned durable state.

## Recommended Layout

For a local deployment, the workspace normally contains:

```text
var/work/
  cfg/
  tmp/
  log/
  app.log
```

`cfg/` contains profile fragments and prompts consumed by
`@teqfw/github-flows`.

`tmp/` is a recommended host-managed area for execution-scoped temporary files
such as generated token files or other short-lived artifacts prepared before a
container run. Runtime launch logic may use it, but long-lived credentials do
not belong there.

`log/` contains runtime-produced event archives and observational indexes.

`app.log` may contain stdout and stderr from the long-running application
process when configured through `systemd`.

## Profile Configuration

The runtime package reads profile fragments from:

```text
WORKSPACE_ROOT/cfg/
```

A minimal profile tree may start as:

```text
cfg/
  profile.json
  repos/
    owner/
      repository/
        issues-opened/
          profile.json
          prompt.md
```

Directory names are organizational. Runtime matching is based on `trigger`
fields inside `profile.json`, not on directory names.

Read the runtime package overview before creating production profiles:

```text
node_modules/@teqfw/github-flows/docs/overview.md
```

Follow the documentation map in that package for the current profile and trigger
guides.

When a profile uses `hostScript`, keep its outputs execution-scoped:

- write generated files into a temporary area under `WORKSPACE_ROOT` or another
  host-managed non-public path;
- mount only the specific file or directory needed by that one execution;
- remove or overwrite the artifact after the run according to the runtime
  package behavior or the surrounding operational policy.

## Logs

The runtime package writes admitted-event archives under the workspace log tree.

The canonical runtime log path is owned by `@teqfw/github-flows`:

```text
WORKSPACE_ROOT/log/run/{owner}/{repo}/{eventId}/
```

The application may also write a process log such as:

```text
WORKSPACE_ROOT/app.log
```

When `LOG_RETENTION_DAYS` is set, the host application performs archival log
cleanup once during application startup and then repeats the cleanup every
hour while the process remains active.

Cleanup applies to canonical archived event directories under
`WORKSPACE_ROOT/log/run/`. Any derived navigation links under
`WORKSPACE_ROOT/log/index/` that point to removed archived directories must be
removed or refreshed so the inspection view remains consistent.

Use process log rotation for `app.log`. Do not treat runtime event archives as
application-owned state.

## Static Inspection Links

The public `web/` directory may contain symbolic links to workspace
subdirectories:

```text
web/cfg -> ../var/work/cfg
web/log -> ../var/work/log
```

These links are for read-only inspection. When exposed through Apache or another
public web server, protect them with authentication.

The setup guide [setup/ubuntu/apache.md](setup/ubuntu/apache.md) covers this
deployment shape.

## Credentials

Do not store long-lived credentials under `WORKSPACE_ROOT`.

The workspace may be exposed through protected operational views and may contain
per-run files. Store GitHub tokens, Codex auth state, and other long-lived
secrets outside the workspace and mount them into agent containers only when a
selected profile requires them.

If a selected profile needs a token file inside the container, prefer an
execution-scoped file generated during `hostScript` over a long-lived secret
stored directly under `WORKSPACE_ROOT`.

Use [setup/ubuntu/auth.md](setup/ubuntu/auth.md) for the credential layout used
by the provided Codex agent image.
