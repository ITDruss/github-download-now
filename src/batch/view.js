(function initBatchView(root, factory) {
  const api = factory();
  root.GHDNBatchView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBatchViewApi() {
  "use strict";
  function create({ documentObject, strings, formatting, batchAssets }) {
    const doc = documentObject;
    const el = id => doc.getElementById(id);
    function node(tag, text = "", className = "") {
      const value = doc.createElement(tag); value.textContent = text; value.className = className; return value;
    }
    function labels() {
      doc.documentElement.lang = strings.tag;
      doc.title = strings.title;
      for (const element of doc.querySelectorAll("[data-label]")) element.textContent = strings[element.dataset.label] || "";
      el("search").placeholder = strings.search;
      el("search").setAttribute("aria-label", strings.search);
    }
    function notice(text, error = false) {
      el("notice").textContent = text; el("notice").classList.toggle("error", error);
    }
    function context(repo, tag, release) {
      el("repository").textContent = `${repo.owner} / ${repo.repo}`;
      el("release-tag").textContent = tag;
      el("release-link").href = `https://github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/releases/tag/${encodeURIComponent(tag)}`;
      el("release-link").textContent = release?.name || tag;
    }
    function formats(assets, onChange) {
      const wrapper = el("formats"); wrapper.replaceChildren();
      const types = [...new Set(assets.map(asset => batchAssets.extension(asset.name)))].sort();
      for (const type of types) {
        const label = node("label", "", "format");
        const checkbox = node("input"); checkbox.type = "checkbox"; checkbox.value = type;
        checkbox.addEventListener("change", onChange);
        label.append(checkbox, node("span", type || strings.noExtension)); wrapper.append(label);
      }
    }
    function list(assets, selected, onChange) {
      const wrapper = el("assets"); wrapper.replaceChildren();
      if (!assets.length) wrapper.append(node("p", strings.noMatch, "empty"));
      for (const asset of assets) {
        const label = node("label", "", "asset");
        const checkbox = node("input"); checkbox.type = "checkbox"; checkbox.checked = selected.has(asset.browser_download_url);
        checkbox.setAttribute("aria-label", asset.name);
        checkbox.addEventListener("change", () => onChange(asset.browser_download_url, checkbox.checked));
        const details = node("span", "", "asset-name");
        details.append(node("strong", asset.name), node("small", batchAssets.extension(asset.name) || strings.noExtension));
        label.append(checkbox, details, node("span", formatting.bytes(asset.size), "size")); wrapper.append(label);
      }
    }
    function selection(assets, selected, visibleCount, busy) {
      const chosen = assets.filter(asset => selected.has(asset.browser_download_url));
      const bytes = chosen.reduce((total, asset) => total + Number(asset.size || 0), 0);
      el("selection").textContent = `${strings.selection}: ${chosen.length} · ${formatting.bytes(bytes)}`;
      el("count").textContent = `${strings.count}: ${visibleCount} / ${assets.length}`;
      el("download").textContent = `${strings.download} (${chosen.length})`;
      el("download").disabled = !chosen.length || busy;
      el("copy-links").disabled = !chosen.length;
      el("select-all").disabled = !visibleCount;
    }
    function queue(batch) {
      el("queue").hidden = !batch;
      if (!batch) return;
      el("queue-release").textContent = `${batch.owner} / ${batch.repo} · ${batch.tag}`;
      const finished = batch.items.filter(item => item.state === "complete").length;
      el("progress").max = batch.items.length; el("progress").value = finished;
      const interrupted = batch.items.filter(item => item.state === "interrupted").length;
      el("queue-summary").textContent = `${strings.complete}: ${finished} / ${batch.items.length} · ${strings.interrupted}: ${interrupted}`;
      const list = el("queue-items"); list.replaceChildren();
      for (const item of batch.items) {
        const row = node("li", "", `queue-item ${item.state}`);
        row.append(node("span", item.name), node("span", strings[item.state] || item.state, "state")); list.append(row);
      }
      el("cancel").disabled = !batchAssets.active(batch);
      el("retry").disabled = !interrupted;
      el("clear-queue").disabled = batchAssets.active(batch);
    }
    return Object.freeze({ el, labels, notice, context, formats, list, selection, queue });
  }
  return Object.freeze({ create });
});
