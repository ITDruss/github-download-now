# Architecture

GitHub Download Now is a Manifest V3 WebExtension for Chromium and Firefox. The project deliberately ships readable JavaScript without bundling, minification or remote code. Files are loaded in an explicit order and communicate through small global APIs whose names begin with `GHDN`.

This document describes the current runtime boundaries and the target direction for the ongoing modular refactor.

## Runtime contexts

The extension runs in four isolated contexts:

| Context | Entry point | Responsibility |
|---|---|---|
| GitHub page | `src/content.js` plus `src/content/` modules | Coordinate repository detection, placement, release-page parsing, UI rendering and privileged background requests. |
| Background | `src/background.js` | GitHub API access, OAuth Device Flow, local tracking state, update checks, notifications and trusted navigation. |
| Popup | `src/popup.js` | Show updates, watched repositories, history and common settings. |
| Options | `src/options.js` | Full settings editor and optional GitHub connection. |

These contexts do not share memory. Runtime messages are the contract between page, popup/options and background code.

## Shared foundation

The modular foundation lives in `src/shared/`:

- `messages.js` — the canonical runtime message names and helpers;
- `browser-api.js` — the callback/Promise compatibility layer for Chrome and Firefox APIs;
- `formatting.js` — deterministic display formatting and platform helpers.

Shared files expose frozen APIs on `globalThis`:

```text
GHDNMessages
GHDNBrowser
GHDNFormatting
```

They are also CommonJS-compatible so unit tests can load the exact production implementation.

### Runtime message rule

Do not add raw `"GHDN_*"` strings to production code. Add the type once to `src/shared/messages.js` and use:

```js
const messages = globalThis.GHDNMessages;

await browserApi.runtime.sendMessage({
  type: messages.TYPES.GET_LATEST_RELEASE,
  owner,
  repo
});
```

The background message router must use the same constants. This keeps callers, handlers and tests synchronized.

### Browser API rule

Do not add new callback-vs-Promise branches directly to feature modules. Extend `src/shared/browser-api.js` and call the adapter instead:

```js
await browserApi.storage.local.set(values);
await browserApi.tabs.create(url);
const response = await browserApi.runtime.sendMessage(message);
```

Direct access to `browser` or `chrome` remains acceptable only for event registration, manifest metadata and APIs not yet represented by the adapter.

### Formatting rule

Reusable formatting belongs in `src/shared/formatting.js`. Feature-specific labels and translated sentences remain in the locale catalogs.

## Content-page modules

The content decomposition is now split across route/DOM, state, loading and lifecycle modules. `src/content.js` remains the UI coordinator while non-visual responsibilities live in focused modules:

| Module | Responsibility |
|---|---|
| `content/repository-context.js` | Parse GitHub repository routes, require a positive public marker, enforce page-visibility settings and decode release tags. |
| `content/github-dom.js` | Classify GitHub action controls, centralize visibility checks and locate release-title wrappers. |
| `content/placement.js` | Select toolbar, release, flow or floating mount targets and insert the extension root. |
| `content/state.js` | Own mutable page-session state for context, selected version, in-flight release/build requests and platform detection. |
| `content/page-client.js` | Fetch trusted GitHub HTML with `credentials: omit`, redirect validation and response-size limits. |
| `content/release/page-parser.js` | Extract trusted release tags, assets, sizes and release metadata from GitHub HTML. |
| `content/release/release-loader.js` | Cache parsed release pages and tags, rank assets and fall back to background API messages. |
| `content/release/version-controller.js` | Deduplicate release loads, coordinate version changes and update the primary presentation. |
| `content/lifecycle.js` | Own navigation listeners, observers, mount scheduling, prefetch and layout refresh scheduling. |

Every module exposes a small `GHDN*` API and is CommonJS-compatible for Node tests. DOM parsing remains separate from network access, while UI construction remains in `content.js` until the next extraction stage.

### Content boundary rules

- GitHub route and public-visibility parsing belongs only in `repository-context.js`.
- GitHub toolbar/release DOM knowledge belongs only in `github-dom.js` and `placement.js`.
- Release HTML-to-data conversion belongs only in `release/page-parser.js`.
- Anonymous GitHub HTML requests belong only in `page-client.js`.
- Release/tag caches and page-to-background fallback belong only in `release/release-loader.js`.
- Selected-version and in-flight release state belong in `state.js` and `release/version-controller.js`.
- Turbo/PJAX/scroll/resize observers and timers belong only in `lifecycle.js`.
- `content.js` coordinates these modules and renders UI; it must not reintroduce duplicate parsers, network clients, caches or page observers.

## Existing domain modules

The following files already represent reasonably focused domains and should stay independent during decomposition:

