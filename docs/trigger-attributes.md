# Trigger Attributes

- Path: `docs/trigger-attributes.md`
- Version: `20260601`

## Purpose

This document describes attributes that may be used in `trigger` blocks when
running `@teqfw/github-flows` through `@flancer32/github-flows-app`.

The runtime package supplies base attributes.

This application supplies additional host-provided attributes through the
runtime package attribute-provider extension point.

## Attribute Sources

For one admitted GitHub event, trigger matching can use:

| Source | Owner | Examples |
| --- | --- | --- |
| Base attributes | `@teqfw/github-flows` | `event`, `repository`, `action`, `actorLogin` |
| Additional attributes | `@flancer32/github-flows-app` | `sizeLess100K`, `issueLabelAdded`, `issueAuthorRequestedNoAgent`, `pullRequestMerged` |

The application-provided attributes are factual values derived from the current
webhook payload only. They do not grant execution permission and do not replace
base attributes.

Profile selection remains owned by `@teqfw/github-flows`.

## Base Runtime Attributes

The runtime package provides these base trigger attributes:

| Attribute | Type | Meaning |
| --- | --- | --- |
| `event` | string | GitHub event name, such as `issues` or `pull_request` |
| `repository` | string | Repository full name, such as `owner/repository` |
| `action` | string | GitHub event action, such as `opened`, `labeled`, or `created` |
| `actorLogin` | string | Initiating actor login when available from the admitted event |

Example:

```json
{
  "trigger": {
    "repository": "owner/repository",
    "event": "issues",
    "action": "opened"
  }
}
```

For the full runtime package description, start with:

```text
node_modules/@teqfw/github-flows/docs/overview.md
```

Follow the documentation map in that package for the current base-attribute and
profile-matching guide.

## Application-Provided Size Attributes

The application always returns payload-size flags:

| Attribute | Type | Value is `true` when |
| --- | --- | --- |
| `sizeLess10K` | boolean | serialized current payload size is less than `10,000` bytes |
| `sizeLess100K` | boolean | serialized current payload size is less than `100,000` bytes |
| `sizeLess1M` | boolean | serialized current payload size is less than `1,000,000` bytes |
| `sizeLess2M` | boolean | serialized current payload size is less than `2,000,000` bytes |

Thresholds are strict. A payload of exactly `10,000` bytes makes
`sizeLess10K` equal to `false`.

The measurement is based on the full current webhook payload, not only issue
body, pull-request body, comments, prompts, or profile files.

Example:

```json
{
  "trigger": {
    "repository": "owner/repository",
    "event": "issues",
    "action": "opened",
    "sizeLess100K": true
  }
}
```

Use size flags only as coarse routing facts for the current event. Do not use
them as a replacement for agent-side validation or GitHub API checks.

## Application-Provided Issue Attributes

The application may return issue attributes for `issues` events:

| Attribute | Type | Present when |
| --- | --- | --- |
| `issueLabelAdded` | string | `event` is `issues`, payload action is `labeled`, and `payload.label.name` is a string |
| `issueLabelRemoved` | string | `event` is `issues`, payload action is `unlabeled`, and `payload.label.name` is a string |
| `issueAuthorRequestedNoAgent` | boolean | `event` is `issues`, payload action is `opened`; value is `true` when `payload.issue.labels` contains a label object whose `name` is exactly `adsm:no-agent`, otherwise `false` |

The value is the exact label name from the webhook payload. Case, spacing, and
punctuation are preserved.

The application does not derive these attributes from the current full label
list on the issue. It uses only the label object attached to the current
`labeled` or `unlabeled` webhook event.

`issueAuthorRequestedNoAgent` is a factual attribute derived from the current
issue label set present in the `issues.opened` payload. It does not describe a
host-side execution decision. Missing, empty, or malformed
`payload.issue.labels` is treated as absence of the label and yields `false`
within the `issues.opened` scope.

