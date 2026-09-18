# Store listing

This is the canonical copy-and-paste source for the Chrome Web Store and Firefox Add-ons dashboards.

## Name

Marvin Enhancement Suite

## Summary

Fix Amazing Marvin browser bugs and add opt-in workflow tools.

## Description

Amazing Marvin is great. A few stubborn browser bugs are not. Marvin Enhancement Suite bundles small fixes and optional workflow tools into one extension, with every module controlled from a compact toolbar popup.

Two conservative fixes start on: MES prevents Marvin's delayed autocomplete cleanup from leaving internal markup in task titles, and it adds the exact start date to Marvin's “days procrastinated” tooltip. You can turn either one off at any time.

Three optional tools start off:

- Override Marvin's auto-detected estimate with the explicit estimate after `~`, so “Watch the 4 Hour Race ~1h” stays a 1-hour task.
- Mark every subtask done or undone from a hovered task with Alt+Shift+D.
- Turn “Watch lecture part (1/6) ~30m” into six numbered tasks. An optional start time is offset for each new part, with duplicate protection, confirmation for large runs, and best-effort undo.

MES works only on the Amazing Marvin web app. It has no analytics, advertising, telemetry, or maintainer-operated server. Four modules run entirely in the browser. Task Unroller is the only feature that needs API credentials; it is off by default, asks separately for Marvin API access, and sends requests directly to Amazing Marvin only after you enable and configure it.

No browser restart is needed after a setting change. MES reloads open Marvin tabs for you.

Marvin Enhancement Suite is an independent community project and is not produced, sponsored, or endorsed by Amazing GmbH.

## Categories and links

- Chrome category: Productivity
- Firefox category: Other
- Homepage: `https://github.com/rajpiskala/marvin-enhancement-suite`
- Support: `https://github.com/rajpiskala/marvin-enhancement-suite/issues`
- Privacy: `https://github.com/rajpiskala/marvin-enhancement-suite/blob/main/PRIVACY.md`
- License: MIT
- Mature content: No
- Paid features: No

## Chrome privacy practices

Single purpose: improve the Amazing Marvin web app with user-controlled compatibility fixes and closely related workflow tools.

Data handled:

- Website content: task titles, task metadata, and task UI state are processed locally to provide enabled features. Task Unroller sends only the requested task operations to Amazing Marvin's own API.
- Authentication information: optional Marvin API and full-access tokens are stored in extension-local storage and sent only to Amazing Marvin when Task Unroller runs.

Certifications:

- Data is used only to provide the extension's user-facing purpose.
- Data is not sold or transferred for advertising, credit, or unrelated purposes.
- No human maintainer can read the data through MES.
- No analytics or telemetry is collected.
- Network transmission uses HTTPS and goes directly to Amazing Marvin.

Permission explanations:

- `storage`: remembers module settings and optional Task Unroller credentials in this browser profile.
- `https://app.amazingmarvin.com/*`: runs the selected fixes and tools only inside Marvin's web app.
- Optional `https://serv.amazingmarvin.com/*`: requested only when Task Unroller is enabled so it can create, update, and undo tasks through Marvin's API.

## Firefox data declaration

- Required: none. The four DOM-based modules do not transmit data outside the browser.
- Optional `authenticationInfo`: requested with Task Unroller because it uses user-provided Marvin API credentials.
- Optional `websiteContent`: requested with Task Unroller because task titles and related fields are sent directly to Marvin's API for the operation the user invokes.

## Reviewer notes

The extension runs only at `https://app.amazingmarvin.com/`. On first install, Autocomplete Cleanup and Procrastination Date are enabled; Explicit Durations, Toggle All Subtasks, and Task Unroller are disabled.

Suggested test:

1. Sign in to Amazing Marvin and open the extension popup.
2. Expand **Show options** and toggle any module. The setting saves immediately and open Marvin tabs reload; no browser restart is required.
3. Enable Task Unroller. The browser requests optional access to `https://serv.amazingmarvin.com/*`; Firefox also requests optional `authenticationInfo` and `websiteContent` data consent.
4. Expand **Task Unroller setup** to see that credentials are requested only for that feature. Credentials are stored in extension-local storage and never inserted into page-world code.

There is no remote executable code, analytics, telemetry, advertising, or maintainer-operated network service. The submitted runtime is bundled from the accompanying human-readable source archive; exact reproduction instructions are in `docs/amo-source-submission.md`.

## Artwork

- Store icon: `store-assets/icon-128.png`
- Main screenshot: `store-assets/screenshot-popup-1280x800.png`
- Chrome small promo tile: `store-assets/promo-small-440x280.png`
- Optional Chrome marquee: `store-assets/promo-marquee-1400x560.png`

The screenshot should show the actual expanded popup at readable scale with the two default-on fixes and three default-off tools visible. Avoid task data or credentials. Promo art should use MES teal and the MES icon without Marvin logos or visual claims of official affiliation.
