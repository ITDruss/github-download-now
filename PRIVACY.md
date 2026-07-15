# Privacy policy

Effective date: July 14, 2026

GitHub Download Now does not sell user data and does not send data to the developer, analytics providers or advertising services.

## Public repositories only

GitHub Download Now is designed for public GitHub repositories. The content script activates only after GitHub provides a positive public-repository marker. It remains inactive on private repositories and also fails closed when repository visibility cannot be established.

The optional GitHub connection does not change this product rule. The extension does not intentionally request, display, download, monitor or analyse private repository content.

## Public GitHub page data

On a supported public repository page, the extension reads the repository owner, repository name, release tags and release-asset links already present in the page. It may anonymously request public GitHub pages at `github.com` to obtain release assets for another selected version. These page requests use `credentials: omit`, so the extension does not attach the browser's GitHub session cookies.

Every release, source archive and navigation URL is validated against the expected `github.com` or `api.github.com` origin and the current owner/repository before it can be displayed, stored or opened.

## GitHub REST API requests

The extension may query the official GitHub REST API at `api.github.com` when page data is unavailable, when the user explicitly requests build-document discovery, or when checking repositories the user chose to watch.

Build-document discovery may request public directory listings and the text of likely README files for the selected release tag. It first checks dedicated build documents and useful sections in root documentation. It may then follow at most three relevant same-repository links found in a README, with a maximum depth of one, two linked directories and three additional documents. Links are restricted to the same public owner/repository and are re-bound to the selected release tag instead of silently switching to another branch. The extension analyses headings such as “Building”, then links to the original GitHub section. It does not execute build commands or transmit repository content to the developer, an AI service or any service other than GitHub.

Update checks are rotated in small batches to reduce API usage. The extension locally records GitHub rate-limit information and pauses additional discovery before exhausting a reserved request budget.

## Optional GitHub connection

A user may voluntarily select **Connect GitHub** in extension settings. The extension uses GitHub's OAuth Device Flow and opens the official `https://github.com/login/device` page. The extension:

- never asks for or reads the user's GitHub password;
- does not read GitHub cookies or reuse the browser's signed-in session;
- does not embed or transmit an OAuth client secret;
- requests no OAuth scopes;
- uses the resulting token only with the official `api.github.com` REST API;
- uses the token to increase the applicable API limit for public release, documentation and watch requests.

The OAuth access token is authentication information. It is stored in `storage.local` in the current browser profile, is not placed in `storage.sync`, is not sent to the developer and is not shared with content scripts by the extension. Browser extension storage is not an encrypted credential vault; a person or program with sufficient access to the local browser profile or extension developer tools may be able to inspect it. Selecting **Disconnect** removes the stored token and any unfinished one-time authorization state from the current browser profile. It does not revoke the OAuth authorization at GitHub; users who also want server-side revocation can remove **Download Now for GitHub** under GitHub Settings → Applications. Uninstalling the extension also removes extension storage according to the browser's normal behavior.

During the connection process, the temporary device code is stored locally until it expires or authorization finishes. The extension checks GitHub's rate-limit endpoint to validate the token and show the remaining API budget. It does not request the user's GitHub profile, email address or private repository list.

Without a GitHub connection, all existing public-repository functionality continues to work with anonymous API limits.

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

Preferences are stored in `storage.sync` when supported. The browser vendor may synchronize those preferences according to its own sync policy. Download history, watched repositories and the optional GitHub token are not synchronized by the extension.

## Background checks and notifications

Browser alarms periodically request public release metadata only for watched repositories. A limited batch is checked on each run, and subsequent runs continue from the next repository. Disabling the extension or selecting manual-only checks stops scheduled requests.

System notifications are disabled by default and require the optional `notifications` permission. The toolbar badge works without notification permission.

## Data not accessed

Except for the optional OAuth token described above, the extension does not request or access:

- cookie values;
- GitHub passwords;
- private repository content by design;
- GitHub account profile or email data;
- the browser's browsing-history database;
- the browser's general download history;
- personal communications;
- personal or sensitive information unrelated to the extension's stated function.

The extension observes only the currently open GitHub page needed to place its controls and identify the public repository. It does not query the browser history API.

## Third parties

The only network service directly queried by the extension is GitHub, through pages and OAuth endpoints at `github.com` and the official REST API at `api.github.com`. There is no extension-operated backend, telemetry endpoint, AI service or advertising service.

GitHub processes requests according to its own terms and privacy policy.

## Chrome Web Store Limited Use disclosure

GitHub Download Now's use and transfer of information received through browser APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Information is used only to provide the extension's user-facing release-download, build-document discovery, installation-guidance, optional GitHub authentication and update-tracking functionality. It is not used for advertising, profiling, creditworthiness, sale to third parties or unrelated purposes, and is not made available for human review by the developer.

## Firefox data-collection disclosure

Firefox declares `browsingActivity` as required because the extension reads the currently open public GitHub repository page to place its controls. `authenticationInfo` is declared as optional and is requested only after the user selects **Connect GitHub**. Refusing that optional consent leaves the extension in anonymous public-only mode.

## User controls

Users can:

- use the extension without connecting GitHub;
- connect or disconnect GitHub from settings;
- disable all extension functionality;
- choose manual-only update checks;
- remove individual watched repositories;
- remove all watches;
- clear local download history;
- choose whether installation guidance is shown;
- disable notification permission through browser settings;
- uninstall the extension to remove its stored extension data.

## Changes

Material privacy changes will be documented in the changelog and release notes.
