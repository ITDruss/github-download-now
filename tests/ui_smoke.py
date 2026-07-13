from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "tests" / "fixtures" / "demo.html"
ASSETS = ROOT / "assets"

html = DEMO.read_text(encoding="utf-8")
html = html.replace(
    '<link rel="stylesheet" href="../../src/styles.css">',
    f'<style>{(ROOT / "src" / "styles.css").read_text(encoding="utf-8")}</style>'
)
html = html.replace(
    '<script src="../../src/settings.js"></script>',
    f'<script>{(ROOT / "src" / "settings.js").read_text(encoding="utf-8")}</script>'
)
html = html.replace(
    '<script src="../../src/asset-selector.js"></script>',
    f'<script>{(ROOT / "src" / "asset-selector.js").read_text(encoding="utf-8")}</script>'
)
html = html.replace(
    '<script src="../../src/content.js"></script>',
    f'<script>{(ROOT / "src" / "content.js").read_text(encoding="utf-8")}</script>'
)

cases = [
    ("ru-RU", "Рекомендуется", "Подходит для вашего устройства", ASSETS / "screenshot-recommended-ru.png"),
    ("en-US", "Recommended", "Suitable for your device", ASSETS / "screenshot-recommended-en.png"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    for locale, badge, heading, output in cases:
        context = browser.new_context(viewport={"width": 1280, "height": 800}, locale=locale, device_scale_factor=1)
        page = context.new_page()
        page.set_content(html, wait_until="load")
        page.wait_for_selector("#ghdn-root")
        page.hover(".ghdn-button-group")
        page.wait_for_function("document.querySelector('.ghdn-primary-title')?.textContent.includes('AppImage')")
        page.click("[data-role='menu']")
        page.wait_for_selector(".ghdn-menu:not([hidden])")

        assert page.locator(".ghdn-badge").first.text_content() == badge
        assert page.locator(".ghdn-section-heading").first.text_content().strip() == heading
        assert page.locator(".ghdn-asset").count() >= 6
        page.screenshot(path=str(output), full_page=False)
        context.close()

    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ru-RU", device_scale_factor=1)
    page = context.new_page()
    deb_html = html.replace("const storedSettings = {};", 'const storedSettings = {preferredLinux:"deb"};')
    page.set_content(deb_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    page.hover(".ghdn-button-group")
    page.wait_for_function("document.querySelector('.ghdn-primary-title')?.textContent.includes('DEB')")
    page.click("[data-role='menu']")
    page.wait_for_selector(".ghdn-menu:not([hidden])")
    assert page.locator(".ghdn-badge").first.text_content() == "Ваш выбор"
    assert "linux-x86-64.deb" in page.locator(".ghdn-recommended .ghdn-asset-name").text_content()
    context.close()
    browser.close()

print("UI smoke test: OK")
