# Marvin Enhancement Suite

Marvin Enhancement Suite (MES) is an unofficial browser extension that adds conservative compatibility fixes and opt-in workflow tools to the [Amazing Marvin](https://amazingmarvin.com/) web app.

MES is not affiliated with Amazing GmbH. It deliberately uses a separate name and visual identity from Marvin's official browser extension.

## Current modules

| Module | Group | Default | Status |
| --- | --- | --- | --- |
| Autocomplete cleanup race fix | Compatibility fix | On | Ported with regression tests |
| Exact procrastination start date | Compatibility fix | On | Uses the task's authoritative `firstScheduled` value |
| Explicit duration estimates only | Workflow enhancement | Off | Ported with regression tests |
| Toggle all subtasks | Workflow enhancement | Off | Hover a task (or one of its visible subtasks), then press `Alt+Shift+D` |
| Task unroller | Workflow enhancement | Off | Expansion cap, large-run confirmation, duplicate receipts, and best-effort undo |

Every module, including default-on fixes, can be disabled from the toolbar popup. The popup starts compact, expands its complete module list in place, auto-saves individual toggles, and also provides a master pause switch. Changes reload open Marvin tabs; they never require a browser restart.

Only Task Unroller needs Marvin API credentials. Its setup, credential status, and undo action live in a dedicated collapsible section within the popup; MES never blocks first launch or unrelated features on API setup.

AM/PM anomaly suggestions, habit/task linking, burndown collection, and the separate mobile shell are intentionally outside the initial extension.

## Browser support

- Chrome and other Chromium desktop browsers: primary target, Manifest V3.
- Firefox desktop: first-class target, currently built as Manifest V2 by WXT.
- Firefox Android: not yet validated.
- Native Amazing Marvin desktop and mobile applications: not supported.

## Safety model

- MES runs only on `https://app.amazingmarvin.com/*`.
- Compatibility fixes fail closed when expected Marvin internals cannot be found.
- Workflow-changing modules are off by default.
- Marvin API access is an optional permission requested only when Task Unroller is enabled.
- API credentials stay in extension-local storage and are never placed in Marvin's page context.
- The background worker accepts only a small allowlist of task-unroller operations and fields.
- Task Unroller limits one expansion to 50 tasks, asks for confirmation above 10, records partial progress, and blocks automatic retries after a receipt exists.

Read [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) for the complete policies.

## Development

Requirements: Node.js 20 or newer and npm.

```console
npm install
npm run check
```

Build outputs:

- Chrome/Chromium: `.output/chrome-mv3`
- Firefox: `.output/firefox-mv2`

Run a development build with:

```console
npm run dev
npm run dev:firefox
```

## Architecture

WXT produces both browser builds from one TypeScript codebase.

- The isolated content script reads extension settings and starts only enabled modules.
- Modules that must inspect Marvin's React instances are packaged main-world scripts.
- Task Unroller remains in the isolated extension world so its API bridge and credentials are not exposed to page scripts.
- The background worker validates a narrow request schema before calling Marvin's API.
- The toolbar popup owns all user-facing configuration and stores one versioned settings object.
- The self-contained popup uses Marvin-inspired teal and locally bundled Outfit typography; it does not load remote UI assets.

## Testing

`npm run check` performs:

1. TypeScript validation.
2. Regression and unit tests.
3. A production Chrome Manifest V3 build.
4. A production Firefox build.

Live E2E checks use a dedicated Amazing Marvin developer account. Test tasks must have a unique `MES-E2E-` prefix and be removed or clearly documented after verification.

## Support

If this project saved you some time, fixed something annoying, or made your workflow a little better, you can [sponsor my open-source work](https://github.com/sponsors/rajpiskala). Everything here stays free and open source. 💗

## License

[MIT](LICENSE)
