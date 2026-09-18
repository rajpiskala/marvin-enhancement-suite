<p align="center">
  <img src="public/icons/icon-128.png" alt="Marvin Enhancement Suite icon" width="112" height="112">
</p>

<h1 align="center">Marvin Enhancement Suite</h1>

<p align="center"><strong>Fix the rough edges. Keep the Marvin workflow you like.</strong></p>

<p align="center">
  <a href="https://github.com/rajpiskala/marvin-enhancement-suite/actions/workflows/ci.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/rajpiskala/marvin-enhancement-suite/ci.yml?branch=main&amp;style=flat-square"></a>
  <img alt="Chrome and Firefox" src="https://img.shields.io/badge/browsers-Chrome%20%7C%20Firefox-1CC5CB?style=flat-square">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
  <a href="https://github.com/sponsors/rajpiskala"><img alt="Sponsor on GitHub" src="https://img.shields.io/github/sponsors/rajpiskala?logo=githubsponsors&amp;style=flat-square"></a>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#privacy-and-permissions">Privacy</a> ·
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="docs/assets/mes-popup.png" alt="The Marvin Enhancement Suite popup with its five independently toggleable modules">
</p>

Marvin Enhancement Suite (MES) is an unofficial browser extension that bundles conservative bug fixes and opt-in workflow tools for the [Amazing Marvin](https://amazingmarvin.com/) web app. Every module—including default-on fixes—can be disabled from the toolbar popup. Changes apply by reloading open Marvin tabs; a browser restart is never required.

MES is independent and is not produced, sponsored, or endorsed by Amazing GmbH.

## Features

| Module | Default | What it does |
| --- | --- | --- |
| Clean up broken task titles | On | Keeps Marvin's autocomplete formatting out of task names when Enter is pressed quickly. |
| Show when procrastination started | On | Adds the exact start date to Marvin's “days procrastinated” tooltip. |
| Prefer explicit time estimates | Off | Only text after `~` sets an estimate, so `Watch the 4 Hour Race ~1h` stays a 1-hour task. |
| Complete or reopen all subtasks | Off | Changes every subtask at once with `Alt+Shift+D`. |
| Create a task series from one template | Off | Expands numbered task templates with limits, duplicate protection, confirmation, and best-effort undo. |

Task Unroller is the only module that needs Marvin API credentials. Its setup appears inside the popup only when you want it; MES never blocks first launch or unrelated features on an API key.

## Installation

Chrome Web Store and Firefox Add-ons releases are being prepared. Store links will replace this note after the first reviews are complete.

To test the current source build:

```console
npm ci
npm run release
```

- Chrome or Edge: open the extensions page, enable Developer mode, choose **Load unpacked**, and select `.output/chrome-mv3`.
- Firefox: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `.output/firefox-mv2/manifest.json`.

Temporary Firefox add-ons are removed when Firefox restarts.

## Browser support

- Chrome and Chromium desktop browsers: Manifest V3.
- Firefox desktop 140 or newer: Manifest V2.
- Amazing Marvin's native desktop and mobile apps: not supported.
- Firefox Android: not currently supported or listed.

## Privacy and permissions

MES has no analytics, advertising, telemetry, remote code, or maintainer-operated server. Its required access is limited to Amazing Marvin's web app.

Four modules process task UI information locally. Task Unroller is off by default and separately requests access to Marvin's API. Its optional credentials stay in extension-local storage and requests go directly to Amazing Marvin over HTTPS.

See [PRIVACY.md](PRIVACY.md) for the complete data-handling explanation and [SECURITY.md](SECURITY.md) for the security model.

## Development

Requirements: Node.js 22.13 or newer and npm 10 or newer.

```console
npm ci
npm run check
```

`npm run release` adds Mozilla linting, versioned Chrome and Firefox packages, an AMO reviewer source archive, and byte-for-byte artifact verification. See [testing](docs/testing.md), [publishing](docs/publishing.md), and [contributing](CONTRIBUTING.md) for the short operational guides.

## Support

If this project saved you some time, fixed something annoying, or made your workflow a little better, you can [sponsor my open-source work](https://github.com/sponsors/rajpiskala). Everything here stays free and open source. 💗

## License

[MIT](LICENSE)
