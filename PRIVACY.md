# Privacy

Marvin Enhancement Suite does not include analytics, advertising, telemetry, or a maintainer-operated server. The maintainer does not receive, sell, or share your task data, credentials, settings, or extension usage.

## Data handled by the extension

MES runs only on `https://app.amazingmarvin.com/*`. Enabled modules may read task titles, task metadata, page structure, and Marvin's browser-local task state in order to provide their visible behavior. This processing stays in your browser for Autocomplete Cleanup, Procrastination Date, Explicit Durations, and Toggle All Subtasks.

Task Unroller is disabled by default. If you enable it, MES separately requests access to `https://serv.amazingmarvin.com/*`. You may then provide a Marvin API token and full-access token. The extension stores those credentials in extension-local storage and sends them only to Amazing Marvin's API over HTTPS when it performs the task operation you requested.

For Firefox, Task Unroller also requests the optional `authenticationInfo` and `websiteContent` data permissions. Those labels cover the Marvin credentials and task fields sent directly to Marvin's API. The four local-only modules do not require those permissions.

## Data stored on your device

MES stores:

- the master pause state and five module toggles;
- optional Marvin API credentials for Task Unroller; and
- bounded Task Unroller receipts containing task identifiers, affected titles, timestamps, and operation state for duplicate protection and best-effort undo.

MES does not use cookies, fingerprinting, analytics identifiers, or cross-site tracking.

## Retention and deletion

Settings and optional credentials remain in extension-local storage until you clear them or remove the extension. Task Unroller credentials can be cleared from its popup setup section. Removing MES deletes extension-local settings and credentials. Task receipts stored with Marvin's site data can be removed with the browser's site-data controls.

Tasks created or changed in Amazing Marvin remain in your Marvin account until you edit or delete them there.

## Limited use

Information MES can access is used only to provide its user-facing Amazing Marvin fixes and tools. It is not used for advertising, credit decisions, profiling, or unrelated purposes, and it is not made available for human review by the maintainer.

## Contact

Report privacy questions through the repository's issue tracker without including credentials, private task text, or personal screenshots. Report sensitive security issues through the private channel described in [SECURITY.md](SECURITY.md).
