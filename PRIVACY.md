# Privacy policy

Effective date: July 14, 2026

GitHub Download Now does not sell user data and does not send data to the developer, analytics providers or advertising services.

## Public repositories only

GitHub Download Now is designed for public GitHub repositories. The extension does not request GitHub authentication tokens, does not read cookie values and does not intentionally process private repository content. The content script activates only after GitHub provides a positive public-repository marker. It remains inactive on private repositories and also fails closed when repository visibility cannot be established.

## Public GitHub page data

On a supported public repository page, the extension reads the repository owner, repository name, release tags and release-asset links already present in the page. It may anonymously request public GitHub pages at `github.com` to obtain release assets for another selected version. These requests use `credentials: omit`, so the extension does not attach the browser's GitHub session cookies.

Every release, source archive and navigation URL is validated against the expected `github.com` or `api.github.com` origin and the current owner/repository before it can be displayed, stored or opened.

## GitHub REST API requests

The extension may query the official public GitHub REST API at `api.github.com` when page data is unavailable, when the user explicitly requests build-document discovery, or when checking repositories the user chose to watch.

Build-document discovery may request public directory listings and the text of likely README files for the selected release tag. The extension analyses only Markdown headings such as “Building”, “Build from source” or a matching operating-system subsection, then links to the original GitHub section. It does not execute build commands or send repository content anywhere other than GitHub.

Update checks are rotated in small batches to reduce API usage. The extension locally records GitHub rate-limit information and pauses further checks until the published reset time when the limit is exhausted.

## Local installation guidance

Installation and launch guidance is generated entirely inside the extension from the selected asset filename, file extension, detected platform and interface language. These values are not sent to the developer or to an AI service. The extension does not execute commands, inspect downloaded files or determine whether installation succeeded.

## Local download history and update tracking

When a user starts a download through GitHub Download Now, the extension may store a local record containing:

- public repository owner and name;
- release ID and tag;
- selected asset name and validated GitHub URL;
- detected platform and architecture;
- time the download action was started.

The extension does not read the browser's general download history and cannot determine whether the file was installed.

Repository monitoring is opt-in. Watched repositories, pending updates, ETags, API scheduling metadata and local download history are stored in `storage.local` on the current device. These records can be cleared from extension settings. No local history is written from private/incognito tabs.

Preferences are stored in `storage.sync` when supported. The browser vendor may synchronize those preferences according to its own sync policy. Download history and watched repositories are not synchronized by the extension.

## Background checks and notifications

Browser alarms periodically request public release metadata only for watched repositories. A limited batch is checked on each run, and subsequent runs continue from the next repository. Disabling the extension or selecting manual-only checks stops scheduled requests.

System notifications are disabled by default and require the optional `notifications` permission. The toolbar badge works without notification permission.

## Data not accessed

The extension does not request or access:

- cookie values;
- GitHub authentication tokens;
- private repository content by design;
- account profile data;
- the browser's browsing-history database;
- the browser's general download history;
- personal communications;
- personal or sensitive information unrelated to the extension's stated function.

The extension observes only the currently open GitHub page needed to place its controls and identify the public repository. It does not query the browser history API.

## Third parties

The only network service directly queried by the extension is GitHub, through public pages at `github.com` and the official REST API at `api.github.com`. There is no extension-operated backend, telemetry endpoint, AI service or advertising service.

GitHub processes requests according to its own terms and privacy policy.

## Chrome Web Store Limited Use disclosure

GitHub Download Now's use and transfer of information received through browser APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Information is used only to provide the extension's user-facing release-download, installation-guidance and update-tracking functionality. It is not used for advertising, profiling, creditworthiness, sale to third parties or unrelated purposes, and is not made available for human review by the developer.

## User controls

Users can:

- disable all extension functionality;
- choose manual-only update checks;
- remove individual watched repositories;
- remove all watches;
- clear local download history;
- choose whether installation guidance is shown;
- disable notification permission through browser settings;
- uninstall the extension to remove its stored local data.

## Changes

Material privacy changes will be documented in the changelog and release notes.
