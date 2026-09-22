# Privacy

Marvin Enhancement Suite is designed to be private by default. It does not include analytics, advertising, telemetry, cross-site tracking, or a maintainer-operated server. I do not receive, sell, or share your task data, credentials, settings, or extension usage.

## Data handled by the extension

MES runs only on https://app.amazingmarvin.com/*. Enabled modules may read task titles, task metadata, page structure, and Marvin's browser-local task state to provide the behavior you turned on.

Four modules keep that processing inside your browser: Fix autocomplete text left in task titles, Show when procrastination started, Override Marvin auto-detected time estimates, and Mark all subtasks done or undone.

Task Unroller is disabled by default. If you enable it, MES separately asks for access to https://serv.amazingmarvin.com/*. You may then provide a Marvin API token and full-access token. MES stores those credentials in extension-local storage and sends them only to Amazing Marvin's API over HTTPS when it performs the task operation you requested.

On Firefox, Task Unroller also asks for the optional authenticationInfo and websiteContent data permissions. Those labels cover the Marvin credentials and task fields sent directly to Marvin's API. The four local-only modules do not need those permissions.

## Data stored on your device

MES stores:

- the master pause state and five module toggles;
- optional Marvin API credentials for Task Unroller; and
- a bounded set of Task Unroller receipts containing task identifiers, affected titles, timestamps, and operation state for duplicate protection and best-effort undo.

MES does not use cookies, fingerprinting, analytics identifiers, or cross-site tracking.

## Retention and deletion

Settings and optional credentials remain in extension-local storage until you clear them or remove the extension. You can clear Task Unroller credentials from its popup setup section. Removing MES deletes its extension-local settings and credentials. You can remove Task Unroller receipts stored with Marvin's site data through the browser's site-data controls.

Tasks created or changed in Amazing Marvin remain in your Marvin account until you edit or delete them there.

## Limited use

MES uses the information it can access only to provide the Amazing Marvin fixes and tools you enabled. It is not used for advertising, credit decisions, profiling, or unrelated purposes, and it is not made available for human review by the maintainer.

## Contact

Please report privacy questions through the [GitHub issue tracker](https://github.com/rajpiskala/marvin-enhancement-suite/issues) without including credentials, private task text, or personal screenshots. For a sensitive security issue, use the private channel described in [SECURITY.md](https://github.com/rajpiskala/marvin-enhancement-suite/blob/main/SECURITY.md).
