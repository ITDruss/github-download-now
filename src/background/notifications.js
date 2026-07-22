(function initBackgroundNotifications(root, factory) {
  const api = factory();
  root.GHDNBackgroundNotifications = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundNotificationsApi() {
  "use strict";

  const NOTIFICATION_PREFIX = "ghdn-update:";
  const SUMMARY_NOTIFICATION = "ghdn-updates-summary";

  function create(options = {}) {
    const browserApi = options.browserApi;
    const extensionApi = options.extensionApi;
    const i18n = options.i18n;
    const settingsApi = options.settingsApi;
    const trackerState = options.trackerState;
    const navigation = options.navigation;
    if (!browserApi || !extensionApi || !i18n || !settingsApi || !trackerState || !navigation) {
      throw new Error("Notification dependencies are incomplete");
    }

    function hasNotificationPermission() {
      return browserApi.permissions.contains({ permissions: ["notifications"] });
    }

    function createNotification(id, notificationOptions) {
      return browserApi.notifications.create(id, notificationOptions);
    }

    async function notifyUpdates(updates, settings) {
      if (!settings.notificationsEnabled || !updates.length || !(await hasNotificationPermission())) return;
      const tr = i18n.create(settings.language);
      const t = tr.t;
      const iconUrl = extensionApi.runtime.getURL("icons/icon-128.png");
      if (updates.length === 1) {
        const update = updates[0];
        const assetText = update.compatibleAssetFound ? update.assetName : t("notificationNoAsset");
        await createNotification(`${NOTIFICATION_PREFIX}${encodeURIComponent(update.key)}`, {
          type: "basic",
          iconUrl,
          title: `${update.repo} ${update.releaseTag || t("notificationNewRelease")}`,
          message: `${update.fromTag || t("notificationPreviousRelease")} → ${update.releaseTag || t("notificationNewReleaseLabel")}\n${assetText}`
        });
        return;
      }
      const names = updates.slice(0, 3).map((item) => item.repo).join(", ");
      const extra = updates.length > 3 ? ` +${updates.length - 3}` : "";
      await createNotification(SUMMARY_NOTIFICATION, {
        type: "basic",
        iconUrl,
        title: t("notificationUpdatesAvailable", [updates.length]),
        message: `${names}${extra}`
      });
    }

    async function updateBadge(updatesArg = null, settingsArg = null) {
      const action = extensionApi.action || extensionApi.browserAction;
      if (!action || !action.setBadgeText) return;
      const settings = settingsArg || await settingsApi.get();
      const tr = i18n.create(settings.language);
      const updates = updatesArg || (await trackerState.readTrackerState()).updates;
      const text = settings.enabled && settings.badgeEnabled && updates.length ? String(Math.min(updates.length, 99)) : "";
      const title = updates.length
        ? tr.t(tr.pluralCategory(updates.length) === "one" ? "notificationBadgeOne" : "notificationBadgeOther", [updates.length])
        : tr.t("extensionName");
      try {
        await action.setBadgeText({ text });
        if (action.setBadgeBackgroundColor) await action.setBadgeBackgroundColor({ color: "#1f883d" });
        if (action.setTitle) await action.setTitle({ title });
      } catch (_error) {}
    }

    async function handleNotificationClick(notificationId) {
      if (notificationId === SUMMARY_NOTIFICATION) {
        return navigation.openExtensionPage("popup.html#updates");
      }
      if (!String(notificationId || "").startsWith(NOTIFICATION_PREFIX)) return { ok: false, ignored: true };
      const key = decodeURIComponent(notificationId.slice(NOTIFICATION_PREFIX.length));
      const state = await trackerState.readTrackerState();
      const update = state.updates.find((item) => item.key === key);
      if (!update) return { ok: false, error: "update_not_found" };
      return navigation.openTab(update.releaseUrl);
    }

    return Object.freeze({
      hasNotificationPermission,
      createNotification,
      notifyUpdates,
      updateBadge,
      handleNotificationClick
    });
  }

  return Object.freeze({ NOTIFICATION_PREFIX, SUMMARY_NOTIFICATION, create });
});
