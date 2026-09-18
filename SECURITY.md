# Security policy

## Reporting a vulnerability

Do not include Amazing Marvin tokens, private task data, screenshots containing personal information, or account credentials in a public issue.

For a suspected credential leak or data-changing vulnerability, contact the maintainer privately through the security contact configured on the eventual GitHub repository. Until that channel exists, keep the report local and do not publish exploit details.

## Design constraints

- No remotely hosted executable code.
- No analytics or third-party telemetry.
- No API credentials in page-world scripts, DOM attributes, logs, URLs, or error messages.
- No wildcard host permissions.
- Full-access API operations are restricted to the fields Task Unroller requires.
- Data-changing modules are disabled by default and must fail closed.
- Compatibility failures in one module must not prevent other modules or Marvin itself from loading.

## Supported versions

Only the latest MES development revision is supported before the first public release.
