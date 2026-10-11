const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(value = "") {
  return String(value).replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

function youtubeEmbed(url) {
  try {
    const parsed = new URL(url);
    let id = parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v") || "";
    if (!id && parsed.pathname.startsWith("/embed/")) id = parsed.pathname.split("/")[2] || "";
    if (!id && parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.split("/")[2] || "";
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : "";
  } catch { return ""; }
}

function renderResourcePreview(item) {
  const type = item.querySelector(".resource-type")?.value || "link";
  const url = item.querySelector(".resource-url")?.value?.trim() || "";
  const title = item.querySelector(".resource-title")?.value?.trim() || "Resource";
  let html = "";
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol");
    if (type === "youtube") {
      const src = youtubeEmbed(url);
      if (src) html = `<div class="resource-editor-preview"><iframe src="${escapeHtml(src)}" title="${escapeHtml(title)}" loading="lazy" allowfullscreen></iframe></div>`;
    } else if (type === "vimeo" && parsed.hostname.endsWith("vimeo.com")) {
      const match = parsed.pathname.match(/\/(\d+)/);
      if (match) html = `<div class="resource-editor-preview"><iframe src="https://player.vimeo.com/video/${match[1]}" title="${escapeHtml(title)}" loading="lazy" allowfullscreen></iframe></div>`;
    } else if (type === "image") {
      html = `<div class="resource-editor-preview resource-editor-image-preview"><img src="${escapeHtml(parsed.href)}" alt="${escapeHtml(title)}" loading="lazy"></div>`;
    } else if (type === "pdf") {
      html = `<div class="resource-editor-preview"><iframe src="${escapeHtml(parsed.href)}" title="${escapeHtml(title)}" loading="lazy"></iframe></div>`;
    } else if (type === "spotify" && parsed.hostname.endsWith("spotify.com")) {
      const path = parsed.pathname.replace(/^\//, "");
      html = `<div class="resource-editor-preview"><iframe src="https://open.spotify.com/embed/${escapeHtml(path)}" title="${escapeHtml(title)}" loading="lazy"></iframe></div>`;
    }
  } catch {}
  let preview = item.querySelector(".resource-editor-preview-wrap");
  if (!preview) {
    preview = document.createElement("div");
    preview.className = "resource-editor-preview-wrap";
    item.querySelector(".form-grid")?.appendChild(preview);
  }
  preview.innerHTML = html;
}

function bindResourcePreviews() {
  document.querySelectorAll(".resource-editor-item").forEach((item) => {
    ["input", "change"].forEach((eventName) => item.addEventListener(eventName, () => renderResourcePreview(item)));
    renderResourcePreview(item);
  });
}

function addResourcesButton() {
  const heading = document.querySelector(".editor-section-heading");
  if (!heading || heading.querySelector(".add-resources-shortcut")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "website-btn secondary add-resources-shortcut";
  button.innerHTML = '<i class="fas fa-photo-video"></i> Tambah Resources';
  button.addEventListener("click", async () => {
    document.getElementById("page-add-section")?.click();
    await wait(20);
    const cards = [...document.querySelectorAll(".editor-section")];
    const last = cards.at(-1);
    const select = last?.querySelector(".section-type");
    if (select) {
      select.value = "resources";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await wait(20);
    last?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  heading.appendChild(button);
}

function addMobilePublishButton() {
  if (document.querySelector("#website-mobile-publish")) return;
  const topActions = document.querySelector(".website-top-actions");
  if (!topActions) return;
  const button = document.createElement("button");
  button.id = "website-mobile-publish";
  button.type = "button";
  button.className = "website-btn primary website-mobile-publish";
  button.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><span>Publish</span>';
  button.addEventListener("click", () => document.getElementById("website-publish-sidebar")?.click());
  topActions.insertBefore(button, topActions.firstChild);
}

function init() {
  addMobilePublishButton();
  const observer = new MutationObserver(() => {
    const modal = document.getElementById("page-editor-modal");
    if (modal && !modal.classList.contains("hidden")) {
      addResourcesButton();
      bindResourcePreviews();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
