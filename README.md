# GitHub Download Now

GitHub Download Now is an open-source browser extension for Chromium and Firefox that helps users identify, download and track updates for application assets published through GitHub Releases.

It adds a clear download control to GitHub repositories, detects the current operating system and CPU architecture, recommends the most suitable release asset, keeps alternatives grouped by platform, and can optionally watch selected repositories for new releases.

![GitHub Download Now](assets/social-preview.png)

## Features

- Detects Windows, Linux, macOS and Android.
- Matches x64, x86, ARM64 and ARM asset names.
- Recommends common installers and packages for each supported platform, including EXE and MSI, DMG and PKG, AppImage, DEB and RPM, and APK.
- Keeps suitable alternatives available in a structured menu.
- Avoids checksums, signatures, SBOMs, debug symbols and source archives during automatic selection.
- Finds explicit build instructions on demand from release-tag documentation and shows the original commands with a source link.
- Provides configurable package preferences and manual OS/architecture overrides.
- Warns about stale releases and explains why an asset was recommended.
- Keeps an optional local history of downloads started through the extension.
- Can watch repositories selected by the user and check them for new releases.
- Shows pending updates in the toolbar popup, badge and optional system notifications.
- Supports Russian and English interfaces.

## Privacy

The extension has no analytics, advertising, developer-operated backend or GitHub account access.

The public owner/repository identifier is sent only to GitHub's official API when release metadata is required. Background requests are made only for repositories the user explicitly chooses to watch. Download history and watched repositories are stored locally on the current device. Preferences may be synchronized by the browser through `storage.sync`.

See [PRIVACY.md](PRIVACY.md) for the complete policy and Limited Use disclosure.

## Install for development

### Chromium

1. Extract `github-download-now-chromium-v0.4.2.zip`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the extracted directory containing `manifest.json`.

### Firefox

1. Extract `github-download-now-firefox-v0.4.2.zip`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on**.
4. Select `manifest.json`.

A permanent Firefox installation requires Mozilla signing through AMO.

## Development

Requirements: Node.js 20 or newer and Python 3.

```bash
npm ci
npm test
npm run package
```

Build directories:

```text
dist/chromium/
dist/firefox/
```

## Permissions

- `storage`: saves settings and optional local update-tracking data.
- `alarms`: schedules update checks for explicitly watched repositories.
- `notifications` (optional): displays system update notifications only after the user enables them.
- `https://github.com/*`: displays the interface on GitHub repository pages.
- `https://api.github.com/*`: requests public release metadata from GitHub.

The extension does not request cookies, browsing-history access, GitHub tokens or the browser's general download history.

## Contributing

Links to repositories with incorrect recommendations are especially useful. Please include the repository URL, detected platform, selected asset and expected asset in the issue.

## Disclaimer

GitHub Download Now is an independent open-source project and is not affiliated with or endorsed by GitHub, Inc. GitHub is a trademark of GitHub, Inc.

## License

MIT
