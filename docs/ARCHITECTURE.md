# Architecture

GitHub Download Now is a Manifest V3 WebExtension for Chromium and Firefox. The project deliberately ships readable JavaScript without bundling, minification or remote code. Files are loaded in an explicit order and communicate through small global APIs whose names begin with `GHDN`.

This document describes the current runtime boundaries and the target direction for the ongoing modular refactor.

## Runtime contexts

The extension runs in four isolated contexts:

| Context | Entry point | Responsibility |
|---|---|---|
| GitHub page | `src/content.js` plus `src/content/` modules | Coordinate repository detection, placement, release-page parsing, UI rendering and privileged background requests. |
| Background | `src/background.js` plus `src/background/` services | Compose GitHub API, OAuth, tracking, alarms, notifications and trusted navigation services, then register browser events. |
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

The content decomposition is split across route/DOM, state, loading, lifecycle and presentation modules. `src/content.js` is now a small composition root that wires those APIs together and owns only cross-module workflows such as mounting, trusted downloads and settings refreshes:

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
| `content/strings.js` | Build the content-facing translated string facade from native locale catalogs. |
| `content/platform.js` | Detect browser platform, classify assets and format platform/release metadata. |
| `content/ui/icons.js` | Own the local SVG icon catalog as inert data. |
| `content/ui/elements.js` | Create safe DOM/SVG nodes from trusted local icon markup. |
| `content/ui/download-button.js` | Render and update the primary split button, loading state and toolbar density. |
| `content/ui/menu-shell.js` | Own the detached menu container, positioning, focus and close behavior. |
| `content/ui/notices.js` | Render toast messages and update-watch prompts, plus clipboard fallback. |
| `content/ui/install-guidance.js` | Render deterministic installation cards and post-download guidance. |
| `content/ui/build-documents.js` | Render lazy build-document discovery controls and status states. |
| `content/ui/asset-list.js` | Render ranked asset rows, recommendation explanations and source links. |
| `content/ui/release-menu.js` | Compose the release menu, version selector, asset sections and footer. |

Every module exposes a small `GHDN*` API and is CommonJS-compatible for Node tests. DOM parsing, network access and reusable UI construction remain in separate modules; `content.js` only composes them.

### Content boundary rules

- GitHub route and public-visibility parsing belongs only in `repository-context.js`.
- GitHub toolbar/release DOM knowledge belongs only in `github-dom.js` and `placement.js`.
- Release HTML-to-data conversion belongs only in `release/page-parser.js`.
- Anonymous GitHub HTML requests belong only in `page-client.js`.
- Release/tag caches and page-to-background fallback belong only in `release/release-loader.js`.
- Selected-version and in-flight release state belong in `state.js` and `release/version-controller.js`.
- Turbo/PJAX/scroll/resize observers and timers belong only in `lifecycle.js`.
- `content.js` is the composition root; it must not contain reusable DOM components, duplicate parsers, network clients, caches or page observers.
- Reusable content-page UI belongs in `content/ui/`; platform classification belongs in `content/platform.js`; translated string mapping belongs in `content/strings.js`.

## Content styles

Content CSS is loaded in an explicit component order and mirrors the UI modules:

```text
src/styles/
├── content-base.css
├── download-menu.css
├── asset-list.css
├── notices.css
├── install-guidance.css
├── build-documents.css
└── version-selector.css
```

Do not recreate a monolithic `styles.css`. Put a selector in the narrowest matching component file, preserve manifest order when dependencies exist, and update both manifests plus UI-test inlining when adding or renaming a stylesheet.

## Background services

`src/background.js` is a stable composition root. Chromium loads it as the Manifest V3 service worker and it imports the service modules with local `importScripts`; Firefox loads the same modules explicitly before `background.js`. Reusable background behavior belongs in `src/background/`:

| Module | Responsibility |
|---|---|
| `background/storage.js` | Wrap local-storage access and restrict it to trusted extension contexts where supported. |
| `background/github-client.js` | Own authenticated/anonymous GitHub API requests, response limits, rate-limit metadata and OAuth-token cache access. |
| `background/release-service.js` | Sanitize GitHub release JSON, cache release responses and rank assets. |
| `background/build-service.js` | Discover README/build documents with bounded, rate-limit-aware guided traversal. |
| `background/navigation.js` | Open only URL-policy-approved GitHub pages and local extension pages. |
| `background/auth-service.js` | Run scope-free GitHub OAuth Device Flow and expose only public authorization state. |
| `background/tracker-state.js` | Sanitize and persist download history, watched repositories, pending updates and tracker metadata. |
| `background/alarms.js` | Own update-check alarm cadence and alarm-name matching. |
| `background/notifications.js` | Own optional notifications, badge state and notification-click routing. |
| `background/tracking-service.js` | Record downloads, manage watches, perform batched update checks and expose dashboard operations. |
| `background/message-router.js` | Map canonical runtime message types to service methods and enforce trusted auth callers. |

