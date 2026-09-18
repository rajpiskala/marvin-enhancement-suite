# AMO source-code build instructions

This archive contains the original, human-readable TypeScript, CSS, HTML, and configuration used to build Marvin Enhancement Suite. The submitted Firefox package is produced by WXT and Vite, so the generated runtime bundle is accompanied by this source archive.

## Build environment

- Windows, macOS, or Linux.
- Node.js 22.13.0 or newer. The release was verified with Node.js 24.13.0.
- npm 10 or newer.
- Internet access is required only while `npm ci` downloads the exact dependencies recorded in `package-lock.json`.

No global packages, credentials, browser profile, or native build tools are required.

## Reproduce the submitted Firefox package

From the extracted source archive, run:

```text
npm ci
npm run build-for-amo
```

That command validates TypeScript, builds Chrome and Firefox, runs Mozilla's add-on linter with warnings treated as errors, creates both browser archives and the reviewer source archive, and verifies every manifest and archived byte. The repository's tests run before a release is packaged; they are not required to reproduce the submitted runtime.

The Firefox package is written to:

```text
.output/marvin-enhancement-suite-&lt;version&gt;-firefox.zip
```

The source archive is written to:

```text
.output/marvin-enhancement-suite-&lt;version&gt;-sources.zip
```

The Chrome archive is also generated from the same source, but it is not part of the AMO submission.
