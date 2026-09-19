# Publishing

The first Chrome Web Store and Firefox Add-ons listings must be created and reviewed manually. After both listings exist, updates can use the guarded GitHub workflow or the equivalent local commands below.

Run `npm run marketplace:prepare` whenever you want a clean, upload-ready folder. It performs the full release verification and creates `.output/marketplace/` with separate Chrome and Firefox folders, listing copy, a step-by-step checklist, and SHA-256 checksums.

## Prepare the first listings

1. Make the GitHub repository public so the homepage, support, privacy, and source links work for store users.
2. Run `npm ci` and `npm run marketplace:prepare`.
3. Open `.output/marketplace/UPLOAD-CHECKLIST.md` and upload the files it maps to each store field.
4. Copy the descriptions, permission explanations, privacy answers, and reviewer notes from `.output/marketplace/LISTING.md`.
5. Record the Chrome extension ID and configure the store API credentials listed below.

## Release locally

```text
npm ci
npm run version:set -- 0.1.1
npm run marketplace:prepare
npm run submit:dry-run
```

Review `CHANGELOG.md`, `.output/marketplace/UPLOAD-CHECKLIST.md`, the files and checksums in `.output/marketplace/`, and a clean `git status` before removing `--dry-run`:

```text
npm run submit
```

Chrome submissions use `STAGED_PUBLISH`, so approval does not immediately release the build. Firefox listed submissions publish after Mozilla approval.

## GitHub Actions secrets

Create a protected GitHub environment named `extension-stores` and add:

| Secret | Purpose |
| --- | --- |
| `CHROME_EXTENSION_ID` | Existing Chrome Web Store item ID |
| `CHROME_PUBLISHER_ID` | Chrome Web Store API v2 publisher ID |
| `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | Service-account email authorized for the publisher |
| `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` | Service-account private key |
| `FIREFOX_EXTENSION_ID` | `marvin-enhancement-suite@rajpiskala` |
| `FIREFOX_JWT_ISSUER` | AMO API issuer |
| `FIREFOX_JWT_SECRET` | AMO API secret |

Require manual approval on the environment. The **Submit extension stores** workflow defaults to authentication-only dry run and uploads the verified artifacts for inspection. A maintainer must explicitly choose a real submission.

Never commit store credentials or put them in `.env` files that are shared, synced, or archived.

## Release checklist

- Version is new in `package.json`, `package-lock.json`, and `CHANGELOG.md`.
- `npm ci`, `npm audit --audit-level=high`, and `npm run release` pass.
- Chrome and Firefox smoke tests pass on live Marvin.
- Listing copy, permissions, privacy answers, and screenshots still match behavior.
- The release commit is pushed and the working tree is clean.
- Store dry run authenticates successfully.
- After acceptance, tag the submitted commit and create a GitHub Release with the verified ZIPs.
