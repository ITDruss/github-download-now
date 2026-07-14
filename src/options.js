"use strict";

(() => {
  const extensionApi = typeof browser !== "undefined" ? browser : chrome;
  const settingsApi = globalThis.GHDNSettings;
  let settings;
  let saveTimer;

  const dictionaries = {
    ru: {
      subtitle: "Настройка рекомендаций, интерфейса и фоновой проверки обновлений.", general: "Общие настройки", language: "Язык", showOn: "Где показывать кнопку",
      all: "На всех страницах репозитория", mainReleases: "На главной и в Releases", main: "Только на главной",
      buttonStyle: "Стиль кнопки", accent: "Зелёная акцентная", native: "Нативная GitHub", compact: "Компактная",
      primaryAction: "Нажатие основной кнопки", download: "Скачать рекомендацию", menu: "Всегда открыть меню", release: "Открыть страницу Releases",
      installGuidance: "Подсказки по установке", guidanceBeginner: "Показывать после загрузки и в меню", guidanceCompact: "Только по запросу в меню", guidanceOff: "Не показывать",
      enabled: "Расширение включено", subtitleToggle: "Показывать ОС и архитектуру", otherPlatforms: "Показывать другие платформы",
      sourceCode: "Показывать исходный код", reasons: "Объяснять рекомендацию", system: "Система и архитектура",
      systemNote: "Оставьте автоопределение, если расширение правильно распознаёт ваше устройство.", os: "Операционная система", arch: "Архитектура",
      auto: "Автоматически", browserLanguage: "Как в браузере", formats: "Предпочитаемые форматы", archive: "Архив", releases: "Релизы", channel: "Какой релиз использовать",
      stable: "Последний стабильный", newest: "Самый новый, включая prerelease", stale: "Предупреждать, если релиз старше", never: "Не предупреждать",
      months: "месяцев", saved: "Сохранено", reset: "Сбросить настройки", resetDone: "Настройки сброшены",
      updatesTitle: "История и обновления", updatesNote: "История и список отслеживания хранятся локально на этом устройстве.",
      afterDownload: "После загрузки", ask: "Спрашивать о слежении", always: "Всегда начинать слежение", neverAsk: "Никогда не предлагать",
      interval: "Проверять обновления", manual: "Только вручную", h6: "Каждые 6 часов", h24: "Раз в день", h72: "Раз в 3 дня", h168: "Раз в неделю",
      historyEnabled: "Записывать загрузки через расширение", notifications: "Показывать системные уведомления", badge: "Показывать счётчик на иконке",
      checkNow: "Проверить обновления", clearHistory: "Очистить историю", clearTracking: "Удалить все подписки", checking: "Проверка…", permissionDenied: "Разрешение на уведомления не выдано",
      checkSummary: (found, failed) => `Найдено: ${found} · Ошибок: ${failed}`, rateLimited: (time) => time ? `Лимит GitHub API исчерпан до ${time}` : "Лимит GitHub API исчерпан"
    },
    en: {
      subtitle: "Configure recommendations, interface and background update checks.", general: "General", language: "Language", showOn: "Where to show the button",
      all: "All repository pages", mainReleases: "Repository home and Releases", main: "Repository home only",
      buttonStyle: "Button style", accent: "Green accent", native: "Native GitHub", compact: "Compact",
      primaryAction: "Main button action", download: "Download recommendation", menu: "Always open menu", release: "Open Releases page",
      installGuidance: "Installation guidance", guidanceBeginner: "Show after download and in the menu", guidanceCompact: "Only on request in the menu", guidanceOff: "Do not show",
      enabled: "Extension enabled", subtitleToggle: "Show OS and architecture", otherPlatforms: "Show other platforms",
      sourceCode: "Show source code", reasons: "Explain recommendations", system: "System and architecture",
      systemNote: "Keep automatic detection unless the extension identifies your device incorrectly.", os: "Operating system", arch: "Architecture",
      auto: "Automatic", browserLanguage: "Browser language", formats: "Preferred formats", archive: "Archive", releases: "Releases", channel: "Release selection",
      stable: "Latest stable", newest: "Newest, including prerelease", stale: "Warn when release is older than", never: "Never warn",
      months: "months", saved: "Saved", reset: "Reset settings", resetDone: "Settings reset",
      updatesTitle: "History and updates", updatesNote: "Download history and watched repositories are stored locally on this device.",
      afterDownload: "After a download", ask: "Ask whether to watch", always: "Always start watching", neverAsk: "Never ask",
      interval: "Check for updates", manual: "Manual only", h6: "Every 6 hours", h24: "Once a day", h72: "Every 3 days", h168: "Once a week",
      historyEnabled: "Record downloads made through the extension", notifications: "Show system notifications", badge: "Show toolbar badge",
      checkNow: "Check for updates", clearHistory: "Clear history", clearTracking: "Remove all watches", checking: "Checking…", permissionDenied: "Notification permission was not granted",
      checkSummary: (found, failed) => `Found: ${found} · Failed: ${failed}`, rateLimited: (time) => time ? `GitHub API limit reached until ${time}` : "GitHub API limit reached"
    }
  };

  const fields = ["enabled","language","osOverride","archOverride","preferredLinux","preferredWindows","preferredMacos","preferredAndroid","primaryAction","installGuidance","buttonStyle","showSubtitle","showOtherPlatforms","showSourceCode","showRecommendationReason","releaseChannel","staleReleaseMonths","showOn","historyEnabled","afterDownload","updateCheckInterval","notificationsEnabled","badgeEnabled"];

  function locale() {
    if (settings && settings.language === "ru") return "ru";
    if (settings && settings.language === "en") return "en";
    return /^(ru|uk|be|kk)(-|$)/i.test(navigator.language || "") ? "ru" : "en";
  }

  function setText(id, value) { document.getElementById(id).textContent = value; }
  function optionText(selectId, value, text) { const node = document.querySelector(`#${selectId} option[value="${value}"]`); if (node) node.textContent = text; }

  function translate() {
    const t = dictionaries[locale()];
    document.documentElement.lang = locale(); document.title = `GitHub Download Now — ${locale()==="ru"?"Настройки":"Settings"}`;
    const labels = {
      subtitle:t.subtitle,generalTitle:t.general,languageLabel:t.language,showOnLabel:t.showOn,buttonStyleLabel:t.buttonStyle,primaryActionLabel:t.primaryAction,installGuidanceLabel:t.installGuidance,
      enabledLabel:t.enabled,showSubtitleLabel:t.subtitleToggle,showOtherPlatformsLabel:t.otherPlatforms,showSourceCodeLabel:t.sourceCode,showRecommendationReasonLabel:t.reasons,
      systemTitle:t.system,systemNote:t.systemNote,osOverrideLabel:t.os,archOverrideLabel:t.arch,formatsTitle:t.formats,releasesTitle:t.releases,releaseChannelLabel:t.channel,staleReleaseLabel:t.stale,
      updatesSettingsTitle:t.updatesTitle,updatesSettingsNote:t.updatesNote,afterDownloadLabel:t.afterDownload,updateCheckIntervalLabel:t.interval,historyEnabledLabel:t.historyEnabled,
      notificationsEnabledLabel:t.notifications,badgeEnabledLabel:t.badge,checkUpdatesNow:t.checkNow,clearHistory:t.clearHistory,clearTracking:t.clearTracking,reset:t.reset
    };
    for (const [id,value] of Object.entries(labels)) setText(id,value);
    optionText("showOn","all",t.all); optionText("showOn","main_releases",t.mainReleases); optionText("showOn","main",t.main);
    optionText("buttonStyle","accent",t.accent); optionText("buttonStyle","native",t.native); optionText("buttonStyle","compact",t.compact);
    optionText("primaryAction","download",t.download); optionText("primaryAction","menu",t.menu); optionText("primaryAction","release",t.release);
    optionText("installGuidance","beginner",t.guidanceBeginner); optionText("installGuidance","compact",t.guidanceCompact); optionText("installGuidance","off",t.guidanceOff);
    optionText("releaseChannel","stable",t.stable); optionText("releaseChannel","newest",t.newest); optionText("language","auto",t.browserLanguage);
    for (const id of ["osOverride","archOverride","preferredLinux","preferredWindows","preferredMacos","preferredAndroid"]) optionText(id,"auto",t.auto);
    optionText("preferredLinux","archive",t.archive); optionText("staleReleaseMonths","0",t.never);
    for (const value of ["3","6","12","24","36"]) optionText("staleReleaseMonths",value,`${value} ${t.months}`);
    optionText("afterDownload","ask",t.ask); optionText("afterDownload","always",t.always); optionText("afterDownload","never",t.neverAsk);
    optionText("updateCheckInterval","manual",t.manual); optionText("updateCheckInterval","6h",t.h6); optionText("updateCheckInterval","24h",t.h24); optionText("updateCheckInterval","72h",t.h72); optionText("updateCheckInterval","168h",t.h168);
  }

  function fill() { for (const key of fields) { const node=document.getElementById(key); if (node.type==="checkbox") node.checked=Boolean(settings[key]); else node.value=String(settings[key]); } }
  function collect() { const patch={}; for (const key of fields) { const node=document.getElementById(key); patch[key]=node.type==="checkbox"?node.checked:node.value; } patch.staleReleaseMonths=Number(patch.staleReleaseMonths); return patch; }
  function status(message) { setText("status",message); clearTimeout(status.timer); status.timer=setTimeout(()=>setText("status",""),1800); }
  function send(message) { if (typeof browser!=="undefined") return extensionApi.runtime.sendMessage(message); return new Promise((resolve,reject)=>extensionApi.runtime.sendMessage(message,(response)=>{const error=extensionApi.runtime.lastError;if(error)reject(new Error(error.message));else resolve(response);})); }
  async function requestNotifications() { if (!extensionApi.permissions || !extensionApi.permissions.request) return false; if (typeof browser!=="undefined") return extensionApi.permissions.request({permissions:["notifications"]}); return new Promise((resolve)=>extensionApi.permissions.request({permissions:["notifications"]},resolve)); }
  async function save() { settings=await settingsApi.set(collect()); translate(); status(dictionaries[locale()].saved); }

  async function init() {
    settings=await settingsApi.get(); translate(); fill();
    for (const key of fields) {
      const node=document.getElementById(key);
      node.addEventListener("change",async()=>{
        if (key==="notificationsEnabled" && node.checked && !(await requestNotifications())) { node.checked=false; status(dictionaries[locale()].permissionDenied); }
        clearTimeout(saveTimer); saveTimer=setTimeout(()=>save().catch(console.error),120);
      });
    }
    document.getElementById("checkUpdatesNow").addEventListener("click",async()=>{
      const button=document.getElementById("checkUpdatesNow");
      button.disabled=true;
      button.textContent=dictionaries[locale()].checking;
      try{
        const result=await send({type:"GHDN_CHECK_UPDATES"});
        const errors=result&&Array.isArray(result.errors)?result.errors:[];
        const limited=errors.find((item)=>item&&item.error==="rate_limited");
        if(limited){
          const time=limited.resetAt?new Date(limited.resetAt).toLocaleTimeString(locale()==="ru"?"ru-RU":"en-US",{hour:"2-digit",minute:"2-digit"}):"";
          status(dictionaries[locale()].rateLimited(time));
        }else{
          const found=result&&Array.isArray(result.detected)?result.detected.length:0;
          status(dictionaries[locale()].checkSummary(found,errors.length));
        }
      }finally{button.disabled=false;button.textContent=dictionaries[locale()].checkNow;}
    });
    document.getElementById("clearHistory").addEventListener("click",async()=>{await send({type:"GHDN_CLEAR_HISTORY"});status(dictionaries[locale()].saved);});
    document.getElementById("clearTracking").addEventListener("click",async()=>{await send({type:"GHDN_CLEAR_TRACKING"});status(dictionaries[locale()].saved);});
    document.getElementById("reset").addEventListener("click",async()=>{settings=await settingsApi.reset();translate();fill();status(dictionaries[locale()].resetDone);});
  }

  init().catch(console.error);
})();
