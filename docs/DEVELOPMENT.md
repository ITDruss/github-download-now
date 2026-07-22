# Development guide

This guide answers the practical question: **which files should change for a particular feature or bug fix?** Read `ARCHITECTURE.md` first for runtime boundaries and security invariants.

## Common changes

### Add or adjust an asset format

Usually update:

- `src/asset-selector.js` — extension detection, ranking and compatibility;
- `src/install-guides.js` — post-download guidance when the format needs it;
- locale messages in `src/_locales/*/messages.json`;
- `tests/asset-selector.test.js` and `tests/install-guides.test.js`.

Do not add platform-specific ranking rules to content UI components.

### Adapt to a GitHub layout change

Choose the narrowest boundary:

- repository identity or visibility marker: `src/content/repository-context.js`;
- action controls or release-title DOM: `src/content/github-dom.js`;
- toolbar/flow/floating target selection: `src/content/placement.js`;
- Releases HTML parsing: `src/content/release/page-parser.js`;
- root replacement or density fallback: `src/content/mount-controller.js`.

Add a focused Node regression test and extend `tests/ui_smoke.py` when visual placement or interaction changes.

### Add a background operation

1. Add one canonical type to `src/shared/messages.js`.
2. Put the behavior in the appropriate `src/background/` service.
3. Route it in `src/background/message-router.js`.
4. Call it through `GHDNBrowser.runtime.sendMessage`.
5. Add service and routing tests.

Never duplicate a `"GHDN_*"` literal outside `shared/messages.js`.

### Add or change a setting

Usually update:

- `src/settings.js` — default and normalization;
- `src/options/form.js` — full form schema;
- `src/popup/settings-controller.js` when it is a quick setting;
- `src/options/strings.js` or `src/popup/strings.js` only for mapping locale keys;
- both locale catalogs;
- settings, options and popup tests.

### Change GitHub API behavior

- GET request mechanics, headers, limits and auth fallback: `src/background/github-client.js`;
- release response normalization and cache: `src/background/release-service.js`;
- build-document traversal: `src/background/build-service.js`;
- OAuth POST requests: `src/background/auth-service.js`.

Every URL must pass `src/url-policy.js` before network, navigation or download use.

### Add a translation

Follow `docs/TRANSLATING.md`. A normal translation must not require application-code changes.

## Add a source module

1. Use the existing IIFE/factory shape and expose one frozen `GHDN*` API.
2. Keep dependencies explicit through `create(options)` rather than reading unrelated globals.
3. Add the path to the correct ordered list in `scripts/project-structure.mjs`.
4. Update the manifest or extension-page HTML where the module runs.
5. Add a script tag to `tests/fixtures/demo.html` for a content-page module.
6. Add a dedicated `*.test.js` or `*.test.mjs` file.
7. Run the complete checks.

The build allowlist, syntax checker, manifest tests and architecture audit derive their file lists from `project-structure.mjs`.

## Test commands

Fast checks during development:

```bash
npm run check:architecture
npm run test:unit
npm run check:syntax
```

Complete non-UI verification:

```bash
npm audit --audit-level=high
npm run verify
```

Browser UI verification:

```bash
source .venv-ui/bin/activate
npm run test:ui
deactivate
```

`test:unit` discovers all files matching `tests/**/*.test.js` and `tests/**/*.test.mjs`; adding a test no longer requires editing `package.json`.

## Review checklist

Before opening a pull request, confirm:

- the change stays inside the correct runtime and domain boundary;
- new user-facing text comes from locale catalogs;
- new external URLs are rejected by default and explicitly admitted by `url-policy.js`;
- permissions and host permissions have not expanded unintentionally;
- no generated or temporary files were placed in `src/`;
- architecture, unit, syntax, reproducibility, Firefox lint and UI tests pass;
- documentation describes any new module, message, permission or data flow.
