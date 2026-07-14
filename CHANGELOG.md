# Changelog

All notable changes to this project are documented here.

## [0.4.2] - 2026-07-13

### Fixed

- Mounted the download control only into visible GitHub action containers.
- Added adaptive placement: native toolbar integration, compact toolbar density, full-width in-page fallback and a bottom-right emergency fallback.
- Portaled the download menu to `document.body` so GitHub containers cannot clip it, with viewport-aware positioning and a mobile bottom-sheet layout.
- Remounted and repositioned controls after GitHub navigation, container resizing and viewport changes.
- Added the correct SVG namespace so platform and action icons render reliably in Chromium.
- Added regression tests for authenticated GitHub layouts, toolbar overflow, mobile flow placement, menu positioning and SVG namespaces.
- Anchored toolbar placement after GitHub's complete Star control instead of between Fork and Star.
- Added on-demand build-instruction discovery from explicit repository documentation at the release tag, with safe plain-text command previews and source links.
- Added regression tests for Star-relative placement and build-instruction extraction.

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
