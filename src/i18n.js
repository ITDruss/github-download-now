(function initI18n(root, factory) {
  const api = factory(root);
  root.GHDNI18n = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createI18n(root) {
  "use strict";

  const DEFAULT_LOCALE = "en";

  function catalogs() {
    return root.GHDNLocaleCatalogs && typeof root.GHDNLocaleCatalogs === "object"
      ? root.GHDNLocaleCatalogs
      : {};
  }

  function localeCandidates(value) {
    const clean = String(value || "").trim().replace(/-/g, "_");
    if (!clean) return [];
    const parts = clean.split("_").filter(Boolean);
    const candidates = [clean];
    if (parts.length > 1) candidates.push(parts[0]);
    return [...new Set(candidates)];
  }

  function supportedLocale(value) {
    const available = catalogs();
    for (const candidate of localeCandidates(value)) {
      const exact = Object.keys(available).find((item) => item.toLowerCase() === candidate.toLowerCase());
      if (exact) return exact;
    }
    return "";
  }

  function browserLanguage(explicitLanguage) {
    if (explicitLanguage) return explicitLanguage;
    const extensionApi = typeof browser !== "undefined" ? browser : typeof chrome !== "undefined" ? chrome : null;
    const apiLanguage = extensionApi?.i18n?.getUILanguage?.();
    return apiLanguage || root.navigator?.language || DEFAULT_LOCALE;
  }

  function resolveLocale(preference = "auto", explicitBrowserLanguage = "") {
    if (preference && preference !== "auto") return supportedLocale(preference) || DEFAULT_LOCALE;
    return supportedLocale(browserLanguage(explicitBrowserLanguage)) || DEFAULT_LOCALE;
  }

  function localeTag(locale) {
    return String(locale || DEFAULT_LOCALE).replace(/_/g, "-");
  }

  function substitutionValue(placeholders, substitutions, placeholderName) {
    if (!placeholders || !placeholders[placeholderName]) return "";
    if (substitutions && !Array.isArray(substitutions) && typeof substitutions === "object") {
      const direct = substitutions[placeholderName] ?? substitutions[placeholderName.toUpperCase()];
      if (direct !== undefined) return String(direct);
    }
    const position = Number(/^\$([1-9][0-9]*)$/.exec(placeholders[placeholderName].content || "")?.[1]);
    if (!Number.isFinite(position)) return "";
    const list = Array.isArray(substitutions) ? substitutions : substitutions === undefined ? [] : [substitutions];
    return list[position - 1] === undefined ? "" : String(list[position - 1]);
  }

  function formatEntry(entry, substitutions) {
    if (!entry || typeof entry.message !== "string") return "";
    const placeholders = entry.placeholders || {};
    return entry.message
      .replace(/\$([A-Za-z][A-Za-z0-9_]*)\$/g, (_match, rawName) => substitutionValue(placeholders, substitutions, rawName.toLowerCase()))
      .replace(/\$\$/g, "$");
  }

  function getMessage(locale, key, substitutions) {
    const available = catalogs();
    const entry = available[locale]?.[key] || available[DEFAULT_LOCALE]?.[key];
    return formatEntry(entry, substitutions);
  }

  function create(preference = "auto", explicitBrowserLanguage = "") {
    const locale = resolveLocale(preference, explicitBrowserLanguage);
    const tag = localeTag(locale);
    return Object.freeze({
      locale,
      tag,
      t: (key, substitutions) => getMessage(locale, key, substitutions),
      number: (value, options) => new Intl.NumberFormat(tag, options).format(value),
      date: (value, options) => new Intl.DateTimeFormat(tag, options).format(new Date(value)),
      time: (value, options) => new Intl.DateTimeFormat(tag, options).format(new Date(value)),
      pluralCategory: (value, options) => new Intl.PluralRules(tag, options).select(value)
    });
  }

  function availableLocales() {
    return Object.keys(catalogs()).sort().map((code) => ({
      code,
      name: getMessage(code, "localeName") || code
    }));
  }

  return Object.freeze({
    DEFAULT_LOCALE,
    supportedLocale,
    resolveLocale,
    localeTag,
    create,
    availableLocales,
    getMessage
  });
});
