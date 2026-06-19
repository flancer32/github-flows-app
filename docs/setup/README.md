# Setup Guides

- Path: `docs/setup/README.md`
- Version: `20260514`

## Purpose

This directory groups deployment and operations guides for
`@flancer32/github-flows-app`.

These guides describe how to run the application host. They do not define
runtime trigger semantics, profile matching, or agent behavior.

## Recommended Ubuntu Reading Order

Read the Ubuntu setup documents in this order:

1. [ubuntu/os.md](ubuntu/os.md) - base Ubuntu packages, runtime user, Docker access, `nvm`, and Node.js.
2. [ubuntu/docker.md](ubuntu/docker.md) - Codex agent Docker image built from this repository.
3. [ubuntu/app.md](ubuntu/app.md) - application clone, `.env`, workspace, `systemd`, and log rotation.
4. [ubuntu/apache.md](ubuntu/apache.md) - HTTPS reverse proxy, `/webhooks/github`, and protected static access to logs/config.
5. [ubuntu/auth.md](ubuntu/auth.md) - GitHub token and Codex authentication mounted into isolated agent containers.

## Setup Boundary

The setup layer prepares:

- the operating-system user;
- Docker access;
- Node.js runtime;
- application process management;
- public HTTPS ingress;
- credential storage for selected agent runs.

In the runtime startup model, credential and workspace preparation is split
between:

- host-side `hostScript` before container launch;
- container-side `setupScript` after container launch.

These setup guides focus on the host-owned half of that model: where long-lived
secrets live, how temporary execution-scoped artifacts are prepared, and what
may be mounted into a selected agent container.

The runtime package still owns:

- event admission;
- trigger matching;
- profile selection;
- execution workspace creation and per-run launch preparation;
- `hostScript` and `setupScript` ordering;
- agent launch semantics.

For runtime profile configuration, start with:

```text
node_modules/@teqfw/github-flows/docs/overview.md
```

Follow the runtime package documentation map for the current profile setup
guides.

For application-provided trigger attributes, read
[../trigger-attributes.md](../trigger-attributes.md).

## Deployment Shape

The documented Ubuntu deployment uses this shape:

```text
GitHub webhook
  -> Apache HTTPS virtual host
  -> http://127.0.0.1:5020/webhooks/github
  -> github-flows-app
  -> @teqfw/github-flows
```

The Node.js application should listen on localhost. Apache should expose only
the public HTTPS surface and proxy the fixed webhook path to the local service.

Protected static links such as `web/log` and `web/cfg` may be exposed for
read-only operational inspection when guarded by HTTP Basic Authentication.
