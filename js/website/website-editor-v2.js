import "../firebase.js";

const $ = (id) => document.getElementById(id);
const API = "/api/admin/website";
let user = null;
let draft = null;
let editing = null;
let initialized = false;
let saving = false;

const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
}[char]));

async function withTimeout(promise, timeoutMs, message) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = window.setTimeout(() => reject(new Error(message)), timeoutMs); })]); }
  finally { window.clearTimeout(timer); }
}
async function getToken() { if (!user) throw new Error("AUTH_REQUIRED"); return withTimeout(user.getIdToken(), 15000, "Firebase ID token terlalu lama dimuat. Silakan refresh halaman."); }
async function api(path, options = {}) {
  const token = await getToken(); const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(API + path, { ...options, signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.message || `HTTP ${response.status}`);
    return data;
  } catch (error) { if (error?.name === "AbortError") throw new Error(`Request ${path} terlalu lama (lebih dari 30 detik).`); throw error; }
  finally { window.clearTimeout(timer); }
}
async function loadDraft() {
  if (window.__cmsWebsiteDraft?.pages?.length) {
    draft = window.__cmsWebsiteDraft;
    draft.content = draft.content || { events: [], ministries: [] };
    return draft;
  }
  const data = await api("/draft", { method: "GET" });
  draft = data.data || { config: {}, navigation: { items: [] }, pages: [], content: { events: [], ministries: [] } };
  draft.content = draft.content || { events: [], ministries: [] };
  window.__cmsWebsiteDraft = draft;
  return draft;
}

