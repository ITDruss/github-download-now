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

    # Wide desktop: integrate after the complete Star control.
    for locale, badge, heading, output in cases:
        context = browser.new_context(viewport={"width": 1280, "height": 800}, locale=locale, device_scale_factor=1)
        page = context.new_page()
        page.set_content(html, wait_until="load")
        page.wait_for_selector("#ghdn-root")
        root = page.locator("#ghdn-root")
        assert root.get_attribute("data-placement") == "toolbar"
        assert root.evaluate("node => node.parentElement.classList.contains('d-flex')")
        assert root.evaluate("node => /Star/i.test(node.previousElementSibling?.textContent || '')")
        assert root.evaluate("node => !node.closest('.native-btn')")

        page.hover(".ghdn-button-group")
        page.wait_for_function("document.querySelector('.ghdn-primary-title-full')?.textContent.includes('AppImage')")
        page.click("[data-role='menu']")
        page.wait_for_selector("#ghdn-menu:not([hidden])")

        assert page.locator(".ghdn-badge").first.text_content() == badge
        assert page.locator(".ghdn-section-heading").first.text_content().strip() == heading
        assert page.locator(".ghdn-asset").count() >= 6
        assert page.locator("#ghdn-menu").evaluate("node => node.parentElement === document.body")
        assert page.locator("#ghdn-menu").evaluate("node => getComputedStyle(node).position === 'fixed'")
        assert page.locator(".ghdn-source-actions").count() == 1
        page.wait_for_selector(".ghdn-build-doc-link")
        docs = page.locator(".ghdn-build-doc-link")
        assert docs.count() == 2
        assert docs.nth(0).text_content().strip() == "CONTRIBUTING.md"
        assert docs.nth(0).get_attribute("href").endswith("/CONTRIBUTING.md")
        assert page.locator(".ghdn-build-code").count() == 0

        namespaces = page.locator("#ghdn-root svg, #ghdn-menu svg").evaluate_all(
            "nodes => nodes.map(node => node.namespaceURI)"
        )
        assert namespaces and all(value == "http://www.w3.org/2000/svg" for value in namespaces)
        page.screenshot(path=str(output), full_page=False)
        context.close()

    # GitHub row-reverse toolbar: visual placement is to the right of Star,
    # while Fork and Star split groups remain untouched.
    context = browser.new_context(viewport={"width": 1400, "height": 800}, locale="en-US", device_scale_factor=1)
    page = context.new_page()
    reverse_actions = '''<div class="d-flex reverse-actions" style="flex-direction:row-reverse">
        <div class="action-group star-group"><button class="native-btn" aria-label="Star repository">Star</button><button class="native-btn" aria-label="Star options">▼</button></div>
        <div class="action-group fork-group"><button class="native-btn" aria-label="Fork repository">Fork</button><button class="native-btn" aria-label="Fork options">▼</button></div>
        <button class="native-btn" aria-label="Watch repository">Watch</button>
        <a class="native-btn" aria-label="Sponsor repository">Sponsor</a>
      </div>'''
    reverse_html = html.replace(
        '''<div class="d-flex">
        <button class="native-btn" aria-label="Fork repository">Fork</button>
        <a class="native-btn" aria-label="Star repository" href="/localsend/localsend/stargazers">☆ Star</a>
      </div>''',
        reverse_actions
    ).replace(
        ".native-btn { display:inline-flex;",
        ".action-group { display:inline-flex; } .native-btn { display:inline-flex;"
    )
    page.set_content(reverse_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    root = page.locator("#ghdn-root")
    assert root.get_attribute("data-placement") == "toolbar"
    assert root.evaluate("node => node.parentElement.classList.contains('reverse-actions')")
    assert page.locator(".star-group > *").count() == 2
    assert page.locator(".fork-group > *").count() == 2
    assert root.evaluate("node => !node.closest('.star-group, .fork-group')")
    root_box = root.bounding_box()
    star_box = page.locator(".star-group").bounding_box()
    assert root_box and star_box and root_box["x"] > star_box["x"]
    context.close()

    # Hidden legacy header on the main repository page: visible in-flow control.
    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="en-US", device_scale_factor=1)
    page = context.new_page()
    hidden_header_html = html.replace(
        "#repository-container-header { display:flex;",
        "#repository-container-header { display:none;"
    )
    page.set_content(hidden_header_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    rect = page.locator("#ghdn-root").bounding_box()
    assert rect and rect["width"] > 0 and rect["height"] > 0
    assert page.locator("#ghdn-root").get_attribute("data-placement") == "flow"
    assert not page.locator("#ghdn-root").evaluate("node => node.parentElement === document.body")
    context.close()

    # Pull request and other secondary repository pages must never get a full-width bar.
    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="en-US", device_scale_factor=1)
    page = context.new_page()
    pull_html = hidden_header_html.replace(
        'window.__GHDN_TEST_REPOSITORY__ = {owner: "localsend", repo: "localsend"};',
        'window.__GHDN_TEST_REPOSITORY__ = {owner: "localsend", repo: "localsend", parts: ["localsend", "localsend", "pull", "1"]};'
    )
    page.set_content(pull_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    root = page.locator("#ghdn-root")
    assert root.get_attribute("data-placement") == "floating"
    assert root.evaluate("node => node.parentElement === document.body")
    pull_box = root.bounding_box()
    assert pull_box and pull_box["width"] < 300 and pull_box["x"] > 900 and pull_box["y"] > 600
    context.close()

    # Modern GitHub-like layout: hidden legacy header plus a separate visible actions toolbar.
    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="en-US", device_scale_factor=1)
    page = context.new_page()
    modern_html = hidden_header_html.replace(
        '<div class="content">',
        '<div class="d-flex modern-actions"><button class="native-btn" aria-label="Watch repository">Watch</button><button class="native-btn" aria-label="Fork repository">Fork</button><button class="native-btn" aria-label="Star repository">Star</button></div><div class="content">'
    )
    page.set_content(modern_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    assert page.locator("#ghdn-root").get_attribute("data-placement") == "toolbar"
    assert page.locator("#ghdn-root").evaluate("node => node.parentElement.classList.contains('modern-actions')")
    assert page.locator("#ghdn-root").evaluate("node => /Star/i.test(node.previousElementSibling?.textContent || '')")
    context.close()

    # Constrained toolbar: compact density, then flow fallback on main repo only.
    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ru-RU", device_scale_factor=1)
    page = context.new_page()
    compact_html = html.replace(
        ".d-flex { display:flex;",
        ".d-flex { width:280px; overflow:hidden; display:flex;"
    ).replace(
        ".native-btn { display:inline-flex;",
        ".native-btn { flex:none; display:inline-flex;"
    )
    page.set_content(compact_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    page.wait_for_timeout(250)
    assert page.locator("#ghdn-root").get_attribute("data-placement") == "toolbar"
    assert page.locator("#ghdn-root").evaluate("node => node.classList.contains('ghdn-density-compact')")
    assert page.locator(".ghdn-primary-title-compact").is_visible()
    context.close()

    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ru-RU", device_scale_factor=1)
    page = context.new_page()
    overflow_html = html.replace(
        ".d-flex { display:flex;",
        ".d-flex { width:240px; overflow:hidden; display:flex;"
    ).replace(
        ".native-btn { display:inline-flex;",
        ".native-btn { flex:none; display:inline-flex;"
    )
    page.set_content(overflow_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    page.wait_for_timeout(250)
    assert page.locator("#ghdn-root").get_attribute("data-placement") == "flow"
    context.close()

    # Narrow main page: full-width in-flow button and bottom-sheet menu.
    context = browser.new_context(viewport={"width": 480, "height": 720}, locale="ru-RU", device_scale_factor=1)
    page = context.new_page()
    page.set_content(hidden_header_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    assert page.locator("#ghdn-root").get_attribute("data-placement") == "flow"
    page.click("[data-role='menu']")
    page.wait_for_selector("#ghdn-menu:not([hidden])")
    assert page.locator("#ghdn-menu").evaluate("node => node.classList.contains('ghdn-menu-sheet')")
    menu_box = page.locator("#ghdn-menu").bounding_box()
    assert menu_box and menu_box["x"] >= 10 and menu_box["width"] <= 460
    context.close()

    # Last-resort fallback when no visible repository content container exists.
    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="en-US", device_scale_factor=1)
    page = context.new_page()
    floating_html = html.replace(".page { width:", ".page { display:none; width:")
    page.set_content(floating_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    assert page.locator("#ghdn-root").get_attribute("data-placement") == "floating"
    assert page.locator("#ghdn-root").evaluate("node => node.parentElement === document.body")
    floating_box = page.locator("#ghdn-root").bounding_box()
    assert floating_box and floating_box["x"] > 900 and floating_box["y"] > 600
    context.close()

    # Preferred format still changes recommendation and menu badge.
    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ru-RU", device_scale_factor=1)
    page = context.new_page()
    deb_html = html.replace("const storedSettings = {};", 'const storedSettings = {preferredLinux:"deb"};')
    page.set_content(deb_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    page.hover(".ghdn-button-group")
    page.wait_for_function("document.querySelector('.ghdn-primary-title-full')?.textContent.includes('DEB')")
    page.click("[data-role='menu']")
    page.wait_for_selector("#ghdn-menu:not([hidden])")
    assert page.locator(".ghdn-badge").first.text_content() == "Ваш выбор"
    assert "linux-x86-64.deb" in page.locator(".ghdn-recommended .ghdn-asset-name").text_content()
    context.close()

    browser.close()

print("UI smoke test: OK")
