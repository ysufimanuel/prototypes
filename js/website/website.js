import "../firebase.js";

const auth = window.auth;
const db = window.db;
const getAuthStateChanged = () => window.firebaseOnAuthStateChanged;
const firebaseLogout = () => window.logoutFromFirebase?.();

const $ = (id) => document.getElementById(id);
const state = { user: null, profile: null, churchId: null, church: null, config: null, navigation: null, pages: [], editingPage: null };
const API_BASE = "/api/admin/website";
const SECTION_TYPES = ["hero", "welcome", "serviceSchedule", "featuredEvents", "about", "ministries", "sermons", "resources", "contact", "cta"];

function show(id) { $(id)?.classList.remove("hidden"); }
function hide(id) { $(id)?.classList.add("hidden"); }
function setText(id, value) { const el = $(id); if (el) el.textContent = value ?? ""; }
function setValue(id, value) { const el = $(id); if (el) el.value = value ?? ""; }
function getValue(id) { return $(id)?.value?.trim() || ""; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>\\"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\": "&#92;", '"': "&quot;" })[m]); }
function sectionDefaults(type) { return { id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, enabled: true, order: 1, config: {} }; }

async function withTimeout(promise, timeoutMs, message) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = window.setTimeout(() => reject(new Error(message)), timeoutMs); })]); } finally { window.clearTimeout(timer); } }

