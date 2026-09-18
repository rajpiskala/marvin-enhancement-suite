# Security policy

## Reporting a vulnerability

Please use [GitHub's private vulnerability report](https://github.com/rajpiskala/marvin-enhancement-suite/security/advisories/new) for credential exposure, unauthorized task changes, permission bypasses, or another sensitive issue.

Do not put Marvin tokens, private task data, screenshots containing personal information, or exploit details in a public issue.

## Design constraints

- No remotely hosted executable code.
- No analytics, advertising, or third-party telemetry.
- No API credentials in page-world scripts, DOM attributes, logs, URLs, or error messages.
- No wildcard host permissions.
- Required host access is limited to the Amazing Marvin web app.
- Marvin API access and Firefox data consent are requested only when Task Unroller is enabled.
- Background API operations accept only the narrow fields Task Unroller requires.
- Data-changing modules are disabled by default and fail closed.
- A failure in one module must not prevent Marvin or other MES modules from loading.

## Supported versions

Security fixes are applied to the latest released MES version. Before the first store release, only the latest revision on `main` is supported.
