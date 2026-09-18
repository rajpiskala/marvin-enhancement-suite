# Contributing

Bug reports and focused pull requests are welcome. Marvin changes frequently, so a useful report includes:

- the affected MES module;
- Chrome, Edge, or Firefox and its version;
- what you expected and what happened;
- the relevant Marvin view or strategy; and
- a screenshot or minimal reproduction with private task information removed.

Before opening a pull request, run:

```console
npm ci
npm run check
```

Changes to page-world modules should include a regression test. Changes to permissions, data handling, or network behavior must also update `PRIVACY.md`, `amo-metadata.json`, and the store-listing notes.

Never include Marvin credentials, real task data, browser profiles, build output, or `.env` files in a commit or issue.
