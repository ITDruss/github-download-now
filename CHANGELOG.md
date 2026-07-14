# Changelog

All notable changes to this project are documented here.

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
