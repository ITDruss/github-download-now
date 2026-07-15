# Changelog

All notable changes to this project are documented here.

## [1.1.0] - 2026-07-14

### Added

- Added README-guided build-document discovery that follows at most three ranked same-repository links with depth one, a two-directory limit, a three-document limit and a reserved API budget.
- Added regression coverage for `OHF-Voice/piper1-gpl` so the C/C++ API instructions in `libpiper/README.md` are discovered while staying on the selected release tag.
- Added an optional scope-free GitHub OAuth Device Flow connection using OAuth App client ID `Ov23liF54e9cVZTKyRqy`.
- Added a settings explanation of the larger authenticated API budget, the public-only boundary, local token storage and disconnect control.
- Added Firefox optional `authenticationInfo` consent for the user-initiated GitHub connection.
- Added a new original repository-branch/download logo and a restrained purple brand accent while preserving green for successful download actions.

### Changed

- Promoted the extension to version 1.1.0 for the initial store submission.
- Authenticated API requests remain restricted to `api.github.com`; browser GitHub cookies and private-repository content remain outside the extension's design.
- Build-document links that point to another branch such as `main` are rebound to the release tag currently selected by the user.
- Updated store-facing privacy disclosures, permissions explanations, screenshots and promotional artwork for optional authentication.

### Security

- OAuth tokens never enter `storage.sync`, content-script messages or UI responses.
- OAuth endpoints and the device verification page are accepted only at exact GitHub paths, redirects are rejected and empty OAuth scopes are enforced.
- Authentication messages are accepted only from extension pages, and invalid stored tokens fall back to anonymous public API access.

## [1.0.0] - 2026-07-14

### Added

- Added strict URL-origin and repository validation for every release asset, source archive, stored download and external navigation action.
- Added adaptive README section discovery for build documentation, including platform-specific sections such as `Building → Linux`.
- Added rotating batched update checks with local GitHub API rate-limit state and a lower watch limit of 30 repositories.
- Added a strict extension Content Security Policy, project validator, source-file build allowlist and reproducible ZIP timestamps.
- Added full Playwright UI checks to CI, pinned GitHub Actions by immutable commit SHA, Dependabot updates and signed build-provenance attestations.
- Added public-only repository handling and synchronized privacy documentation for GitHub Pages and store submissions.
- Added API response-size limits, redirect rejection, malformed-response handling and exact release-tag checks for stored records.
- Added accessible popup tabs with keyboard navigation and regenerated version-correct publication screenshots.
- Added a reviewer-oriented `BUILDING.md` with exact, non-minifying and reproducible build instructions.

### Changed

- Promoted the extension to version 1.0.0 for the first store-ready release.
- GitHub page requests now omit session credentials and interactive downloads prefer validated public page data before REST API fallback.
- Background observers now run only on supported repository pages instead of monitoring every GitHub page globally, and scroll work is skipped outside active repository pages.
- Build documentation is ranked by dedicated files and exact README heading anchors without generating or executing commands.
- UI menus use dialog semantics and improved keyboard focus behavior.
- Android App Bundles (`.aab`) and split APK sets (`.apks`) are no longer selected automatically unless APKS is explicitly preferred.
- Build packaging now fails on unknown files inside `src/` rather than silently including them.

### Fixed

- Prevented external sites from imitating GitHub Release URL paths and being presented as trusted downloads.
- Removed an obsolete duplicate build-document implementation that overrode README section discovery.
- Prevented corrupted or untrusted stored URLs from being reopened through history, watches, updates or notifications.
- Added release tag/version consistency checks to prevent mismatched GitHub releases and package filenames.
- Replaced an environment-specific npm mirror in `package-lock.json` with the public npm registry and added validation to prevent recurrence.

## [0.4.3] - 2026-07-14

### Fixed

- Replaced the full-width control on GitHub Releases pages with a compact split button beside the visible release version.
- The Releases-page button now requests and recommends assets for the selected release tag instead of always using the latest release.
- Added route and layout regression coverage for Releases pages while preserving the existing repository toolbar and emergency fallback modes.
- UI smoke tests now write generated screenshots to the ignored `test-results/` directory instead of modifying publication assets.
- Positioned the compact release control directly beside the version and remount it for the release currently in view.
- Anchored the Releases control inside the version text wrapper so wide GitHub flex rows cannot push it toward Compare.
- Fixed opening extension settings from the injected GitHub menu in Chromium.
- Read public release assets and version tags from GitHub pages before falling back to the REST API, greatly reducing quota usage.
- Settings UI smoke tests now also write screenshots to the ignored `test-results/` directory.

### Added

- Added a release-version selector inside the download menu.
- Made build-document discovery lazy so GitHub API quota is used only after the user expands that section.

## [0.4.2] - 2026-07-14

### Fixed

