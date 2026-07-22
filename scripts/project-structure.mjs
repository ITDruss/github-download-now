export const SHARED_FOUNDATION_FILES = Object.freeze([
  "shared/messages.js",
  "shared/browser-api.js",
  "shared/formatting.js"
]);

export const LOCALE_RUNTIME_FILES = Object.freeze([
  "i18n-catalogs.js",
  "i18n.js"
]);

export const CONTENT_MODULES = Object.freeze([
  "content/strings.js",
  "content/platform.js",
  "content/repository-context.js",
  "content/github-dom.js",
  "content/placement.js",
  "content/state.js",
  "content/page-client.js",
  "content/release/page-parser.js",
  "content/release/release-loader.js",
  "content/release/version-controller.js",
  "content/lifecycle.js",
  "content/actions.js",
  "content/mount-controller.js",
  "content/ui/icons.js",
  "content/ui/elements.js",
  "content/ui/download-button.js",
  "content/ui/menu-shell.js",
  "content/ui/notices.js",
  "content/ui/install-guidance.js",
  "content/ui/build-documents.js",
  "content/ui/asset-list.js",
  "content/ui/release-menu.js"
]);

export const CONTENT_SCRIPTS = Object.freeze([
  ...SHARED_FOUNDATION_FILES,
  ...LOCALE_RUNTIME_FILES,
  "settings.js",
  "url-policy.js",
  "asset-selector.js",
  "install-guides.js",
  ...CONTENT_MODULES,
  "content.js"
]);

export const CONTENT_STYLES = Object.freeze([
  "styles/content-base.css",
  "styles/download-menu.css",
  "styles/asset-list.css",
  "styles/notices.css",
  "styles/install-guidance.css",
  "styles/build-documents.css",
  "styles/version-selector.css"
]);

export const BACKGROUND_MODULES = Object.freeze([
  "background/storage.js",
  "background/github-client.js",
  "background/release-service.js",
  "background/build-service.js",
  "background/navigation.js",
  "background/auth-service.js",
  "background/tracker-state.js",
  "background/alarms.js",
  "background/notifications.js",
  "background/tracking-service.js",
  "background/message-router.js"
]);

export const BACKGROUND_IMPORTS = Object.freeze([
  "shared/messages.js",
  "shared/browser-api.js",
  ...LOCALE_RUNTIME_FILES,
  "settings.js",
  "url-policy.js",
  "asset-selector.js",
  "tracker.js",
  "build-instructions.js",
  "github-auth.js",
  ...BACKGROUND_MODULES
]);

export const FIREFOX_BACKGROUND_SCRIPTS = Object.freeze([
  ...BACKGROUND_IMPORTS,
  "background.js"
]);

export const EXTENSION_PAGE_BASE_SCRIPTS = Object.freeze([
  ...SHARED_FOUNDATION_FILES,
  ...LOCALE_RUNTIME_FILES,
  "settings.js"
]);

export const POPUP_MODULES = Object.freeze([
  "popup/strings.js",
  "popup/view.js",
  "popup/settings-controller.js",
  "popup/dashboard-controller.js"
]);

export const POPUP_SCRIPTS = Object.freeze([
  ...EXTENSION_PAGE_BASE_SCRIPTS,
  ...POPUP_MODULES,
  "popup.js"
]);

export const OPTIONS_MODULES = Object.freeze([
  "options/strings.js",
  "options/view.js",
  "options/form.js",
  "options/auth-panel.js",
  "options/update-actions.js"
]);

export const OPTIONS_SCRIPTS = Object.freeze([
  ...EXTENSION_PAGE_BASE_SCRIPTS,
  ...OPTIONS_MODULES,
  "options.js"
]);

export const ENTRY_LINE_LIMITS = Object.freeze({
  "content.js": 300,
  "background.js": 200,
  "popup.js": 120,
  "options.js": 120
});

export const GENERATED_SOURCE_FILES = Object.freeze(new Set([
  "i18n-catalogs.js"
]));

export const SOURCE_LINE_LIMITS = Object.freeze({
  javascript: 400,
  css: 350,
  html: 250
});
