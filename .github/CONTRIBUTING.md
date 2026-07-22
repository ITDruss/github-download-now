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

Content-page changes must respect the current module boundaries: repository parsing in `src/content/repository-context.js`, GitHub DOM knowledge in `src/content/github-dom.js`, mount selection in `src/content/placement.js`, page state in `src/content/state.js`, trusted HTML requests in `src/content/page-client.js`, release parsing/loading in `src/content/release/`, navigation/observer ownership in `src/content/lifecycle.js`, platform classification in `src/content/platform.js`, and reusable presentation in `src/content/ui/`. `src/content.js` is only the composition root. Component styles belong in `src/styles/`; do not recreate a monolithic `styles.css` or add duplicate route parsers, GitHub selector sets, page fetchers, release caches or observers.


Background changes must respect the service boundaries in `src/background/`: GitHub GET requests in `github-client.js`, release normalization in `release-service.js`, build-document discovery in `build-service.js`, OAuth Device Flow in `auth-service.js`, stored tracker sanitization in `tracker-state.js`, alarm ownership in `alarms.js`, notification/badge behavior in `notifications.js`, tracking operations in `tracking-service.js`, and runtime dispatch in `message-router.js`. `src/background.js` is only the composition root; do not add service algorithms back to it.

Popup and options changes must respect their extension-page boundaries. Popup translations belong in `src/popup/strings.js`, generic tab/status DOM behavior in `src/popup/view.js`, compact preferences in `src/popup/settings-controller.js`, and dashboard lists/actions in `src/popup/dashboard-controller.js`. Options translations belong in `src/options/strings.js`, label rendering in `src/options/view.js`, the persisted field schema in `src/options/form.js`, Device Flow UI in `src/options/auth-panel.js`, and update/data actions in `src/options/update-actions.js`. `src/popup.js` and `src/options.js` are composition roots; keep both under 120 lines.

## Translations

Translations live in `src/_locales/<locale>/messages.json`. See [`docs/TRANSLATING.md`](../docs/TRANSLATING.md) for the complete workflow. Do not add user-facing strings directly to JavaScript when a locale message can be used.

## Pull requests

- Keep each pull request focused.
- Add regression tests for URL policy, asset selection, GitHub layout and update tracking changes.
- Test light/dark themes and narrow/wide layouts.
- Explain any permission or network-behaviour change.
- Do not place temporary or generated files inside `src/`; the allowlisted build rejects unknown files.
