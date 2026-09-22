# Marketplace written copy

This is the source of truth for the substantial prose in the Chrome Web Store and Firefox Add-ons listings. The shared product copy is used in both stores. Short form choices such as category, license, pricing, and distribution stay in [store-listing.md](store-listing.md).

## Shared product copy

### Summary

Fix stubborn Amazing Marvin browser bugs and add practical, opt-in workflow upgrades.

### Full description

If you use Amazing Marvin a lot, you have probably run into a few small browser bugs that are surprisingly good at interrupting your flow. I originally built Marvin Enhancement Suite (MES) because the same issues kept getting in the way of my own workflow. Rather than manage a pile of separate Tampermonkey scripts, MES puts the fixes in one lightweight extension and gives every module its own toggle.

Two conservative bug fixes start enabled:

- **Fix autocomplete text left in task titles.** Marvin can occasionally save its internal autocomplete markup into a task name if you backspace, edit, or submit the task before its delayed cleanup finishes. MES makes that cleanup happen safely and immediately.
- **Show when procrastination started.** Marvin tells you how many days a task has been procrastinated. MES adds the actual start date to the same hover tooltip, so you do not have to work it out yourself.

Three optional workflow upgrades start disabled:

- **Override Marvin auto-detected time estimates.** Marvin can read a duration from the words in a title, even when that duration is part of the name. With this enabled, "Watch the 4 Hour Race ~1h" stays a one-hour task because the explicit "~1h" wins.
- **Mark all subtasks done or undone.** Hover the parent task and press **Alt+Shift+D** to move every subtask together.
- **Turn one long task into smaller parts.** A single three-hour task can feel weirdly unsatisfying. Write "Watch a really long lecture part (1/6) ~30m", and Task Unroller creates parts "(2/6)" through "(6/6)" for you. If the title starts with "3:00pm", the generated parts begin at "3:30pm", "4:00pm", and so on.

Every setting auto-saves. MES reloads open Marvin tabs when needed, so there is no browser restart after you change an option.

Four modules run entirely inside the browser. Task Unroller is the only feature that needs Marvin API credentials, and it stays off until you choose to enable and configure it. Those requests go directly from the extension to Amazing Marvin.

MES works with Amazing Marvin's web app and browser-installed PWA. It does not run inside Marvin's native desktop or mobile apps. It has no analytics, ads, telemetry, or maintainer-operated server.

Marvin Enhancement Suite is an independent, open-source community project. It is not produced, sponsored, or endorsed by Amazing GmbH.

## Chrome Web Store

### Single-purpose description

MES has one purpose: make Amazing Marvin's web app more reliable and easier to use through user-controlled bug fixes and closely related workflow tools.

### Storage permission justification

The storage permission remembers which modules the user enabled and, only if they configure Task Unroller, keeps their Marvin credentials in local extension storage. MES does not send settings or credentials to any maintainer-operated service.

### Host permission justification

Access to https://app.amazingmarvin.com/* lets the selected fixes and tools run only inside Marvin's web app. Optional access to https://serv.amazingmarvin.com/* is requested only when the user enables Task Unroller, so it can create, update, and undo tasks directly through Amazing Marvin's API.

### Test instructions

Thanks for reviewing MES! It runs only at https://app.amazingmarvin.com/. Sign in with any Marvin test account, then open the MES toolbar popup. Two fixes start enabled and three optional tools start disabled. Toggle any module to test auto-save; open Marvin tabs reload without a browser restart. Task Unroller alone needs the reviewer's own Marvin API credentials. Enabling it demonstrates the optional host-permission flow. MES has no remote code, analytics, telemetry, or ads.

## Firefox Add-ons

### Privacy policy

Marvin Enhancement Suite is designed to be private by default. It does not include analytics, advertising, telemetry, cross-site tracking, or a maintainer-operated server. I do not receive, sell, or share your task data, credentials, settings, or extension usage.

#### Data handled by the extension

MES runs only on https://app.amazingmarvin.com/*. Enabled modules may read task titles, task metadata, page structure, and Marvin's browser-local task state to provide the behavior you turned on.

Four modules keep that processing inside your browser: Fix autocomplete text left in task titles, Show when procrastination started, Override Marvin auto-detected time estimates, and Mark all subtasks done or undone.

Task Unroller is disabled by default. If you enable it, MES separately asks for access to https://serv.amazingmarvin.com/*. You may then provide a Marvin API token and full-access token. MES stores those credentials in extension-local storage and sends them only to Amazing Marvin's API over HTTPS when it performs the task operation you requested.

On Firefox, Task Unroller also asks for the optional authenticationInfo and websiteContent data permissions. Those labels cover the Marvin credentials and task fields sent directly to Marvin's API. The four local-only modules do not need those permissions.

#### Data stored on your device

MES stores:

- the master pause state and five module toggles;
- optional Marvin API credentials for Task Unroller; and
- a bounded set of Task Unroller receipts containing task identifiers, affected titles, timestamps, and operation state for duplicate protection and best-effort undo.

MES does not use cookies, fingerprinting, analytics identifiers, or cross-site tracking.

#### Retention and deletion

Settings and optional credentials remain in extension-local storage until you clear them or remove the extension. You can clear Task Unroller credentials from its popup setup section. Removing MES deletes its extension-local settings and credentials. You can remove Task Unroller receipts stored with Marvin's site data through the browser's site-data controls.

Tasks created or changed in Amazing Marvin remain in your Marvin account until you edit or delete them there.

#### Limited use

MES uses the information it can access only to provide the Amazing Marvin fixes and tools you enabled. It is not used for advertising, credit decisions, profiling, or unrelated purposes, and it is not made available for human review by the maintainer.

#### Contact

Please report privacy questions through the [GitHub issue tracker](https://github.com/rajpiskala/marvin-enhancement-suite/issues) without including credentials, private task text, or personal screenshots. For a sensitive security issue, use the private channel described in [SECURITY.md](https://github.com/rajpiskala/marvin-enhancement-suite/blob/main/SECURITY.md).

### Notes to reviewer

Thanks so much for reviewing MES!

The extension runs only at https://app.amazingmarvin.com/. On first install, **Fix autocomplete text left in task titles** and **Show when procrastination started** are enabled. The other three tools are disabled.

Suggested test:

1. Sign in to Amazing Marvin and open the extension popup.
2. Expand **Show options** and toggle any module. The setting saves immediately and open Marvin tabs reload. No browser restart is required.
3. Enable **Task Unroller**. Firefox asks for optional access to https://serv.amazingmarvin.com/* along with the optional authenticationInfo and websiteContent data permissions.
4. Expand **Task Unroller setup**. Credentials are requested only for that feature, remain in extension-local storage, and are never inserted into page-world code.

There is no remote executable code, analytics, telemetry, advertising, or maintainer-operated network service.

The submitted runtime is bundled from the accompanying human-readable source archive. To reproduce it, use Node.js 22.13 or newer and npm 10 or newer, then run:

~~~console
npm ci
npm run build-for-amo
~~~

Exact reproduction instructions are in docs/amo-source-submission.md, and package-lock.json pins the complete dependency tree.