const ASPECT_RATIOS = ["19:9", "1:1", "4:3", "4:5", "2:3", "9:16", "21:9", "32:9"];
function mediaRow(media = {}) {
  const id = media.id || `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const aspectRatio = ASPECT_RATIOS.includes(media.aspectRatio) ? media.aspectRatio : "16:9";
  return `<div class="v2-media-row" data-media-id="${esc(id)}"><div class="form-grid"><label>Jenis Media<select class="v2-media-type"><option value="image" ${media.type === "image" ? "selected" : ""}>Foto / Gambar</option><option value="youtube" ${media.type === "youtube" ? "selected" : ""}>YouTube</option><option value="vimeo" ${media.type === "vimeo" ? "selected" : ""}>Vimeo</option><option value="video" ${media.type === "video" ? "selected" : ""}>Video URL</option></select></label><label>Judul Media<input class="v2-media-title" maxlength="160" value="${esc(media.title || "")}"></label><label class="full">URL Media<input class="v2-media-url" type="url" maxlength="1000" placeholder="https://..." value="${esc(media.url || "")}"></label><label>Posisi<select class="v2-media-position"><option value="top" ${media.position === "top" ? "selected" : ""}>Atas teks</option><option value="bottom" ${!media.position || media.position === "bottom" ? "selected" : ""}>Bawah teks</option><option value="left" ${media.position === "left" ? "selected" : ""}>Kiri teks</option><option value="right" ${media.position === "right" ? "selected" : ""}>Kanan teks</option><option value="background" ${media.position === "background" ? "selected" : ""}>Background / Overlay</option></select></label><label>Mode<select class="v2-media-mode"><option value="inline" ${media.mode !== "background" ? "selected" : ""}>Media biasa</option><option value="background" ${media.mode === "background" ? "selected" : ""}>Background / Overlay</option></select></label><label>Aspek Rasio<select class="v2-media-aspect">${ASPECT_RATIOS.map((ratio) => `<option value="${ratio}" ${aspectRatio === ratio ? "selected" : ""}>${ratio}</option>`).join("")}</select></label><label>Radius <span class="v2-range-value">${Number(media.radius) || 16}px</span><input class="v2-media-radius" type="range" min="0" max="60" value="${Number(media.radius) || 16}"></label><label class="v2-overlay-field ${media.mode === "background" || media.position === "background" ? "" : "hidden"}">Overlay <span class="v2-range-value">${Number(media.overlay) || 45}%</span><input class="v2-media-overlay" type="range" min="0" max="95" value="${Number(media.overlay) || 45}"></label><div class="full v2-media-actions"><button type="button" class="website-btn secondary v2-media-remove"><i class="fas fa-trash"></i> Hapus Media</button></div></div><div class="v2-media-preview" style="--media-aspect:${aspectRatio.replace(":", "/")}"></div></div>`;
}
function sectionCard(section = {}, index = 0) {
  const config = section.config || {}; const media = Array.isArray(config.media) ? config.media : []; const types = ["hero", "welcome", "serviceSchedule", "featuredEvents", "about", "ministries", "sermons", "resources", "contact", "cta"];
  return `<article class="v2-section-card" data-id="${esc(section.id || `section-${Date.now()}`)}"><div class="editor-section-top"><div><strong>${index + 1}. ${esc(section.type || "welcome")}</strong><small>Section</small></div><div class="editor-section-actions"><label class="editor-checkbox"><input class="v2-enabled" type="checkbox" ${section.enabled !== false ? "checked" : ""}> Aktif</label><button type="button" class="icon-btn v2-section-remove" title="Hapus"><i class="fas fa-trash"></i></button></div></div><div class="form-grid"><label>Jenis<select class="v2-section-type">${types.map((type) => `<option value="${type}" ${section.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><label>Judul<input class="v2-section-title" maxlength="160" value="${esc(config.title || "")}"></label><label class="full">Deskripsi<textarea class="v2-section-description" rows="3" maxlength="1000">${esc(config.description || "")}</textarea></label>${["serviceSchedule", "featuredEvents", "ministries"].includes(section.type) ? `<label>Batas Item<input class="v2-limit" type="number" min="1" max="20" value="${Number(config.limit) || 4}"></label>` : ""}</div><div class="v2-media-box"><div class="v2-media-head"><div><strong>Media Section</strong><small>Foto/video bisa dipasang di semua section.</small></div><button type="button" class="website-btn secondary v2-media-add"><i class="fas fa-image"></i> Tambah Media</button></div><div class="v2-media-list">${media.map(mediaRow).join("") || '<p class="v2-empty-media">Belum ada media.</p>'}</div></div></article>`;
}
function renderEditor() {
  const modal = $("page-editor-modal"); const form = $("page-editor-form"); if (!modal || !form || !editing) return;
  form.innerHTML = `<input id="page-editor-id" type="hidden" value="${esc(editing.id)}"><div class="form-grid page-meta-grid"><label>Judul Halaman<input id="v2-page-title" type="text" maxlength="120" required value="${esc(editing.title || "")}"></label><label>Slug<input id="v2-page-slug" type="text" maxlength="200" required value="${esc(editing.slug || "/")}"></label></div><label class="editor-checkbox"><input id="v2-page-published" type="checkbox" ${editing.published !== false ? "checked" : ""}> Tampilkan halaman di website publik</label><div class="editor-section-heading"><div><h3>Sections & Media</h3><p>Setiap section bisa punya foto/video sendiri, posisi, overlay, radius, dan aspek rasio.</p></div><button type="button" class="website-btn secondary" id="v2-add-section"><i class="fas fa-plus"></i> Tambah Section</button></div><div id="v2-sections" class="page-editor-sections">${(editing.sections || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(sectionCard).join("")}</div><div class="form-actions"><button type="button" id="v2-cancel" class="website-btn secondary">Batal</button><button type="submit" class="website-btn primary" ${saving ? "disabled" : ""}><i class="fas fa-save"></i> Simpan & Update Preview</button></div>`;
  modal.classList.remove("hidden"); document.body.classList.add("modal-open");
}
function readEditor() {
  const cards = [...document.querySelectorAll("#v2-sections .v2-section-card")];
  return cards.map((card, index) => {
    const old = (editing.sections || []).find((section) => section.id === card.dataset.id) || { id: card.dataset.id, type: "welcome", config: {} };
    const media = [...card.querySelectorAll(".v2-media-row")].map((row) => ({ id: row.dataset.mediaId, type: row.querySelector(".v2-media-type")?.value || "image", title: row.querySelector(".v2-media-title")?.value?.trim() || "", url: row.querySelector(".v2-media-url")?.value?.trim() || "", position: row.querySelector(".v2-media-position")?.value || "bottom", mode: row.querySelector(".v2-media-mode")?.value || "inline", aspectRatio: row.querySelector(".v2-media-aspect")?.value || "16:9", radius: Number(row.querySelector(".v2-media-radius")?.value || 16), overlay: Number(row.querySelector(".v2-media-overlay")?.value || 45) }));
    const config = { ...(old.config || {}), title: card.querySelector(".v2-section-title")?.value?.trim() || "", description: card.querySelector(".v2-section-description")?.value?.trim() || "", media };
    const limit = card.querySelector(".v2-limit"); if (limit) config.limit = Math.min(20, Math.max(1, Number(limit.value) || 4)); else delete config.limit;
    return { ...old, id: card.dataset.id, type: card.querySelector(".v2-section-type")?.value || old.type, enabled: card.querySelector(".v2-enabled")?.checked !== false, order: index + 1, config };
  });
}
async function savePage() {
  if (!editing || saving) return; saving = true;
  try {
    const pages = (draft?.pages || []).map((page) => page.id === editing.id ? { ...page, title: $("v2-page-title")?.value?.trim() || page.title, slug: $("v2-page-slug")?.value?.trim() || page.slug || "/", published: $("v2-page-published")?.checked !== false, sections: readEditor() } : page);
    const token = await getToken(); const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(API + "/draft", { method: "PUT", signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ pages }) });
      const data = await response.json().catch(() => ({})); if (!response.ok || data.success === false) throw new Error(data.message || `HTTP ${response.status}`);
    } finally { window.clearTimeout(timer); }
    draft.pages = pages; window.__cmsWebsiteDraft = draft; window.dispatchEvent(new CustomEvent("cms:website-draft-updated", { detail: draft })); closeEditor();
  } finally { saving = false; }
}
function openEditor(pageId) { const page = (draft?.pages || []).find((item) => item.id === pageId); if (!page) return; editing = JSON.parse(JSON.stringify(page)); renderEditor(); }
function closeEditor() { $("page-editor-modal")?.classList.add("hidden"); document.body.classList.remove("modal-open"); editing = null; }
function bindNavigation() {
  const box = $("website-navigation-list"); if (!box || box.dataset.v2Ready === "1") return; box.dataset.v2Ready = "1";
  new MutationObserver(renderNavigationSave).observe(box, { childList: true, subtree: true }); renderNavigationSave();
}
function renderNavigationSave() {
  const box = $("website-navigation-list"); if (!box || box.querySelector(".v2-navigation-actions")) return;
  const actions = document.createElement("div"); actions.className = "v2-navigation-actions"; actions.innerHTML = `<div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="website-btn primary" id="v2-navigation-save"><i class="fas fa-save"></i> Simpan Navigation</button></div>`; box.appendChild(actions);
  $("v2-navigation-save")?.addEventListener("click", async () => {
    const button = $("v2-navigation-save"); button.disabled = true;
    try {
      const current = draft || await loadDraft(); const items = (current.navigation?.items || []).map((item) => ({ ...item, visible: document.querySelector(`[data-nav="${CSS.escape(item.id)}"]`)?.checked !== false }));
      const token = await getToken(); const response = await fetch(API + "/draft", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ navigation: { items } }) });
      const data = await response.json().catch(() => ({})); if (!response.ok || data.success === false) throw new Error(data.message || `HTTP ${response.status}`);
      current.navigation = { items }; draft = current; window.__cmsWebsiteDraft = current; window.dispatchEvent(new CustomEvent("cms:website-draft-updated", { detail: current }));
      button.innerHTML = '<i class="fas fa-check"></i> Tersimpan'; window.setTimeout(() => { button.innerHTML = '<i class="fas fa-save"></i> Simpan Navigation'; }, 1200);
    } catch (error) { console.error("[WEBSITE NAVIGATION]", error); alert(error.message || "Gagal menyimpan navigation."); button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Gagal, Coba Lagi'; }
    finally { button.disabled = false; }
  });
}
function init() {
  if (initialized) return; initialized = true;
  document.addEventListener("click", async (event) => {
    const edit = event.target.closest(".page-edit-btn"); if (edit) { event.preventDefault(); event.stopImmediatePropagation(); try { if (!draft?.pages?.length) await loadDraft(); openEditor(edit.dataset.page); } catch (error) { console.error("[WEBSITE EDITOR] open page:", error); alert(error.message || "Gagal memuat page."); } return; }
    if (event.target.closest("#v2-cancel, #page-editor-close")) { event.preventDefault(); closeEditor(); return; }
    if (event.target.closest("#v2-add-section")) { event.preventDefault(); if (!editing) return; const sections = $("v2-sections"); const id = `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; const holder = document.createElement("div"); holder.innerHTML = sectionCard({ id, type: "welcome", enabled: true, order: sections.children.length + 1, config: {} }, sections.children.length); sections.appendChild(holder.firstElementChild); return; }
    const addMedia = event.target.closest(".v2-media-add"); if (addMedia) { const list = addMedia.closest(".v2-media-box")?.querySelector(".v2-media-list"); list?.querySelector(".v2-empty-media")?.remove(); const holder = document.createElement("div"); holder.innerHTML = mediaRow({}); list?.appendChild(holder.firstElementChild); return; }
    if (event.target.closest(".v2-media-remove")) { event.target.closest(".v2-media-row")?.remove(); return; }
    if (event.target.closest(".v2-section-remove")) event.target.closest(".v2-section-card")?.remove();
  }, true);
  document.addEventListener("submit", async (event) => { if (event.target.id !== "page-editor-form") return; event.preventDefault(); event.stopImmediatePropagation(); if (saving) return; const submit = event.target.querySelector('button[type="submit"]'); const original = submit?.innerHTML; if (submit) { submit.disabled = true; submit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'; } try { await savePage(); alert("Page berhasil disimpan dan draft preview diperbarui."); } catch (error) { console.error("[WEBSITE EDITOR] save page:", error); alert(error.message || "Gagal menyimpan page."); } finally { if (submit) { submit.disabled = false; submit.innerHTML = original || '<i class="fas fa-save"></i> Simpan & Update Preview'; } } }, true);
  document.addEventListener("input", (event) => { if (!event.target.matches(".v2-media-radius, .v2-media-overlay")) return; const label = event.target.parentElement?.querySelector(".v2-range-value"); if (label) label.textContent = `${event.target.value}${event.target.classList.contains("v2-media-overlay") ? "%" : "px"}`; });
  bindNavigation(); new MutationObserver(bindNavigation).observe(document.body, { childList: true, subtree: true });
}
const auth = window.auth; const onAuth = window.firebaseOnAuthStateChanged;
if (onAuth) onAuth(auth, (currentUser) => { user = currentUser; if (user) init(); });