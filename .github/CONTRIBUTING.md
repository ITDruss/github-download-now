# Contributing

Thanks for helping improve GitHub Download Now.

## Development

1. Install Node.js 20 or newer.
2. Run `npm test`.
3. Build both browser targets with `npm run build`.
4. Load `dist/chromium` or `dist/firefox` as an unpacked/temporary extension.

Keep the extension privacy-friendly: avoid telemetry, remote code, broad host permissions and unnecessary account access.

## Pull requests

- Keep each pull request focused.
- Add or update selector tests when changing asset matching.
- Test light and dark GitHub themes.
- Explain any new permission in the pull request description.
