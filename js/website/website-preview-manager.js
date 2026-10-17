import "../firebase.js";

const auth = window.auth;
const $ = (id) => document.getElementById(id);
const frame = () => $("website-preview-frame");
let user = null;
let draft = null;
let selectedPage = "";
let busy = false;
let frameReady = false;

async function withTimeout(promise, timeoutMs, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = window.setTimeout(() => reject(new Error(message)), timeoutMs); })]);
  } finally { window.clearTimeout(timer); }
}

async function loadDraft() {
  if (!user) throw new Error("AUTH_REQUIRED");
  const token = await withTimeout(user.getIdToken(), 15000, "Firebase ID token terlalu lama dimuat. Silakan refresh halaman.");
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch("/api/admin/website/draft", { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.message || `HTTP ${response.status}`);
    draft = data.data || { church: {}, config: {}, navigation: { items: [] }, pages: [], content: { events: [], ministries: [] } };
    draft.content = draft.content || { events: [], ministries: [] };
    window.__cmsWebsiteDraft = draft;
    return draft;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Request /draft terlalu lama (lebih dari 30 detik).");
    throw error;
  } finally { window.clearTimeout(timer); }
}

async function content() { return draft?.content || { events: [], ministries: [] }; }

function ensurePicker() {
  const bar = document.querySelector(".preview-toolbar");
  if (!bar || $("preview-page-select")) return;
  const label = document.createElement("label");
  label.className = "preview-page-picker";
  label.setAttribute("for", "preview-page-select");
  label.textContent = "Halaman";
  const select = document.createElement("select");
  select.id = "preview-page-select";
  select.className = "website-btn secondary preview-page-select";
  select.setAttribute("aria-label", "Pilih halaman preview");
  select.addEventListener("change", async () => { selectedPage = select.value; try { await send(); flashPreview(); } catch (error) { console.error("[WEBSITE PREVIEW] page switch:", error); alert(error.message || "Preview halaman gagal dimuat."); } });
  bar.insertBefore(label, $("preview-refresh"));
  bar.insertBefore(select, $("preview-refresh"));
}

function fillPicker() {
  const select = $("preview-page-select");
  if (!select || !draft) return;
  const pages = Array.isArray(draft.pages) ? draft.pages : [];
  const current = selectedPage;
  select.innerHTML = pages.map((page) => `<option value="${String(page.id).replace(/"/g, "&quot;")}">${String(page.title || page.id).replace(/[&<>"']/g, "_")}</option>`).join("");
  if (!selectedPage || !pages.some((page) => page.id === selectedPage)) selectedPage = pages.find((page) => page.id === "home")?.id || pages[0]?.id || "";
  else if (current) selectedPage = current;
  select.value = selectedPage;
}

async function send() {
  const target = frame()?.contentWindow;
  if (!draft || !target) return false;
  const pages = Array.isArray(draft.pages) ? draft.pages : [];
  const page = pages.find((item) => item.id === selectedPage) || pages[0];
  if (!page) return false;
  const data = await content();
  target.postMessage({ type: "CMS_WEBSITE_PREVIEW", churchId: draft.church?.id || "", slug: draft.church?.website?.slug || "", config: draft.config || {}, navigation: draft.navigation || { items: [] }, page, ...data }, window.location.origin);
  frameReady = true;
  return true;
}

function setRefreshState(active) { const button = $("preview-refresh"); if (!button) return; button.classList.toggle("is-refreshing", active); button.disabled = active; button.setAttribute("aria-busy", active ? "true" : "false"); button.querySelector("i")?.classList.toggle("fa-spin", active); }
function flashPreview() { const shell = document.querySelector(".preview-shell"); if (!shell) return; shell.classList.remove("preview-updated"); void shell.offsetWidth; shell.classList.add("preview-updated"); window.setTimeout(() => shell.classList.remove("preview-updated"), 700); }