### Background boundary rules

- GitHub API and raw-content `fetch` calls belong only in `github-client.js`; OAuth POST requests belong only in `auth-service.js`.
- Release sanitization and release caches belong only in `release-service.js`.
- README-guided discovery and its cache belong only in `build-service.js`.
- Local tracker data must cross `tracker-state.js` so stored URLs are revalidated before privileged use.
- Browser notification and badge APIs belong only in `notifications.js`; alarm creation belongs only in `alarms.js`.
- Runtime message names belong in `shared/messages.js`; routing belongs only in `message-router.js`.
- `background.js` must remain a composition root under 250 lines and must not regain release, OAuth, build-discovery or update-check algorithms.

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
background/message-router.js validates and routes the request
        ↓
background/release-service.js
        ↓
background/github-client.js performs the trusted API request
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

The background context does not need presentation formatting. Firefox lists shared/domain dependencies and `background/*` services explicitly before `background.js`; Chromium starts `background.js`, which imports those same local files in the documented order. No remote or generated runtime imports are allowed.

When adding a source file, update all applicable places:

- `scripts/build-files.mjs`;
- Chromium and Firefox manifests;
- popup/options HTML when relevant;
- test fixtures and UI-test inlining;
- project validation and manifest tests.

## Testing layers

- `tests/*.test.js` — shared/domain Node unit and integration tests;
- `tests/content/` — content route, DOM, lifecycle, loading and presentation-unit tests;
- `tests/background/` — background storage, GitHub client, release, tracker-state and routing-unit tests;
- `tests/helpers/` — reusable WebExtension mocks and fixtures;
- `tests/ui_smoke.py` — content-script behavior in Chromium;
- `tests/settings_ui_smoke.py` — popup, options, settings and auth UI;
- `scripts/validate-project.mjs` — source allowlist, manifests, privacy and release invariants;
- `scripts/verify-reproducible.py` — byte-identical package verification.

Every behavior-preserving extraction must keep all existing tests green. New shared helpers require dedicated unit tests.

## Popup and options architecture

The extension-page entry scripts are now composition roots, matching the content and background boundaries.

### Popup modules

| Module | Responsibility |
|---|---|
| `popup/strings.js` | Build the localized popup catalog and platform-format choices. |
| `popup/view.js` | Own generic popup DOM helpers, tab accessibility, labels, status messages and formatting adapters. |
| `popup/settings-controller.js` | Bind the compact settings panel, notification consent and platform-specific format preference. |
| `popup/dashboard-controller.js` | Load and render updates, watched repositories and download history; own dashboard actions. |
| `popup.js` | Compose dependencies and start the popup. |

### Options modules

| Module | Responsibility |
|---|---|
| `options/strings.js` | Build the localized options catalog, plural forms and OAuth status text. |
| `options/view.js` | Apply translated labels/options and own the transient footer status. |
| `options/form.js` | Define the settings-field schema, collect/fill values and debounce persisted changes. |
| `options/auth-panel.js` | Own Device Flow consent, polling, connection state and disconnect behavior. |
| `options/update-actions.js` | Own manual update checks and history/tracking cleanup actions. |
| `options.js` | Compose dependencies and start the options page. |

### Extension-page boundary rules

- `popup.js` and `options.js` must remain composition roots under 120 lines.
- User-facing strings belong in locale catalogs and are exposed through the dedicated `strings.js` modules.
- Dashboard list rendering and update actions belong in `popup/dashboard-controller.js`.
- Popup quick settings belong in `popup/settings-controller.js`; the full options field schema belongs in `options/form.js`.
- GitHub Device Flow UI state and timers belong only in `options/auth-panel.js`.
- Popup/options HTML declares dependency order explicitly; any new module must also be added to the source allowlist, validation and UI-test inlining.
- The existing `popup.css` and `options.css` remain intentionally separate, focused stylesheets. Their current sizes do not justify artificial component fragmentation.

## Completed modular layout

The four runtime surfaces now use small entry points and focused modules:

```text
src/content.js       → content route/data/lifecycle/UI modules
src/background.js    → background services and message router
src/popup.js         → popup strings/view/settings/dashboard modules
src/options.js       → options strings/view/form/auth/update modules
```

Future work should improve a domain module in place rather than recreating a central controller. Product features, permission changes and release-version changes should remain separate from structural refactors.

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