| Module | Responsibility |
|---|---|
| `asset-selector.js` | Rank release assets for platform, architecture and preferred format. |
| `build-instructions.js` | Discover and rank build documents and README sections. |
| `github-auth.js` | Validate Device Flow responses, tokens and public auth state. |
| `install-guides.js` | Produce post-download guidance from trusted metadata. |
| `settings.js` | Normalize, read and update extension settings. |
| `tracker.js` | Normalize history, watches and detected updates. |
| `url-policy.js` | Validate every trusted GitHub/API/navigation URL. |
| `i18n.js` | Resolve locale catalogs and format translated messages. |

## Data flow

A typical release recommendation follows this path:

```text
GitHub repository page
        ↓
repository-context.js validates the public repository
        ↓
placement.js selects the mount target
        ↓
version-controller.js requests the selected release
        ↓
release-loader.js parses GitHub HTML through page-client.js
        ↓ fallback when page data is unavailable
GHDN_GET_LATEST_RELEASE / GHDN_GET_RELEASE_BY_TAG
        ↓
background.js validates the request
        ↓
GitHub API client logic
        ↓
asset-selector.js ranks assets
        ↓
response crosses runtime messaging
        ↓
content.js renders the recommendation
```

A link is never trusted merely because it came from GitHub HTML or API JSON. It must pass `url-policy.js` at the boundary where it enters the extension and again before privileged navigation or download-related actions.

## Security boundaries

The architecture must preserve these invariants:

1. Public repositories only; uncertain visibility fails closed.
2. No GitHub session-cookie access.
3. GitHub page requests use `credentials: omit`.
4. OAuth is optional, scope-free and handled only by trusted extension contexts.
5. OAuth tokens stay in `storage.local` and are never sent to content scripts.
6. All external URLs pass `url-policy.js` before use.
7. No remote executable code, `eval`, runtime script downloads or hidden bundling.
8. `src/` is an allowlisted source tree; unknown files fail the build.

See `PRIVACY.md` and `.github/SECURITY.md` for user-facing and reporting details.

## Script loading order

Because the project intentionally has no bundler, dependency order is explicit.

Content scripts and extension pages load:

```text
shared/messages.js
shared/browser-api.js
shared/formatting.js
i18n-catalogs.js
i18n.js
settings.js
feature/domain modules
entry script
```

The background context does not need presentation formatting, so it loads `shared/messages.js` and `shared/browser-api.js`, followed by its domain dependencies and `background.js`.

When adding a source file, update all applicable places:

- `scripts/build-files.mjs`;
- Chromium and Firefox manifests;
- popup/options HTML when relevant;
- test fixtures and UI-test inlining;
- project validation and manifest tests.

## Testing layers

- `tests/*.test.js` — shared/domain Node unit and integration tests;
- `tests/content/` — repository, GitHub DOM, placement and release-page parser tests;
- `tests/helpers/` — reusable WebExtension mocks and fixtures;
- `tests/ui_smoke.py` — content-script behavior in Chromium;
- `tests/settings_ui_smoke.py` — popup, options, settings and auth UI;
- `scripts/validate-project.mjs` — source allowlist, manifests, privacy and release invariants;
- `scripts/verify-reproducible.py` — byte-identical package verification.

Every behavior-preserving extraction must keep all existing tests green. New shared helpers require dedicated unit tests.

## Planned decomposition

The current `content.js`, `background.js` and `styles.css` are still large. They will be split in behavior-preserving local commits.

Current and target content structure:

```text
src/content/
├── repository-context.js      # extracted
├── github-dom.js              # extracted
├── placement.js               # extracted
├── entry.js                   # planned replacement for content.js
├── state.js                   # extracted
├── page-client.js             # extracted
├── lifecycle.js               # extracted
├── release/
│   ├── page-parser.js         # extracted
│   ├── release-loader.js      # extracted
│   └── version-controller.js  # extracted
└── ui/
    ├── button.js
    ├── menu.js
    ├── asset-row.js
    ├── build-documents.js
    ├── install-card.js
    └── notices.js
```

Target background structure:

```text
src/background/
├── entry.js
├── message-router.js
├── github-client.js
├── release-service.js
├── build-service.js
├── auth-service.js
├── storage.js
├── tracking-service.js
├── update-service.js
├── alarms.js
└── notifications.js
```

The extraction order is intentionally incremental: shared foundation, repository/DOM logic, content loading/lifecycle, content UI, CSS, background services, then popup/options. No step should combine architectural movement with unrelated product features.

## Contribution checklist

Before opening a pull request:

```bash
npm audit --audit-level=high
npm run i18n:check
npm run verify
source .venv-ui/bin/activate
npm run test:ui
deactivate
```

Also load `dist/chromium` or `dist/firefox` manually and test public repository, Releases, popup, options and GitHub connection flows.