function ensureNavigationDraftButton() {
  const box = $("website-navigation-list");
  if (!box || $("website-navigation-save-draft")) return;
  const button = document.createElement("button"); button.id = "website-navigation-save-draft"; button.type = "button"; button.className = "website-btn primary v2-nav-save"; button.innerHTML = '<i class="fas fa-save"></i><span>Simpan Draft Navigation</span>'; button.style.marginTop = "16px"; box.parentElement?.appendChild(button);
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Menyimpan Draft...</span>';
    try {
      const current = await loadDraft();
      current.navigation = { items: (current.navigation?.items || []).map((item) => ({ ...item, visible: box.querySelector(`[data-nav="${CSS.escape(item.id)}"], [data-v2-nav="${CSS.escape(item.id)}"]`)?.checked !== false })) };
      const token = await withTimeout(user.getIdToken(), 15000, "Firebase ID token terlalu lama dimuat.");
      const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch("/api/admin/website/draft", { method: "PUT", signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ config: current.config || {}, navigation: current.navigation, pages: current.pages || [] }) });
        const data = await response.json().catch(() => ({})); if (!response.ok || data.success === false) throw new Error(data.message || `HTTP ${response.status}`);
      } finally { window.clearTimeout(timer); }
      draft = current; window.__cmsWebsiteDraft = current; window.dispatchEvent(new CustomEvent("cms:website-draft-updated", { detail: { draft: current } })); button.innerHTML = '<i class="fas fa-check"></i><span>Draft Tersimpan</span>'; flashPreview(); window.setTimeout(() => { button.innerHTML = '<i class="fas fa-save"></i><span>Simpan Draft Navigation</span>'; }, 1200);
    } catch (error) { console.error("[WEBSITE NAV DRAFT]", error); alert(error.message || "Gagal menyimpan navigation draft."); button.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Gagal, Coba Lagi</span>'; } finally { button.disabled = false; }
  });
}

function ensureEditorCompatibilityFields() {
  const form = $("page-editor-form"); if (!form || $("page-editor-published")) return;
  const fields = document.createElement("div"); fields.hidden = true; fields.innerHTML = '<input id="page-editor-id" type="hidden"><input id="page-editor-title-input" type="text"><input id="page-editor-slug" type="text"><input id="page-editor-published" type="checkbox"><div id="page-editor-sections"></div><button id="page-add-section" type="button"></button><button id="page-editor-cancel" type="button"></button>'; form.appendChild(fields);
}

async function refresh({ animate = true, keepPage = true } = {}) {
  if (busy || !user) return;
  busy = true; if (animate) setRefreshState(true);
  try {
    const previousPage = keepPage ? selectedPage : "";
    await loadDraft();
    if (previousPage) selectedPage = previousPage;
    ensurePicker(); ensureNavigationDraftButton(); ensureEditorCompatibilityFields(); fillPicker();
    await send();
    flashPreview();
  } catch (error) { console.error("[WEBSITE PREVIEW]", error); alert(error.message || "Preview gagal dimuat."); }
  finally { busy = false; if (animate) setRefreshState(false); }
}

function applyDraft(nextDraft) {
  if (!nextDraft || !Array.isArray(nextDraft.pages)) return false;
  draft = JSON.parse(JSON.stringify(nextDraft)); draft.content = draft.content || { events: [], ministries: [] }; window.__cmsWebsiteDraft = draft; ensurePicker(); ensureNavigationDraftButton(); ensureEditorCompatibilityFields(); fillPicker(); return true;
}

function init() {
  ensurePicker(); ensureNavigationDraftButton(); ensureEditorCompatibilityFields();
  $("preview-refresh")?.addEventListener("click", (event) => { event.preventDefault(); refresh({ animate: true, keepPage: true }); });
  $("website-preview-frame")?.addEventListener("load", () => { frameReady = true; send().catch(console.error); });
  window.addEventListener("message", (event) => { if (event.origin !== window.location.origin || event.data?.type !== "CMS_WEBSITE_PREVIEW_READY") return; frameReady = true; send().catch(console.error); });
  window.addEventListener("cms:website-draft-updated", async (event) => { if (applyDraft(event.detail?.draft)) { try { await send(); flashPreview(); } catch (error) { console.error("[WEBSITE PREVIEW] draft update:", error); } return; } refresh({ animate: false, keepPage: true }); });
  refresh({ animate: false, keepPage: true });
}

if (window.firebaseOnAuthStateChanged) window.firebaseOnAuthStateChanged(auth, (currentUser) => { user = currentUser; if (user) init(); });
else if (auth?.currentUser) { user = auth.currentUser; init(); }