Example for a label-added trigger:

```json
{
  "trigger": {
    "repository": "owner/repository",
    "event": "issues",
    "action": "labeled",
    "issueLabelAdded": "needs-spec"
  }
}
```

Example for a label-removed trigger:

```json
{
  "trigger": {
    "repository": "owner/repository",
    "event": "issues",
    "action": "unlabeled",
    "issueLabelRemoved": "needs-spec"
  }
}
```

Example for an issue-opened trigger that excludes issues created with
`adsm:no-agent`:

```json
{
  "trigger": {
    "repository": "owner/repository",
    "event": "issues",
    "action": "opened",
    "issueAuthorRequestedNoAgent": false
  }
}
```

`issueLabelAdded` and `issueLabelRemoved` are omitted for non-`issues` events,
non-label issue actions, missing label objects, or non-string `label.name`
values.

`issueAuthorRequestedNoAgent` is omitted outside `issues.opened`.

## Application-Provided Pull Request Attributes

The application may return pull request attributes for `pull_request` events:

| Attribute | Type | Present when |
| --- | --- | --- |
| `pullRequestLabelAdded` | string | `event` is `pull_request`, payload action is `labeled`, and `payload.label.name` is a string |
| `pullRequestLabelRemoved` | string | `event` is `pull_request`, payload action is `unlabeled`, and `payload.label.name` is a string |
| `pullRequestMerged` | boolean | `event` is `pull_request`, payload action is `closed`, and `payload.pull_request.merged` is a boolean |

The label attribute value is the exact label name from the webhook payload.
Case, spacing, and punctuation are preserved.

The application does not derive pull request label attributes from the current
full label list on the pull request. It uses only the label object attached to
the current `labeled` or `unlabeled` webhook event.

`pullRequestMerged` uses `payload.pull_request.merged` from the current
`closed` webhook event.

These attributes are omitted when the required payload structure is absent or
has the wrong type. They are also omitted for non-`pull_request` events and
non-matching pull request actions.

Example for a pull request label-added trigger:

```json
{
  "trigger": {
    "repository": "owner/repository",
    "event": "pull_request",
    "action": "labeled",
    "pullRequestLabelAdded": "needs-spec"
  }
}
```

Example for a pull request label-removed trigger:

```json
{
  "trigger": {
    "repository": "owner/repository",
    "event": "pull_request",
    "action": "unlabeled",
    "pullRequestLabelRemoved": "needs-spec"
  }
}
```

Example for a merged pull request trigger:

```json
{
  "trigger": {
    "repository": "owner/repository",
    "event": "pull_request",
    "action": "closed",
    "pullRequestMerged": true
  }
}
```

Pull request attributes are derived only from the current webhook payload. They
do not grant execution permission and do not replace base attributes such as
`event`, `repository`, or `action`.

## Recommended Trigger Shape

Use base attributes first:

```json
{
  "trigger": {
    "repository": "owner/repository",
    "event": "issues",
    "action": "opened"
  }
}
```

Add application-provided attributes only when the base attributes are not
specific enough:

```json
{
  "trigger": {
    "repository": "owner/repository",
    "event": "issues",
    "action": "labeled",
    "issueLabelAdded": "adsm"
  }
}
```

Keep one profile focused on one event situation. If two label names or two size
classes need different prompts or runtime settings, create separate profiles
instead of embedding conditional logic in one prompt.

## Boundary Rules

Application-provided attributes:

- belong only to the current webhook event;
- are plain trigger-matching facts;
- are not execution permission;
- are not workflow state;
- must not be treated as cross-event memory;
- must not override `event`, `repository`, `action`, or `actorLogin`.

For multi-step automation, design each stage as a separate GitHub event handled
by runtime profile matching. Start with:

```text
node_modules/@teqfw/github-flows/docs/overview.md
```

Follow the runtime package documentation map for the current event-chain guide.
