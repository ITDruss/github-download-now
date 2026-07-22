# Contributing

Thanks for helping improve GitHub Download Now.

## Development

1. Install Node.js 20 or newer and Python 3.13.
2. Run `npm ci --ignore-scripts`.
3. Run `npm run verify` for validation, linting, unit tests, reproducible builds and Firefox lint.
4. For UI changes, install Playwright from `requirements-dev.txt` and run `npm run test:ui`.
5. Load `dist/chromium` or `dist/firefox` as an unpacked/temporary extension and perform a manual check on public repository and Releases pages.

Keep the extension privacy-friendly: no telemetry, remote code, broad host permissions, private-repository access or unnecessary account data.

Read [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) before changing runtime messages, browser API wrappers, script loading order or security boundaries. Shared runtime message names belong in `src/shared/messages.js`; Chrome/Firefox compatibility wrappers belong in `src/shared/browser-api.js`.

Content-page changes must respect the current module boundaries: repository parsing in `src/content/repository-context.js`, GitHub DOM knowledge in `src/content/github-dom.js`, mount selection in `src/content/placement.js`, and release HTML parsing in `src/content/release/page-parser.js`. Do not add duplicate route parsers or GitHub selector sets back to `src/content.js`.

## Translations

Translations live in `src/_locales/<locale>/messages.json`. See [`docs/TRANSLATING.md`](../docs/TRANSLATING.md) for the complete workflow. Do not add user-facing strings directly to JavaScript when a locale message can be used.

## Pull requests

- Keep each pull request focused.
- Add regression tests for URL policy, asset selection, GitHub layout and update tracking changes.
- Test light/dark themes and narrow/wide layouts.
- Explain any permission or network-behaviour change.
- Do not place temporary or generated files inside `src/`; the allowlisted build rejects unknown files.
