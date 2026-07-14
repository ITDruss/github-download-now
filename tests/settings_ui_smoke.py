from pathlib import Path
from base64 import b64encode
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"

MOCK = r'''
<script>
const __settings = {preferredLinux:"deb", primaryAction:"menu", enabled:true};
window.chrome = {
  runtime: {
    getManifest: () => ({version:"0.4.2"}),
    openOptionsPage: () => { window.__optionsOpened = true; },
    sendMessage: (message, callback) => {
      const response = message.type === "GHDN_GET_DASHBOARD"
        ? {ok:true, history:[], watches:[], updates:[], meta:{}}
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
    browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])

    context = browser.new_context(viewport={"width": 380, "height": 560}, locale="ru-RU")
    page = context.new_page()
    page.set_content(inline_page("popup.html", ["settings.js", "popup.js"], "popup.css"), wait_until="load")
    page.wait_for_function("document.querySelector('#preferredFormat')?.value === 'deb'")
    assert page.locator("#detectedPlatform").text_content().startswith("Linux")
    assert page.locator("#primaryAction").input_value() == "menu"
    page.evaluate("document.querySelector('#preferredFormat').value='appimage'; document.querySelector('#preferredFormat').dispatchEvent(new Event('change',{bubbles:true}));")
    page.wait_for_function("__settings.preferredLinux === 'appimage'")
    page.screenshot(path=str(ASSETS / "popup-settings-ru.png"), full_page=True)
    context.close()

    context = browser.new_context(viewport={"width": 1100, "height": 900}, locale="ru-RU")
    page = context.new_page()
    page.set_content(inline_page("options.html", ["settings.js", "options.js"], "options.css"), wait_until="load")
    page.wait_for_function("document.querySelector('#preferredLinux')?.value === 'deb'")
    assert page.locator("#generalTitle").text_content() == "Общие настройки"
    page.evaluate("document.querySelector('#buttonStyle').value='native'; document.querySelector('#buttonStyle').dispatchEvent(new Event('change',{bubbles:true}));")
    page.wait_for_function("__settings.buttonStyle === 'native'")
    page.screenshot(path=str(ASSETS / "options-settings-ru.png"), full_page=True)
    context.close()

    browser.close()

print("Settings UI smoke test: OK")