async function api(path, options = {}) {
  if (!state.user) throw new Error("AUTH_REQUIRED");
  console.log(`[WEBSITE] API ${path}: requesting Firebase ID token`);
  const token = await withTimeout(state.user.getIdToken(), 15000, "Firebase ID token terlalu lama dimuat. Silakan refresh halaman.");
  console.log(`[WEBSITE] API ${path}: Firebase ID token ready`);
  const controller = new AbortController();
  const requestTimeout = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.message || `HTTP ${response.status}`);
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Request ${path} terlalu lama (lebih dari 30 detik).`);
    throw error;
  } finally { window.clearTimeout(requestTimeout); }
}

function switchSection(section) {
  document.querySelectorAll(".website-section").forEach((el) => el.classList.toggle("active", el.dataset.panel === section));
  document.querySelectorAll(".website-nav").forEach((el) => el.classList.toggle("active", el.dataset.section === section));
}
function renderPages() {
  const el = $("website-pages-list"); if (!el) return;
  el.innerHTML = state.pages.map((page) => `<div class="page-item"><div class="page-item-main"><span class="drag-handle"><i class="fas fa-grip-vertical"></i></span><div><strong>${escapeHtml(page.title)}</strong><small>${escapeHtml(page.slug)} · ${page.published === false ? "Draft" : "Published"}</small></div></div><button class="website-btn secondary page-edit-btn" type="button" data-page="${escapeHtml(page.id)}">Edit</button></div>`).join("");
  el.querySelectorAll(".page-edit-btn").forEach((btn) => btn.addEventListener("click", () => openPageEditor(btn.dataset.page)));
}
function renderNavigation() {
  const el = $("website-navigation-list"); if (!el) return;
  const items = state.navigation?.items || [];
  el.innerHTML = items.map((item) => `<div class="navigation-item"><div class="navigation-item-main"><span class="drag-handle"><i class="fas fa-grip-vertical"></i></span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.target)}</small></div></div><label><input type="checkbox" ${item.visible !== false ? "checked" : ""} data-nav="${escapeHtml(item.id)}"> Visible</label></div>`).join("");
}
function renderAppearance() {
  const c = state.config || {}, t = c.theme || {}, contact = c.contact || {};
  setValue("site-name", c.siteName); setValue("site-tagline", c.tagline); setValue("site-logo", c.logoUrl); setValue("site-favicon", c.faviconUrl);
  setValue("theme-primary", t.primary); setValue("theme-secondary", t.secondary); setValue("theme-accent", t.accent); setValue("theme-heading-font", t.headingFont);
  setValue("contact-email", contact.email); setValue("contact-phone", contact.phone); setValue("contact-address", contact.address); setValue("contact-maps", contact.mapsUrl);
}
function renderOverview() {
  const website = state.church?.website || {}, status = state.config?.status || website.status || "draft", slug = website.slug;
  setText("overview-status", status === "published" ? "Published" : "Draft");
  setText("overview-published-at", state.config?.publishedAt ? "Sudah dipublikasikan" : "Belum pernah dipublikasikan");
  setText("website-church-name", state.church?.name || state.config?.siteName || "Gereja Digital");
  if (slug) { const url = `/church/${encodeURIComponent(slug)}`; const link = $("website-public-link"); if (link) { link.href = url; link.classList.remove("disabled"); } setText("overview-url", url); } else setText("overview-url", "Slug belum tersedia");
}
async function loadProfile(user) {
  const snap = await window.firebaseGetDoc(window.firebaseDoc(db, "users", user.uid));
  if (!snap.exists()) throw new Error("Profil pengguna tidak ditemukan.");
  const profile = snap.data();
  if (!["admin", "superadmin"].includes(profile.role)) throw new Error("ROLE_NOT_ALLOWED");
  if (!profile.churchId) throw new Error("Profil belum memiliki churchId.");
  state.user = user; state.profile = profile; state.churchId = profile.churchId;
}
async function loadDraft() {
  const result = await api("/draft");
  const loaded = result.data || {};
  state.church = loaded.church || {}; state.config = loaded.config || {}; state.navigation = loaded.navigation || { items: [] }; state.pages = loaded.pages || [];
  window.__cmsWebsiteDraft = loaded;
  renderOverview(); renderAppearance(); renderPages(); renderNavigation();
}
async function provision() { await api("/provision", { method: "POST", body: "{}" }); await loadDraft(); }
async function saveDraft() {
  const navigation = { items: (state.navigation?.items || []).map((item) => ({ ...item, visible: document.querySelector(`[data-nav="${CSS.escape(item.id)}"]`)?.checked !== false })) };
  const config = { ...state.config, siteName: getValue("site-name"), tagline: getValue("site-tagline"), logoUrl: getValue("site-logo"), faviconUrl: getValue("site-favicon"), theme: { ...(state.config?.theme || {}), primary: getValue("theme-primary"), secondary: getValue("theme-secondary"), accent: getValue("theme-accent"), headingFont: getValue("theme-heading-font") || "Poppins" }, contact: { email: getValue("contact-email"), phone: getValue("contact-phone"), address: getValue("contact-address"), mapsUrl: getValue("contact-maps") } };
  const result = await api("/draft", { method: "PUT", body: JSON.stringify({ config, navigation, pages: state.pages }) });
  state.config = { ...state.config, ...config }; state.navigation = navigation;
  window.__cmsWebsiteDraft = { ...(window.__cmsWebsiteDraft || {}), config: state.config, navigation: state.navigation, pages: state.pages };
  renderOverview(); window.dispatchEvent(new CustomEvent("cms:website-draft-updated")); return result;
}
function openPageEditor(pageId) {
  const page = state.pages.find((item) => item.id === pageId); if (!page) return;
  state.editingPage = JSON.parse(JSON.stringify(page)); show("page-editor-modal"); document.body.classList.add("modal-open");
}
function closePageEditor() { hide("page-editor-modal"); document.body.classList.remove("modal-open"); state.editingPage = null; }

// The v2 editor is authoritative. These compatibility functions prevent the legacy shell listeners from throwing.
function addSection() { if (window.__cmsWebsiteEditorV2?.addSection) window.__cmsWebsiteEditorV2.addSection(); }
async function savePageEditor(event) { event?.preventDefault(); if (window.__cmsWebsiteEditorV2?.savePage) return window.__cmsWebsiteEditorV2.savePage(); }
async function publish() { await saveDraft(); return api("/publish", { method: "POST", body: "{}" }); }

function bindUI() {
  document.querySelectorAll(".website-nav").forEach((button) => button.addEventListener("click", () => switchSection(button.dataset.section)));
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => switchSection(button.dataset.go)));
  $("website-logout")?.addEventListener("click", firebaseLogout);
  $("appearance-form")?.addEventListener("submit", async (e) => { e.preventDefault(); try { await saveDraft(); alert("Draft website berhasil disimpan."); } catch (err) { console.error(err); alert(err.message || "Gagal menyimpan draft."); } });
  $("website-publish-sidebar")?.addEventListener("click", async () => { try { const result = await publish(); alert(result.message || "Website berhasil dipublikasikan."); } catch (err) { console.error(err); alert(err.message || "Gagal mempublikasikan website."); } });
  $("preview-open")?.addEventListener("click", () => { const href = $("website-public-link")?.href; if (href && href !== "#") window.open(href, "_blank", "noopener"); else alert("Website publik belum memiliki slug."); });
  $("page-editor-close")?.addEventListener("click", closePageEditor); $("page-editor-cancel")?.addEventListener("click", closePageEditor); $("page-add-section")?.addEventListener("click", addSection); $("page-editor-form")?.addEventListener("submit", savePageEditor); $("page-editor-modal")?.addEventListener("click", (event) => { if (event.target.id === "page-editor-modal") closePageEditor(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("page-editor-modal")?.classList.contains("hidden")) closePageEditor(); });
}
function showStartupError(message) { console.error("[WEBSITE] startup failed:", message); hide("website-loading"); show("website-access-denied"); setText("website-access-denied", message); }

const onAuthStateChanged = getAuthStateChanged();
if (!auth || !db || typeof onAuthStateChanged !== "function") showStartupError("Gagal memuat autentikasi Firebase. Refresh halaman. Jika masih gagal, buka Console untuk melihat error Firebase.");
else {
  let authResolved = false;
  const authTimeout = window.setTimeout(() => { if (authResolved) return; showStartupError("Autentikasi terlalu lama dimuat. Pastikan koneksi internet aktif lalu refresh halaman."); }, 15000);
  onAuthStateChanged(auth, async (user) => {
    authResolved = true; window.clearTimeout(authTimeout);
    try { if (!user) { window.location.href = "index.html"; return; } await loadProfile(user); await provision(); bindUI(); hide("website-loading"); show("website-manager"); }
    catch (err) { console.error("[WEBSITE] access check failed:", err); hide("website-loading"); show("website-access-denied"); setText("website-access-denied", err.message === "ROLE_NOT_ALLOWED" ? "Akses Ditolak" : (err.message || "Gagal memuat Website Manager.")); }
  });
}