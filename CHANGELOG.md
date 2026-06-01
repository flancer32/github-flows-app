# Changelog

## 0.2.0 - 2026-06-01 - No-agent issue routing

* Added `issueAuthorRequestedNoAgent` for `issues.opened` webhook payloads.
* Suppressed the normal `issues.opened` admission profile when `adsm:no-agent` is present.
* Updated release metadata and documentation for the new issue-opened routing fact.

## 0.1.0

- First working version of the application.
