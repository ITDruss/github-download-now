# Privacy policy

Effective date: July 14, 2026

GitHub Download Now does not sell user data and does not send data to the developer, analytics providers or advertising services.

## Core GitHub API requests

When release metadata is required, the extension reads the public repository owner and repository name from the current GitHub page and sends those values to the official GitHub REST API at `api.github.com`.

This request is necessary to identify the latest release and its downloadable assets. When the download menu is opened, the extension may also request public repository directory listings for the selected release tag to locate files such as `BUILDING.md`, `INSTALL.md` or `CONTRIBUTING.md`. The extension links to those files on GitHub; it does not retrieve, interpret or execute their contents. The directory listings are not sent to the developer.

Background requests are made only for repositories the user explicitly chooses to watch. The extension does not send a general browsing history, unrelated page content or GitHub credentials.

## Local installation guidance

Installation and launch guidance is generated entirely inside the extension from the selected asset filename, file extension, detected platform and interface language. These values are not sent to the developer or to an AI service. The extension does not execute commands, inspect the downloaded file or determine whether installation succeeded.

## Local download history and update tracking

When a user starts a download through GitHub Download Now, the extension may store a local record containing:

- repository owner and name;
- release ID and tag;
- selected asset name and URL;
- detected platform and architecture;
- time the download action was started.

The extension does not read the browser's general download history and cannot determine whether the file was installed.

Repository monitoring is opt-in. Watched repositories, pending updates, ETags and local download history are stored in `storage.local` on the current device. These records can be cleared from the extension settings. No local history is written from private/incognito tabs.

Preferences are stored in `storage.sync` when supported. The browser vendor may synchronize those preferences according to its own sync policy. Download history and watched repositories are not synchronized by the extension.

## Background checks and notifications

Browser alarms periodically request public release metadata only for watched repositories. Disabling the extension or selecting manual-only checks stops scheduled requests.

System notifications are disabled by default and require the optional `notifications` permission. The toolbar badge works without notification permission.

## Data not accessed

The extension does not request or access:

- cookies;
- GitHub authentication tokens;
- account profile data;
- the browser's browsing-history database;
- the browser's general download history;
- personal communications;
- personal or sensitive information unrelated to the extension's stated function.

## Third parties

The only network service directly queried by the extension is GitHub's official API. Download and release links are URLs supplied by GitHub. There is no extension-operated backend, telemetry endpoint or advertising service.

GitHub processes requests according to its own terms and privacy policy.

## Chrome Web Store Limited Use disclosure

GitHub Download Now's use and transfer of information received through browser APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Information is used only to provide the extension's user-facing release-download and update-tracking functionality. It is not used for advertising, profiling, creditworthiness, sale to third parties or unrelated purposes, and is not made available for human review by the developer.

## User controls

Users can:

- disable all extension functionality;
- choose manual-only update checks;
- remove individual watched repositories;
- remove all watches;
- clear local download history;
- disable notification permission through browser settings;
- uninstall the extension to remove its stored local data.

## Changes

Material privacy changes will be documented in the changelog and release notes.