- Mounted the download control only into visible GitHub action containers.
- Added adaptive placement: native toolbar integration, compact toolbar density, full-width in-page fallback and a bottom-right emergency fallback.
- Portaled the download menu to `document.body` so GitHub containers cannot clip it, with viewport-aware positioning and a mobile bottom-sheet layout.
- Remounted and repositioned controls after GitHub navigation, container resizing and viewport changes.
- Added the correct SVG namespace so platform and action icons render reliably in Chromium.
- Added regression tests for authenticated GitHub layouts, toolbar overflow, mobile flow placement, menu positioning and SVG namespaces.
- Anchored toolbar placement after GitHub's complete Star control instead of between Fork and Star.
- Added on-demand discovery of likely build-documentation files at the release tag, shown as direct GitHub links without parsing or displaying commands.
- Added regression tests for row-reverse Star placement, intact Fork/Star groups, secondary-page fallbacks and build-documentation discovery.
- Added deterministic, localized installation and launch guidance for AppImage, DEB, RPM, Flatpak, Snap, Windows installers, macOS packages, Android packages, archives, JAR, VSIX and trusted executable scripts.
- Added per-asset help controls, copyable commands and an optional post-download guidance card without requesting browser download-history permission.
- Added a setting for beginner guidance, compact on-demand guidance or disabling installation help.
- Stacked installation guidance, update-watching prompts and short status messages so they no longer overlap.

## [0.4.1] - 2026-07-13

### Fixed

- Avoided static SVG `innerHTML` assignments in the GitHub content script.
- Kept an existing matching update alarm instead of resetting its schedule on every background start.
- Stopped scheduled checks and hid the badge when the extension is disabled.
- Reported background-check failures and GitHub API rate limits in the popup and options page.

### Submission readiness

- Set Firefox minimum version to 140 and declared required `browsingActivity` transmission for repository identifiers sent to GitHub's official API.
- Updated privacy, store listing, permission justifications and publication documentation.

## [0.4.0] - 2026-07-13

### Added

- Local history for downloads initiated through GitHub Download Now, limited to the latest 100 entries.
- Opt-in repository watching after a download, with a limit of 50 watched repositories.
- Scheduled release checks every 6 hours, daily, every 3 days, weekly or manually.
- Toolbar badge showing the number of pending updates.
- Optional system notifications requested only when explicitly enabled.
- Popup sections for available updates, watched repositories, download history and quick settings.
- Update actions to download the recommended asset, open the release, skip the release or stop watching.
- Conditional GitHub requests using stored ETags during background checks.
- Local-data controls for clearing history and removing all watches.
- Automated background-flow tests covering download recording, update detection and update installation action.

### Privacy

- Download history, watched repositories and pending updates are stored only in `storage.local`.
- Incognito downloads are not recorded.
- The extension still does not request access to browser download history, cookies or GitHub credentials.

## [0.3.0] - 2026-07-13

### Added

- Toolbar popup with extension toggle, detected platform, preferred format and main-button behavior.
- Full options page with OS/architecture overrides, per-platform format preferences and interface controls.
- Browser-synced preferences through the minimal `storage` permission.
- Choice between the latest stable release and the newest published release including prereleases.
- Configurable stale-release warning with release publication date.
- Recommendation explanation showing matched OS, architecture, format and user preference.
- Direct-link copy action for every release asset.
- Accent, native GitHub and compact button styles.
- Controls for other-platform assets, source archives, subtitle visibility and page placement.

### Changed

- Asset ranking now gives a strong, transparent boost to the user-selected package format.
- GitHub REST API version header corrected to the documented `2022-11-28` value.
- Release cache keys now include the selected stable/newest channel.

## [0.2.2] - 2026-07-13

### Fixed

- Rebuilt Chromium and Firefox artifacts from the updated icon sources.
- Added versioned archive filenames to prevent browsers and the ChatGPT file UI from reusing an older `0.2.0` download.
- Manifest tests now compare both browser manifests with `package.json`, preventing release version drift.

## [0.2.1] - 2026-07-13

### Changed

- Replaced the generic Linux terminal symbol with the recognizable Tux penguin.
- Replaced the generic macOS monitor symbol with the Apple platform logo.

## [0.2.0] - 2026-07-13

### Added

- Bright green split download button that remains visually consistent with GitHub.
- OS and CPU architecture shown directly below the primary action.
- Recommended package format shown in the button, for example `Download AppImage`.
- Platform icons for Linux, Windows, macOS, Android and browser extensions.
- Separate menu sections for assets suitable for the current device and other platforms.
- Human-readable package hints for AppImage, DEB, RPM, DMG, APK and other formats.
- Better mobile layout, reduced-motion support and improved keyboard focus states.
- Repository templates, CI workflow, build scripts and promotional assets.

### Changed

- Dropdown width and hierarchy were redesigned for easier scanning.
- The latest release is prefetched only after hover or keyboard focus, preserving API quota.
- Firefox now uses a stable UUID add-on ID.

## [0.1.0] - 2026-07-13

- Initial Chromium and Firefox MVP.
- Latest stable release lookup through the public GitHub API.
- OS/architecture-aware release asset ranking.
