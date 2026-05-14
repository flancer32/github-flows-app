# Application Overview

- Path: `docs/overview.md`
- Version: `20260514`

## Purpose

`@flancer32/github-flows-app` is the deployable application layer for
`@teqfw/github-flows`.

It turns the runtime library into a continuously running service by providing:

- Node.js process startup;
- `.env`-based runtime configuration loading;
- workspace location wiring;
- registration of one application-provided event attribute provider;
- static read-only operational file delivery from `web/`;
- a public deployment shape for reverse proxy and service management.

The application is intentionally thin. It does not define workflow behavior,
agent behavior, profile matching rules, event sequencing, or execution policy.

## Dependency Hierarchy

Read the product from the top application layer down to the runtime package:

```text
@flancer32/github-flows-app
  -> @teqfw/github-flows
     -> workspaceRoot/cfg profile fragments
        -> selected agent/runtime command
```

This repository documents the first layer: how to run and operate the host
application.

The dependency package documents the second layer: how GitHub events become
profile selection and isolated execution.

Profile fragments under `workspaceRoot/cfg/` document the site-specific runtime
configuration. They are not application configuration; they are consumed by
`@teqfw/github-flows`.

## Application Surfaces

The application exposes three surfaces:

| Surface | Purpose | Owner |
| --- | --- | --- |
| CLI entrypoint | Starts and stops the service process | Application |
| `/webhooks/github` | Receives GitHub webhooks | `@teqfw/github-flows` |
| Static `web/` files | Read-only operational inspection | Application |

The static surface may expose logs and configuration files through symlinks such
as `web/log` and `web/cfg`. These links must be protected by the public web
server when exposed outside localhost.

## What Users Configure

Application-level configuration is stored in `.env`:

```env
HOST=127.0.0.1
PORT=5020
WORKSPACE_ROOT=./var/work
WEBHOOK_SECRET=replace-with-shared-secret
```

Runtime profile configuration is stored under:

```text
WORKSPACE_ROOT/cfg/
```

Use application documentation for process, deployment, workspace, and
application-provided trigger attributes.

Use `@teqfw/github-flows` documentation for profile fragments, trigger matching,
single-event launch, and event-chain design.

## Documentation Map

Application layer:

- [runtime-dependency.md](runtime-dependency.md) - boundary between this app and `@teqfw/github-flows`;
- [workspace.md](workspace.md) - filesystem workspace, `cfg/`, logs, and protected static links;
- [trigger-attributes.md](trigger-attributes.md) - base and application-provided trigger attributes;
- [setup/README.md](setup/README.md) - deployment guides.

Runtime package layer:

- `node_modules/@teqfw/github-flows/docs/overview.md`

Use that overview as the stable entry point for the runtime package. Follow the
runtime package documentation map from there.

## Operating Rule

Use this app to host the runtime.

Use `@teqfw/github-flows` profiles to describe event-to-execution routing.

Use GitHub repository events to connect multiple automation stages.
