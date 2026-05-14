# Runtime Dependency

- Path: `docs/runtime-dependency.md`
- Version: `20260514`

## Purpose

This document explains how `@flancer32/github-flows-app` depends on
`@teqfw/github-flows` and where the application boundary ends.

## Dependency Role

`@teqfw/github-flows` is the runtime library.

This application embeds the runtime library and supplies the surrounding service
environment:

- process lifecycle through `npm start` and `bin/cli.mjs`;
- runtime parameters loaded from `.env`;
- a filesystem workspace path;
- a static read-only operational surface;
- one application-provided event attribute provider;
- reverse-proxy-friendly HTTP binding.

The runtime library owns:

- GitHub webhook admission;
- admitted-event model creation;
- package-owned base trigger attributes;
- profile discovery under `workspaceRoot/cfg/`;
- profile matching and selection;
- execution context creation;
- isolated agent launch.

## Startup Relationship

At startup, the application:

1. resolves TeqFW DI namespaces;
2. loads `.env` values;
3. configures the runtime package;
4. registers the application event attribute provider;
5. registers the runtime webhook handler before the static file handler;
6. starts the runtime web server.

The webhook path is fixed by the runtime package:

```text
/webhooks/github
```

The application must not register a competing handler for this path.

## Configuration Boundary

Application configuration:

```text
.env
```

Runtime profile configuration:

```text
WORKSPACE_ROOT/cfg/
```

The application passes `WORKSPACE_ROOT` to the runtime package. It does not
interpret `profile.json` semantically and does not select profiles.

## Attribute Provider Boundary

The application registers one host-side event attribute provider through the
runtime package extension point.

The provider returns factual additional attributes for the current webhook event
only. These attributes may participate in runtime-owned trigger matching, but
they do not grant execution permission and do not override base attributes.

The exact application-provided attributes are documented in
[trigger-attributes.md](trigger-attributes.md).

For the base package contract, start with the runtime package overview:

```text
node_modules/@teqfw/github-flows/docs/overview.md
```

Follow the documentation map in that package for the current runtime-specific
profile, trigger, and event-chain guides.

## Runtime Documentation To Read Next

After this document, read [workspace.md](workspace.md) for the local filesystem
layout, then open:

```text
node_modules/@teqfw/github-flows/docs/overview.md
```

The runtime overview is the stable dependency entry point. It defines where the
current runtime package documents profile structure and how one GitHub event can
select zero or one execution profile.

## Non-Goals

This application is not:

- a workflow engine;
- a profile selection layer;
- a queue;
- a retry coordinator;
- a cross-event state store;
- a management API;
- an interactive control plane.

If a behavior changes whether an event should run an agent, it belongs in the
runtime package model or in profile configuration, not in the application host.
