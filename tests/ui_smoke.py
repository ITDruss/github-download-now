from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "tests" / "fixtures" / "demo.html"
ASSETS = ROOT / "assets"
OUTPUTS = ROOT / "test-results" / "ui-smoke"
OUTPUTS.mkdir(parents=True, exist_ok=True)

html = DEMO.read_text(encoding="utf-8")
manifest = json.loads((ROOT / "src" / "manifest.chromium.json").read_text(encoding="utf-8"))
content_definition = manifest["content_scripts"][0]
for relative in content_definition["css"]:
    html = html.replace(
        f'<link rel="stylesheet" href="../../src/{relative}">',
        f'<style>{(ROOT / "src" / relative).read_text(encoding="utf-8")}</style>'
    )
for relative in content_definition["js"]:
    html = html.replace(
        f'<script src="../../src/{relative}"></script>',
        f'<script>{(ROOT / "src" / relative).read_text(encoding="utf-8")}</script>'
    )

cases = [
    ("ru-RU", "Рекомендуется", "Подходит для вашего устройства", OUTPUTS / "screenshot-recommended-ru.png"),
    ("en-US", "Recommended", "Suitable for your device", OUTPUTS / "screenshot-recommended-en.png"),
]

with sync_playwright() as p:
    launch_options = {"headless": True, "args": ["--no-sandbox"]}
    chromium_path = os.environ.get("GHDN_CHROMIUM_PATH", "").strip()
    if chromium_path:
        launch_options["executable_path"] = chromium_path
    browser = p.chromium.launch(**launch_options)

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
        assert page.locator("#ghdn-menu").get_by_text("evil.AppImage", exact=True).count() == 0
        assert page.locator("#ghdn-menu").get_attribute("role") == "dialog"
        assert page.locator("#ghdn-menu").evaluate("node => node.parentElement === document.body")
        assert page.locator("#ghdn-menu").evaluate("node => getComputedStyle(node).position === 'fixed'")
        assert page.locator(".ghdn-source-actions").count() == 1
        assert page.locator(".ghdn-guide-toggle").count() >= 5
        # Store screenshot: show the complete recommendation menu before
        # expanding installation guidance or build-document details.
        page.screenshot(path=str(output), full_page=False)
        page.locator(".ghdn-guide-toggle").first.click()
        page.wait_for_selector(".ghdn-install-guide:not([hidden])")
        guide_commands = page.locator(".ghdn-install-guide:not([hidden]) .ghdn-install-command")
        assert guide_commands.count() == 2
        assert guide_commands.nth(0).text_content().startswith("chmod +x --")
        assert "AppImage" in guide_commands.nth(1).text_content()
        page.locator(".ghdn-build-docs > summary").click()
        page.wait_for_selector(".ghdn-build-doc-link")
        docs = page.locator(".ghdn-build-doc-link")
        assert docs.count() == 2
        assert docs.nth(0).text_content().strip() == "Building → Linux"
        assert docs.nth(0).get_attribute("href").endswith("/README.md#linux")
        assert page.locator(".ghdn-build-code").count() == 0

        namespaces = page.locator("#ghdn-root svg, #ghdn-menu svg").evaluate_all(
            "nodes => nodes.map(node => node.namespaceURI)"
        )
        assert namespaces and all(value == "http://www.w3.org/2000/svg" for value in namespaces)
        context.close()

    # A manual language choice overrides the browser UI language.
    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ru-RU", device_scale_factor=1)
    page = context.new_page()
    manual_english_html = html.replace("const storedSettings = {};", 'const storedSettings = {language:"en"};')
    page.set_content(manual_english_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    page.hover(".ghdn-button-group")
    page.wait_for_function("document.querySelector('.ghdn-primary-title-full')?.textContent.includes('AppImage')")
    page.click("[data-role='menu']")
    page.wait_for_selector("#ghdn-menu:not([hidden])")
    assert page.locator(".ghdn-badge").first.text_content() == "Recommended"
    assert page.locator(".ghdn-section-heading").first.text_content().strip() == "Suitable for your device"
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

    # Public-only policy fails closed when repository visibility is negative.
    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="en-US", device_scale_factor=1)
    page = context.new_page()
    private_html = html.replace(
        'window.__GHDN_TEST_REPOSITORY__ = {owner: "localsend", repo: "localsend"};',
        'window.__GHDN_TEST_REPOSITORY__ = {owner: "localsend", repo: "localsend", public: false};'
    )
    page.set_content(private_html, wait_until="load")
    page.wait_for_timeout(250)
    assert page.locator("#ghdn-root").count() == 0
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

    # Releases page: compact, tag-specific control beside the selected release title.
    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ru-RU", device_scale_factor=1)
    page = context.new_page()
    release_markup = """
    <section id="release-v1.17.0" data-release-anchor="release-v1.17.0" style="margin:24px 0;border:1px solid #d0d7de;border-radius:8px;padding:20px">
      <h2 class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden">v1.17.0</h2>
      <div class="release-heading-row" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
        <div class="release-heading-main" style="display:flex;flex:1;align-items:center;min-width:0">
          <span class="release-version-text" style="display:inline;font-size:28px;font-weight:700">
            <a href="/localsend/localsend/releases/tag/v1.17.0" style="text-decoration:none">v1.17.0</a>
          </span>
          <span class="latest-badge" style="margin-left:8px;border:1px solid #1a7f37;border-radius:999px;padding:2px 7px;color:#1a7f37">Latest</span>
        </div>
        <div class="release-heading-actions"><button class="native-btn">Compare</button></div>
      </div>
      <p>Selected release summary.</p>
    </section>
    <div style="height:720px"></div>
    <section id="release-v1.16.1" data-release-anchor="release-v1.16.1" style="margin:24px 0;border:1px solid #d0d7de;border-radius:8px;padding:20px">
      <h2 class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden">v1.16.1</h2>
      <div class="release-heading-row" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
        <div class="release-heading-main" style="display:flex;flex:1;align-items:center;min-width:0">
          <span class="release-version-text old-release-title" style="display:inline;font-size:28px;font-weight:700">
            <a href="/localsend/localsend/releases/tag/v1.16.1" style="text-decoration:none">v1.16.1</a>
          </span>
        </div>
        <div class="release-heading-actions"><button class="native-btn">Compare</button></div>
      </div>
      <p>Older release summary.</p>
    </section>
    """
    releases_html = hidden_header_html.replace(
        'window.__GHDN_TEST_REPOSITORY__ = {owner: "localsend", repo: "localsend"};',
        'window.__GHDN_TEST_REPOSITORY__ = {owner: "localsend", repo: "localsend", parts: ["localsend", "localsend", "releases"]};'
    ).replace(
        '<div class="content">',
        release_markup + '<div class="content" style="display:none">',
        1
    )
    page.set_content(releases_html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    root = page.locator("#ghdn-root")
    assert root.get_attribute("data-placement") == "release"
    assert root.get_attribute("data-release-tag") == "v1.17.0"
    assert root.evaluate("node => node.parentElement.classList.contains('release-version-text')")
    assert root.evaluate("""node => node.previousElementSibling?.matches('a[href*="/releases/tag/"]')""")
    release_box = root.bounding_box()
    title_box = page.locator('.release-version-text > a').first.bounding_box()
    compare_box = page.locator('.release-heading-actions .native-btn').first.bounding_box()
    assert release_box and title_box and compare_box and release_box["width"] < 260
    assert 0 <= release_box["x"] - (title_box["x"] + title_box["width"]) <= 16
    assert release_box["x"] + release_box["width"] < compare_box["x"] - 24
    assert not root.evaluate("node => node.parentElement === document.body")
    page.hover("#ghdn-root .ghdn-button-group")
    page.wait_for_function("document.querySelector('.ghdn-primary-title-full')?.textContent.includes('AppImage')")
    assert page.evaluate("window.__ghdnPageFetches.some(url => url.includes('/releases/expanded_assets/v1.17.0'))")
    assert not page.evaluate("window.__ghdnMessages.some(message => message.type === 'GHDN_GET_RELEASE_BY_TAG')")

    page.click("[data-role='menu']")
    page.wait_for_selector("#ghdn-menu:not([hidden])")
    page.wait_for_function("document.querySelectorAll('.ghdn-version-select option').length >= 3")
    page.screenshot(path=str(OUTPUTS / "releases-version-menu-ru.png"), full_page=False)
    page.select_option(".ghdn-version-select", "v1.16.1")
    page.wait_for_function("document.querySelector('.ghdn-release-tag')?.textContent.includes('v1.16.1')")
    assert page.evaluate("window.__ghdnPageFetches.some(url => url.includes('/releases/expanded_assets/v1.16.1'))")

    page.locator('[id="release-v1.16.1"]').scroll_into_view_if_needed()
    page.wait_for_function("document.querySelector('#ghdn-root')?.dataset.releaseTag === 'v1.16.1'")
    assert page.locator("#ghdn-root").evaluate("node => node.parentElement.classList.contains('old-release-title')")
    assert page.locator("#ghdn-root").evaluate("node => node.previousElementSibling?.textContent.trim() === 'v1.16.1'")
    page.screenshot(path=str(OUTPUTS / "releases-compact-button-ru.png"), full_page=False)
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

    # Beginner mode shows deterministic post-download guidance without download-history permission.
    context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="ru-RU", device_scale_factor=1)
    page = context.new_page()
    page.set_content(html, wait_until="load")
    page.wait_for_selector("#ghdn-root")
    page.evaluate("HTMLAnchorElement.prototype.click = function(){ window.__ghdnDownloaded = this.href; }")
    page.hover(".ghdn-button-group")
    page.wait_for_function("document.querySelector('.ghdn-primary-title-full')?.textContent.includes('AppImage')")
    page.click(".ghdn-primary")
    page.wait_for_selector("#ghdn-install-prompt")
    assert page.locator("#ghdn-install-prompt .ghdn-install-command").count() == 2
    assert page.evaluate("window.__ghdnDownloaded.includes('/releases/download/v1.17.0/') && window.__ghdnDownloaded.endsWith('.AppImage')")
    assert page.locator("#ghdn-install-prompt").evaluate("node => node.parentElement.id === 'ghdn-notice-stack'")
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
