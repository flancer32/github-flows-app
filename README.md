# github-flows-app

`@flancer32/github-flows-app` is a ready-to-run host application for
`@teqfw/github-flows`.

The application starts the Node.js process, loads local runtime configuration,
registers the application-provided event attribute provider, serves the fixed
GitHub webhook ingress from the runtime package, and exposes a read-only static
operational surface from `web/`.

It does not define workflow semantics. Event admission, trigger matching,
profile selection, execution context creation, and agent startup semantics are
owned by `@teqfw/github-flows`.

## Reading Order

Read the documentation from the application layer down to the runtime package:

1. [docs/overview.md](docs/overview.md) - application role, boundaries, and navigation.
2. [docs/runtime-dependency.md](docs/runtime-dependency.md) - how this app depends on `@teqfw/github-flows`.
3. [docs/workspace.md](docs/workspace.md) - runtime workspace, `cfg/`, logs, and static inspection links.
4. [docs/trigger-attributes.md](docs/trigger-attributes.md) - base trigger attributes and app-provided additional attributes.
5. [docs/setup/README.md](docs/setup/README.md) - deployment and operating-system setup guides.

For the underlying runtime model, start with the `@teqfw/github-flows`
overview published with the dependency:

- `node_modules/@teqfw/github-flows/docs/overview.md`

## Quick Start

Clone the repository and enter the project directory:

```bash
git clone https://github.com/flancer32/github-flows-app.git .
```

Create a `.env` file from the provided template:

```bash
cp .env.example .env
```

Set the local runtime values:

```env
HOST=127.0.0.1
PORT=5020
WORKSPACE_ROOT=./var/work
LOG_RETENTION_DAYS=30
WEBHOOK_SECRET=replace-with-shared-secret
```

Install dependencies and start the application:

```bash
npm i
npm start
```

The GitHub webhook endpoint is:

```text
/webhooks/github
```

Configure GitHub to send webhooks to the public URL that proxies this path to
the local application.

## Runtime Workspace

The application passes `WORKSPACE_ROOT` to `@teqfw/github-flows`.

When `LOG_RETENTION_DAYS` is configured, the host application runs archival log
cleanup once during startup and then repeats it every hour.

The important runtime directories are:

```text
WORKSPACE_ROOT/
  cfg/    profile fragments and prompts consumed by @teqfw/github-flows
  log/    event archives, run logs, and observational indexes
```

Profile configuration under `cfg/` follows the runtime package model, not an
application-specific model. Start with [docs/workspace.md](docs/workspace.md)
and then read the runtime package profile documentation.

## Application-Provided Trigger Attributes

The runtime package provides base trigger attributes such as `event`,
`repository`, `action`, and optional `actorLogin`.

This application additionally registers one host-side attribute provider. It
adds factual attributes derived from the current webhook payload:

- payload size flags: `sizeLess10K`, `sizeLess100K`, `sizeLess1M`, `sizeLess2M`
- issue attributes: `issueLabelAdded`, `issueLabelRemoved`, `issueAuthorRequestedNoAgent`
- pull request attributes: `pullRequestLabelAdded`, `pullRequestLabelRemoved`, `pullRequestMerged`

Use [docs/trigger-attributes.md](docs/trigger-attributes.md) for the exact
attribute contract and examples.

## Deployment

Ubuntu deployment guides are grouped under [docs/setup/README.md](docs/setup/README.md).

The usual order is:

1. prepare the runtime user and Node.js environment;
2. build the Codex agent Docker image;
3. deploy and configure this application;
4. configure Apache as the public HTTPS proxy;
5. configure GitHub and Codex credentials for isolated agent runs.
