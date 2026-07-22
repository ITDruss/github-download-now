(function initBackgroundAlarms(root, factory) {
  const api = factory();
  root.GHDNBackgroundAlarms = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundAlarmsApi() {
  "use strict";

  const UPDATE_ALARM = "ghdn-update-check";
  const INTERVAL_MINUTES = Object.freeze({ "6h": 360, "24h": 1440, "72h": 4320, "168h": 10080 });

  function create(options = {}) {
    const browserApi = options.browserApi;
    const extensionApi = options.extensionApi;
    const settingsApi = options.settingsApi;
    if (!browserApi || !extensionApi || !settingsApi) throw new Error("Alarm dependencies are incomplete");

    function getAlarm(name) {
      return browserApi.alarms.get(name);
    }

    function clearAlarm(name) {
      return browserApi.alarms.clear(name);
    }

    function createAlarm(name, alarmInfo) {
      return browserApi.alarms.create(name, alarmInfo);
    }

    async function ensureUpdateAlarm() {
      if (!extensionApi.alarms || !extensionApi.alarms.create) return;
      const settings = await settingsApi.get();
      const periodInMinutes = settings.enabled ? INTERVAL_MINUTES[settings.updateCheckInterval] : 0;
      const existing = await getAlarm(UPDATE_ALARM);

      if (!periodInMinutes) {
        if (existing) await clearAlarm(UPDATE_ALARM);
        return;
      }

      if (existing && Number(existing.periodInMinutes) === periodInMinutes) return;
      if (existing) await clearAlarm(UPDATE_ALARM);
      await createAlarm(UPDATE_ALARM, { delayInMinutes: Math.min(5, periodInMinutes), periodInMinutes });
    }

    function isUpdateAlarm(alarm) {
      return Boolean(alarm && alarm.name === UPDATE_ALARM);
    }

    return Object.freeze({ getAlarm, clearAlarm, createAlarm, ensureUpdateAlarm, isUpdateAlarm });
  }

  return Object.freeze({ UPDATE_ALARM, INTERVAL_MINUTES, create });
});
