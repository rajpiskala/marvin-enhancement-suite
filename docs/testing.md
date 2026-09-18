# Testing

`npm run check` is the regular development gate. It performs:

1. WXT and TypeScript validation.
2. Node regression tests for all five page modules and the popup contract.
3. Vitest coverage for settings, permissions, API validation, and security boundaries.
4. Production Chrome Manifest V3 and Firefox builds.
5. Mozilla `web-ext lint` with warnings treated as errors.
6. Built-manifest assertions for both browsers.

`npm run release` starts from a clean WXT output, runs the complete gate, creates versioned Chrome, Firefox, and AMO source ZIP files, and verifies:

- manifest versions, IDs, permissions, and Firefox data-consent declarations;
- exact ZIP/unpacked byte parity and safe archive paths;
- complete 16, 32, 48, and 128 pixel icon sets;
- absence of remotely loaded or dynamically evaluated runtime code; and
- exclusion of credentials, `.env` files, build output, and development-only files from the source archive.

## Browser QA

Before a store submission, test the unpacked Chrome build and the temporary Firefox build on the current stable releases. Verify the popup collapsed and expanded, toggle every module, confirm Marvin tabs reload without a browser restart, and check Task Unroller's permission, credential, large-run confirmation, and undo paths.

Live Marvin test tasks should use a unique `MES-E2E-` prefix and be removed after testing. Automated DOM tests cannot prove compatibility with every future Marvin React build, so a real-account smoke pass remains part of release QA.
