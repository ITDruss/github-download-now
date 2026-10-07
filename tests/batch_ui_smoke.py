from pathlib import Path
import json
import os
import re
from base64 import b64encode
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "test-results" / "batch-ui"
OUTPUTS.mkdir(parents=True, exist_ok=True)
MOCK = r'''<script>
window.__selectedLinks = "";
Object.defineProperty(navigator, "clipboard", {value:{writeText:async text=>{window.__selectedLinks=text;}}});
window.__grant = false;
window.__requested = 0;
window.__gesture = false;
window.__started = [];
window.__batch = null;
window.__watches = [];
const __names = ["app.ZIP", "app.tar.gz", "app.gz", "SHA256SUMS", "digest.sha256", ...Array.from({length:20},(_,i)=>`extra-${i}.exe`)];
const __assets = __names.map((name,id)=>({id,name,size:1000,browser_download_url:`https://github.com/Acme/Tool/releases/download/v1/${name}`}));
window.chrome = {
  runtime: {lastError:null,sendMessage(message, callback) {
    let value={ok:true};
    if(message.type==="GHDN_GET_BATCH_ASSETS") value={ok:true,complete:true,release:{id:123,name:"Tool v1",tag_name:"v1",html_url:"https://github.com/Acme/Tool/releases/tag/v1",assets:__assets}};
    if(message.type==="GHDN_GET_BATCH_STATUS") value={ok:true,batch:window.__batch};
    if(message.type==="GHDN_START_BATCH") {
      window.__started.push(message);
      window.__batch={id:"test-batch",owner:"Acme",repo:"Tool",tag:"v1",items:message.urls.map(url=>({url,name:url.split('/').pop(),state:"in_progress"}))};
      value={ok:true,batch:window.__batch};
    }
    if(message.type==="GHDN_CANCEL_BATCH") {window.__batch.items.forEach(item=>item.state="canceled");value={ok:true,batch:window.__batch};}
    if(message.type==="GHDN_CLEAR_BATCH") {window.__batch=null;value={ok:true,batch:null};}
    if(message.type==="GHDN_WATCH_REPOSITORY") window.__watches.push(message.download);
    callback(value);
  }},
  storage:{sync:{get(defaults,callback){callback({...defaults,language:window.__testLocale});}}},
  permissions:{request(value,callback){
    window.__gesture=navigator.userActivation.isActive;
    window.__requested++;
    if(window.__grant) window.chrome.downloads={download(){}};
    callback(window.__grant);
  }}
};
</script>'''

def inline_html(locale):
    html = (ROOT / "src/batch.html").read_text(encoding="utf-8")
    html = html.replace('src="icons/icon-48.png"', 'src="data:image/png;base64,' + b64encode((ROOT / "src/icons/icon-48.png").read_bytes()).decode() + '"')
    html = html.replace('<link rel="stylesheet" href="batch.css">', f'<style>{(ROOT / "src/batch.css").read_text(encoding="utf-8")}</style>')
    for relative in re.findall(r'<script src="([^"]+)"', html):
        html = html.replace(f'<script src="{relative}"></script>', f'<script>{(ROOT / "src" / relative).read_text(encoding="utf-8")}</script>')
    return html.replace('<script>', f'<script>window.__testLocale={json.dumps(locale)};</script>{MOCK}<script>', 1)

with sync_playwright() as p:
    browsers = os.environ.get("GHDN_UI_BROWSERS", "chromium").split(",")
    for name in browsers:
        print(f"Testing {name}", flush=True)
        browser = getattr(p, name).launch(headless=True)
        for locale, theme, width in [("en", "light", 1280), ("ru", "dark", 390)]:
            context = browser.new_context(viewport={"width": width, "height": 900}, color_scheme=theme, locale=locale)
            page = context.new_page()
            page.route("https://extension.test/**", lambda route: route.fulfill(content_type="text/html", body=inline_html(locale)))
            page.goto("https://extension.test/batch.html?owner=Acme&repo=Tool&tag=v1")
            page.wait_for_selector(".asset")
            assert page.locator(".asset").count() == 25
            page.locator("#select-all").click()
            assert page.locator(".asset input:checked").count() == 25
            page.locator("#copy-links").click()
            assert len(page.evaluate("window.__selectedLinks").splitlines()) == 25
            assert "SHA256SUMS" in page.evaluate("window.__selectedLinks")
            page.locator('#formats input[value=".zip"]').check()
            assert page.locator(".asset").count() == 1
            assert page.locator("#download").is_disabled(), "changing the filter clears old selections"
            page.locator("#select-all").click()
            page.locator("#download").click()
            assert page.evaluate("window.__requested") == 1
            assert page.evaluate("window.__gesture") is True
            assert page.evaluate("window.__started.length") == 0
            page.evaluate("window.__grant=true")
            page.locator("#download").click()
            page.wait_for_selector("#queue:not([hidden])")
            assert page.evaluate("window.__started[0].urls.length") == 1
            assert page.evaluate("window.__started[0].urls[0].endsWith('app.ZIP')")
            page.locator("#cancel").click()
            page.wait_for_function("window.__batch.items[0].state==='canceled'")
            page.evaluate("window.__batch.items[0].state='complete'")
            page.locator("#refresh").click()
            page.wait_for_function("!document.getElementById('watch').disabled")
            page.locator("#watch").click()
            assert page.evaluate("window.__watches.length") == 1
            assert page.evaluate("window.__watches[0].releaseId") == 123
            assert page.locator("#watch").is_disabled(), "one repository-level watch offer, not one per file"
            page.locator('#formats input[value=".zip"]').uncheck()
            page.locator('#formats input[value=".tar.gz"]').check()
            assert page.locator(".asset").count() == 1
            assert page.locator(".asset").inner_text().startswith("app.tar.gz")
            page.locator("#search").fill("missing-file")
            assert page.locator(".asset").count() == 0
            page.locator("#search").fill("")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "no horizontal overflow"
            page.screenshot(path=str(OUTPUTS / f"{name}-{locale}-{theme}.png"), full_page=True)
            context.close()
        browser.close()
print(f"Batch UI smoke tests: OK ({', '.join(browsers)}; RU/EN; light/dark; narrow/wide)")
