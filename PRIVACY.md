# Privacy

Marvin Enhancement Suite does not include analytics, advertising, telemetry, or a MES-operated server.

## Data accessed

MES can access the Amazing Marvin web app at `https://app.amazingmarvin.com/*` in order to provide its advertised fixes and enhancements. Enabled modules may read task DOM state and Marvin's browser-local task database.

Task Unroller can optionally call `https://serv.amazingmarvin.com/*`. The browser requests that host permission only when the user enables the module.

## Data stored

MES stores these values in the browser extension's local storage:

- master enabled/paused state;
- per-module settings;
- optional Marvin API and full-access tokens used by Task Unroller.

Task Unroller stores bounded operation receipts in browser-local storage associated with the Marvin web app. Receipts contain task identifiers, affected titles, timestamps, and operation state so MES can prevent duplicate expansions and offer best-effort undo.

MES does not sell, share, or transmit this information to the project maintainer. API requests go directly from the extension to Amazing Marvin's API.

## Removal

Disabling or uninstalling MES stops its code. Removing the extension's browser data deletes its settings and stored credentials. Task-unroller receipts can be cleared through MES diagnostics in a future release or through the browser's site-data controls during development.
