from pathlib import Path
import os
from base64 import b64encode
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "test-results" / "settings-ui"
OUTPUTS.mkdir(parents=True, exist_ok=True)

MOCK = r'''
<script>
const __settings = {preferredLinux:"deb", primaryAction:"menu", enabled:true};
window.__dashboard = {
  ok: true,
  history: [],
  watches: [{
    key: "localsend/localsend", owner: "localsend", repo: "localsend", currentTag: "v1.17.0",
    currentAssetName: "LocalSend-1.17.0-linux-x86-64.AppImage",
    platform: {os: "linux", arch: "x64"}, lastCheckedAt: "2026-07-14T08:35:00Z"
  }],
  updates: [{
    key: "localsend/localsend", owner: "localsend", repo: "localsend",
    fromTag: "v1.17.0", releaseTag: "v1.18.0", releasePublishedAt: "2026-07-14T08:30:00Z",
    compatibleAssetFound: true, assetName: "LocalSend-1.18.0-linux-x86-64.AppImage", assetSize: 48234496,
    assetUrl: "https://github.com/localsend/localsend/releases/download/v1.18.0/LocalSend-1.18.0-linux-x86-64.AppImage",
    releaseUrl: "https://github.com/localsend/localsend/releases/tag/v1.18.0"
  }],
  meta: {lastCheckAt: "2026-07-14T08:35:00Z", lastCheckChecked: 8, lastCheckTotal: 12}
};
window.chrome = {
  runtime: {
    getManifest: () => ({version:"1.0.0"}),
    openOptionsPage: () => { window.__optionsOpened = true; },
    sendMessage: (message, callback) => {
      const response = message.type === "GHDN_GET_DASHBOARD"
        ? window.__dashboard
        : {ok:true, detected:[]};
      if (callback) callback(response);
    },
    lastError: null
  },
  permissions: { request: (_value, callback) => callback(true) },
  storage: {
    sync: {
      get: (defaults, callback) => callback({...defaults, ...__settings}),
      set: (values, callback) => { Object.assign(__settings, values); if (callback) callback(); },
      clear: (callback) => { for (const key of Object.keys(__settings)) delete __settings[key]; if (callback) callback(); }
    },
    onChanged: { addListener: () => {}, removeListener: () => {} }
  }
};
</script>
'''

def inline_page(name: str, scripts: list[str], stylesheet: str) -> str:
    html = (ROOT / "src" / name).read_text(encoding="utf-8")
    html = html.replace(f'<link rel="stylesheet" href="{stylesheet}">', f'<style>{(ROOT / "src" / stylesheet).read_text(encoding="utf-8")}</style>')
    for size in (48, 128):
        icon = b64encode((ROOT / "src" / "icons" / f"icon-{size}.png").read_bytes()).decode("ascii")
        html = html.replace(f'src="icons/icon-{size}.png"', f'src="data:image/png;base64,{icon}"')
    html = html.replace("<body>", "<body>" + MOCK)
    for script in scripts:
        html = html.replace(f'<script src="{script}"></script>', f'<script>{(ROOT / "src" / script).read_text(encoding="utf-8")}</script>')
    return html

with sync_playwright() as p:
    launch_options = {"headless": True, "args": ["--no-sandbox"]}
    chromium_path = os.environ.get("GHDN_CHROMIUM_PATH", "").strip()
    if chromium_path:
        launch_options["executable_path"] = chromium_path
    browser = p.chromium.launch(**launch_options)

    context = browser.new_context(viewport={"width": 380, "height": 560}, locale="ru-RU")
    page = context.new_page()
    page.set_content(inline_page("popup.html", ["settings.js", "popup.js"], "popup.css"), wait_until="load")
    page.wait_for_function("document.querySelector('#preferredFormat')?.value === 'deb'")
    assert page.locator("#detectedPlatform").text_content().startswith("Linux")
    assert page.locator("#primaryAction").input_value() == "menu"
    page.wait_for_selector("#updatesList .item")
    page.screenshot(path=str(OUTPUTS / "popup-updates-ru.png"), full_page=True)
    page.click('[data-tab="settings"]')
    page.wait_for_selector('[data-panel="settings"].active')
    page.evaluate("document.querySelector('#preferredFormat').value='appimage'; document.querySelector('#preferredFormat').dispatchEvent(new Event('change',{bubbles:true}));")
    page.wait_for_function("__settings.preferredLinux === 'appimage'")
    page.screenshot(path=str(OUTPUTS / "popup-settings-ru.png"), full_page=True)
    context.close()

    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ru-RU")
    page = context.new_page()
    page.set_content(inline_page("options.html", ["settings.js", "options.js"], "options.css"), wait_until="load")
    page.wait_for_function("document.querySelector('#preferredLinux')?.value === 'deb'")
    assert page.locator("#generalTitle").text_content() == "Общие настройки"
    page.evaluate("document.querySelector('#buttonStyle').value='native'; document.querySelector('#buttonStyle').dispatchEvent(new Event('change',{bubbles:true}));")
    page.wait_for_function("__settings.buttonStyle === 'native'")
    page.screenshot(path=str(OUTPUTS / "options-settings-ru.png"), full_page=False)
    context.close()

    browser.close()

print("Settings UI smoke test: OK")
