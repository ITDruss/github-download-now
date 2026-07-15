# Building GitHub Download Now

This document describes the complete reproducible build used for the Chromium and Firefox store packages.

## Requirements

- Node.js 20 or newer;
- npm included with Node.js;
- Python 3.9 or newer for ZIP packaging (Python 3.13 is used in CI);
- optional: Python 3.13 and Playwright 1.61.0 for browser UI tests.

No global npm packages are required. Dependencies are installed from the public npm registry through the checked-in `package-lock.json`.

## Build the store packages

From the source archive root:

```bash
npm ci --ignore-scripts
npm test
npm run package
```

Outputs:

```text
dist/chromium/
dist/firefox/
github-download-now-chromium-v1.1.0.zip
github-download-now-firefox-v1.1.0.zip
```

`npm run package` performs only these transformations:

1. validates the explicit file allowlist in `scripts/build-files.mjs`;
2. copies readable JavaScript, CSS, HTML and PNG files from `src/`;
3. selects `manifest.chromium.json` or `manifest.firefox.json` and writes it as `manifest.json`;
4. copies `README.md`, `LICENSE` and `THIRD_PARTY_NOTICES.md`;
5. creates deterministic ZIP archives with sorted files and timestamps derived from `SOURCE_DATE_EPOCH` or the current Git commit.

The build does **not** minify, obfuscate, transpile, concatenate or bundle JavaScript, HTML or CSS. It does not download or generate remote executable code.

## Complete verification

```bash
npm run verify
```

This runs project validation, ESLint, unit tests, reproducible-build verification and Firefox add-on linting.

For browser UI tests:

```bash
python3 -m venv .venv-ui
source .venv-ui/bin/activate
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
npm run test:ui
```

The UI test environment and screenshots are ignored by Git and are not included in store packages.

## Reproducible timestamps

To build with an explicit timestamp:

```bash
SOURCE_DATE_EPOCH=1784020800 npm run package
```

Building twice with the same source and `SOURCE_DATE_EPOCH` must produce byte-identical browser ZIP files:

```bash
SOURCE_DATE_EPOCH=1784020800 npm run verify:reproducible
```
