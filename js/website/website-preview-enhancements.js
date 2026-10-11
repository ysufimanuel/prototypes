const auth = window.auth;
const db = window.db;
const frame = () => document.getElementById("website-preview-frame");
let selectedPage = "";
let draftCache = null;

function esc(value = "") {
  return String(value).replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}
function safeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch { return null; }
}
function youtube(url) {
  const parsed = safeUrl(url);
  if (!parsed) return "";
  let id = parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v") || "";
  if (!id && parsed.pathname.startsWith("/embed/")) id = parsed.pathname.split("/")[2] || "";
  if (!id && parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.split("/")[2] || "";
  return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : "";
}
function resourceHtml(resource) {
  const type = resource?.type || "link";
  const title = resource?.title || "Resource";
  const parsed = safeUrl(resource?.url);
  if (!parsed) return "";
  if (type === "youtube") {
    const src = youtube(parsed.href);
    return src ? `<article class="public-card"><h3>${esc(title)}</h3><div class="resource-embed"><iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allowfullscreen></iframe></div></article>` : "";
  }
  if (type === "vimeo" && parsed.hostname.endsWith("vimeo.com")) {
    const match = parsed.pathname.match(/\/(\d+)/);
    return match ? `<article class="public-card"><h3>${esc(title)}</h3><div class="resource-embed"><iframe src="https://player.vimeo.com/video/${match[1]}" title="${esc(title)}" loading="lazy" allowfullscreen></iframe></div></article>` : "";
  }
  if (type === "image") return `<article class="public-card"><h3>${esc(title)}</h3><img class="resource-image" src="${esc(parsed.href)}" alt="${esc(title)}" loading="lazy"></article>`;
  if (type === "pdf") return `<article class="public-card"><h3>${esc(title)}</h3><div class="resource-embed"><iframe src="${esc(parsed.href)}" title="${esc(title)}" loading="lazy"></iframe></div></article>`;
  if (type === "spotify" && parsed.hostname.endsWith("spotify.com")) return `<article class="public-card"><h3>${esc(title)}</h3><div class="resource-embed resource-spotify"><iframe src="https://open.spotify.com/embed/${esc(parsed.pathname.replace(/^\//, ""))}" title="${esc(title)}" loading="lazy"></iframe></div></article>`;
  return `<article class="public-card"><h3>${esc(title)}</h3><p><a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></p></article>`;
}
function addResourcesToPreview(page) {
  const site = frame()?.contentDocument?.getElementById("church-site");
  if (!site) return;
  site.querySelector(".preview-resource-enhancement")?.remove();
  const resourceSections = (page?.sections || []).filter((section) => section.enabled !== false && (section.type === "resources" || section.type === "sermons"));
  if (!resourceSections.length) return;
  const wrapper = site.ownerDocument.createElement("div");
  wrapper.className = "preview-resource-enhancement";
  wrapper.innerHTML = resourceSections.map((section) => {
    const c = section.config || {};
    const resources = Array.isArray(c.resources) ? c.resources : [];
    return `<section class="section"><div class="container"><span class="eyebrow">RESOURCES</span><h2>${esc(c.title || "Resources")}</h2><p>${esc(c.description || "")}</p><div class="events-grid">${resources.map(resourceHtml).join("") || "<p>Belum ada resource.</p>"}</div></div></section>`;
  }).join("");
  site.querySelector("main")?.appendChild(wrapper);
}
async function fetchDraft() {
  const user = auth?.currentUser;
  if (!user) return null;
  const token = await user.getIdToken(true);
  const response = await fetch("/api/admin/website/draft", { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || "Gagal memuat draft preview.");
  draftCache = data.data;
  return draftCache;
}
async function publicContent(churchId) {
  if (!churchId) return { events: [], ministries: [] };
  const [eventsSnap, ministriesSnap] = await Promise.all([
    window.firebaseGetDocs(window.firebaseCollection(db, "publicSites", churchId, "events")),
    window.firebaseGetDocs(window.firebaseCollection(db, "publicSites", churchId, "ministries")),
  ]);
  return { events: eventsSnap.docs.map((s) => ({ id: s.id, ...s.data() })), ministries: ministriesSnap.docs.map((s) => ({ id: s.id, ...s.data() })) };
}
async function sendSelected() {
  const data = draftCache || await fetchDraft();
  if (!data || !frame()?.contentWindow) return;
  const pages = data.pages || [];
  const page = pages.find((p) => p.id === selectedPage) || pages.find((p) => p.id === "home") || pages.find((p) => p.slug === "/") || pages[0];
  if (!page) return;
  const content = await publicContent(data.church?.id);
  frame().contentWindow.postMessage({ type: "CMS_WEBSITE_PREVIEW", churchId: data.church?.id || "", slug: data.church?.website?.slug || "", config: data.config || {}, navigation: data.navigation || { items: [] }, page, ...content }, window.location.origin);
}
function ensurePagePicker() {
  const toolbar = document.querySelector(".preview-toolbar");
  if (!toolbar || document.getElementById("preview-page-select")) return;
  const select = document.createElement("select");
  select.id = "preview-page-select";
  select.className = "website-btn secondary preview-page-select";
  select.setAttribute("aria-label", "Pilih halaman preview");
  toolbar.insertBefore(select, toolbar.querySelector("#preview-refresh"));
  select.addEventListener("change", async () => { selectedPage = select.value; await sendSelected(); });
}
async function refresh(event) {
  event?.preventDefault();
  event?.stopImmediatePropagation();
  try {
    ensurePagePicker();
    const data = await fetchDraft();
    const select = document.getElementById("preview-page-select");
    if (select) {
      select.innerHTML = (data?.pages || []).map((page) => `<option value="${esc(page.id)}">${esc(page.title || page.id)}</option>`).join("");
      if (!selectedPage || !(data?.pages || []).some((page) => page.id === selectedPage)) selectedPage = data?.pages?.find((p) => p.id === "home")?.id || data?.pages?.[0]?.id || "";
      select.value = selectedPage;
    }
    await sendSelected();
    const button = document.getElementById("preview-refresh");
    if (button) { button.disabled = true; setTimeout(() => { button.disabled = false; }, 250); }
  } catch (error) { console.error("[WEBSITE PREVIEW ENHANCEMENT]", error); }
}
function init() {
  ensurePagePicker();
  document.getElementById("preview-refresh")?.addEventListener("click", refresh, true);
  document.getElementById("website-preview-frame")?.addEventListener("load", () => { sendSelected().then(() => { const page = (draftCache?.pages || []).find((p) => p.id === selectedPage); if (page) addResourcesToPreview(page); }).catch(console.error); });
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== "CMS_WEBSITE_PREVIEW_READY") return;
    const page = (draftCache?.pages || []).find((p) => p.id === selectedPage);
    if (page) addResourcesToPreview(page);
  });
  window.addEventListener("cms:website-draft-updated", () => refresh());
  refresh();
  new MutationObserver(ensurePagePicker).observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
