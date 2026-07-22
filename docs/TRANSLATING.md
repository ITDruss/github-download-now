# Translating GitHub Download Now

GitHub Download Now uses the standard WebExtensions `_locales` format. English is the default and fallback locale. Russian is maintained as the second built-in locale.

## Add a language

1. Choose the WebExtensions locale code, for example `de`, `fr`, `uk`, `pt_BR` or `zh_CN`.
2. Copy the English catalog:

   ```bash
   cp -a src/_locales/en src/_locales/de
   ```

3. Translate only the `message` values in `src/_locales/de/messages.json`.
4. Keep every message key unchanged.
5. Keep placeholders such as `$COUNT$`, `$TIME$`, `$FORMAT$` and `$REPOSITORY$` unchanged.
6. Translate `localeName` to the language's own name, for example `Deutsch`.
7. Generate the runtime catalog and run validation:

   ```bash
   npm run i18n:generate
   npm run i18n:check
   npm test
   ```

8. Include both the new `messages.json` and regenerated `src/i18n-catalogs.js` in the pull request.

The language selector is generated from the locale directories automatically. No JavaScript, manifest or allowlist edits are required for a normal new translation.

## Message format

Each entry follows the Chrome and Firefox `messages.json` format:

```json
{
  "contentDownloadFormat": {
    "message": "Download $FORMAT$",
    "description": "User-facing extension text: contentDownloadFormat.",
    "placeholders": {
      "format": {
        "content": "$1"
      }
    }
  }
}
```

Do not translate placeholder names inside `$...$`. Their definitions must match the English catalog exactly.

## Fallback behavior

- `auto` uses the browser UI language when that locale exists.
- Unsupported browser languages fall back to English.
- A manually selected language is used across the GitHub page UI, popup, options page, installation guides and update notifications.
- Missing keys fail CI instead of silently producing a partially translated release.

## Translation style

- Prefer natural interface language over literal word-for-word translation.
- Keep button labels short.
- Preserve product names, file extensions and command-line examples.
- Do not change shell commands or URLs.
- Review security warnings carefully; their meaning must not be weakened.

## Updating an existing locale

When English gains a message, every locale must add the same key and placeholders. `npm run i18n:check` prints missing, extra or mismatched entries.
