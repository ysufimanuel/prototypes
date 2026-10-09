import "../firebase.js";

const auth = window.auth;
const db = window.db;
const onAuthStateChanged = window.firebaseOnAuthStateChanged;
const firebaseLogout = () => window.logoutFromFirebase?.();

const $ = (id) => document.getElementById(id);
const state = {
  user: null,
  profile: null,
  churchId: null,
  church: null,
  config: null,
  navigation: null,
  pages: [],
  editingPage: null,
};
const API_BASE = "/api/admin/website";
const SECTION_TYPES = [
  "hero",
  "welcome",
  "serviceSchedule",
  "featuredEvents",
  "about",
  "ministries",
  "sermons",
  "contact",
  "cta",
];

function show(id) {
  $(id)?.classList.remove("hidden");
}
function hide(id) {
  $(id)?.classList.add("hidden");
}
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "";
}
function setValue(id, value) {
  const el = $(id);
  if (el) el.value = value ?? "";
}
function getValue(id) {
  return $(id)?.value?.trim() || "";
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>\\"]/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\\": "&#92;",
        '"': "&quot;",
      })[m],
  );
}
function sectionLabel(type) {
  return (
    {
      hero: "Hero",
      welcome: "Welcome",
      serviceSchedule: "Jadwal Ibadah",
      featuredEvents: "Event Terdekat",
      about: "Tentang Kami",
      ministries: "Pelayanan",
      sermons: "Resources / Khotbah",
      contact: "Kontak",
      cta: "Call to Action",
    }[type] || type
  );
}
function sectionDefaults(type) {
  return {
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    enabled: true,
    order: 1,
    config: {},
  };
}

async function api(path, options = {}) {
  if (!state.user) throw new Error("AUTH_REQUIRED");
  const token = await state.user.getIdToken(true);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false)
    throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}

function switchSection(section) {
  document
    .querySelectorAll(".website-section")
    .forEach((el) =>
      el.classList.toggle("active", el.dataset.panel === section),
    );
  document
    .querySelectorAll(".website-nav")
    .forEach((el) =>
      el.classList.toggle("active", el.dataset.section === section),
    );
}

function renderPages() {
  const el = $("website-pages-list");
  if (!el) return;
  el.innerHTML = state.pages
    .map(
      (page) =>
        `<div class="page-item"><div class="page-item-main"><span class="drag-handle"><i class="fas fa-grip-vertical"></i></span><div><strong>${escapeHtml(page.title)}</strong><small>${escapeHtml(page.slug)} · ${page.published === false ? "Draft" : "Published"}</small></div></div><button class="website-btn secondary page-edit-btn" type="button" data-page="${escapeHtml(page.id)}">Edit</button></div>`,
    )
    .join("");
  el.querySelectorAll(".page-edit-btn").forEach((btn) =>
    btn.addEventListener("click", () => openPageEditor(btn.dataset.page)),
  );
}

function renderNavigation() {
  const el = $("website-navigation-list");
  if (!el) return;
  const items = state.navigation?.items || [];
  el.innerHTML = items
    .map(
      (item) =>
        `<div class="navigation-item"><div class="navigation-item-main"><span class="drag-handle"><i class="fas fa-grip-vertical"></i></span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.target)}</small></div></div><label><input type="checkbox" ${item.visible !== false ? "checked" : ""} data-nav="${escapeHtml(item.id)}"> Visible</label></div>`,
    )
    .join("");
}

function renderAppearance() {
  const c = state.config || {},
    t = c.theme || {},
    contact = c.contact || {};
  setValue("site-name", c.siteName);
  setValue("site-tagline", c.tagline);
  setValue("site-logo", c.logoUrl);
  setValue("site-favicon", c.faviconUrl);
  setValue("theme-primary", t.primary);
  setValue("theme-secondary", t.secondary);
  setValue("theme-accent", t.accent);
  setValue("theme-heading-font", t.headingFont);
  setValue("contact-email", contact.email);
  setValue("contact-phone", contact.phone);
  setValue("contact-address", contact.address);
  setValue("contact-maps", contact.mapsUrl);
}

function renderOverview() {
  const website = state.church?.website || {},
    status = state.config?.status || website.status || "draft",
    slug = website.slug;
  setText("overview-status", status === "published" ? "Published" : "Draft");
  setText(
    "overview-published-at",
    state.config?.publishedAt
      ? "Sudah dipublikasikan"
      : "Belum pernah dipublikasikan",
  );
  setText(
    "website-church-name",
    state.church?.name || state.config?.siteName || "Gereja Digital",
  );
  if (slug) {
    const url = `/church/${encodeURIComponent(slug)}`;
    const link = $("website-public-link");
    link.href = url;
    link.classList.remove("disabled");
    setText("overview-url", url);
  } else {
    setText("overview-url", "Slug belum tersedia");
  }
}

async function loadProfile(user) {
  const snap = await window.firebaseGetDoc(
    window.firebaseDoc(db, "users", user.uid),
  );
  if (!snap.exists()) throw new Error("Profil pengguna tidak ditemukan.");
  const profile = snap.data();
  if (!["admin", "superadmin"].includes(profile.role))
    throw new Error("ROLE_NOT_ALLOWED");
  if (!profile.churchId) throw new Error("Profil belum memiliki churchId.");
  state.user = user;
  state.profile = profile;
  state.churchId = profile.churchId;
}

async function loadDraft() {
  const result = await api("/draft");
  state.church = result.data.church || {};
  state.config = result.data.config || {};
  state.navigation = result.data.navigation || { items: [] };
  state.pages = result.data.pages || [];
  renderOverview();
  renderAppearance();
  renderPages();
  renderNavigation();
}

async function provision() {
  await api("/provision", { method: "POST", body: "{}" });
  await loadDraft();
}

async function saveDraft() {
  const navigation = {
    items: (state.navigation?.items || []).map((item) => ({
      ...item,
      visible:
        document.querySelector(`[data-nav="${CSS.escape(item.id)}"]`)
          ?.checked !== false,
    })),
  };
  const config = {
    ...state.config,
    siteName: getValue("site-name"),
    tagline: getValue("site-tagline"),
    logoUrl: getValue("site-logo"),
    faviconUrl: getValue("site-favicon"),
    theme: {
      ...(state.config?.theme || {}),
      primary: getValue("theme-primary"),
      secondary: getValue("theme-secondary"),
      accent: getValue("theme-accent"),
      headingFont: getValue("theme-heading-font") || "Poppins",
    },
    contact: {
      email: getValue("contact-email"),
      phone: getValue("contact-phone"),
      address: getValue("contact-address"),
      mapsUrl: getValue("contact-maps"),
    },
  };
  const result = await api("/draft", {
    method: "PUT",
    body: JSON.stringify({ config, navigation, pages: state.pages }),
  });
  state.config = { ...state.config, ...config };
  state.navigation = navigation;
  renderOverview();
  window.dispatchEvent(new CustomEvent("cms:website-draft-updated"));
  return result;
}

function openPageEditor(pageId) {
  const page = state.pages.find((item) => item.id === pageId);
  if (!page) return;
  state.editingPage = JSON.parse(JSON.stringify(page));
  setValue("page-editor-id", page.id);
  setValue("page-editor-title-input", page.title);
  setValue("page-editor-slug", page.slug);
  $("page-editor-published").checked = page.published !== false;
  renderEditorSections();
  show("page-editor-modal");
  document.body.classList.add("modal-open");
}

function closePageEditor() {
  hide("page-editor-modal");
  document.body.classList.remove("modal-open");
  state.editingPage = null;
}

function renderEditorSections() {
  const el = $("page-editor-sections");
  if (!el || !state.editingPage) return;
  const sections = (state.editingPage.sections || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  el.innerHTML = sections
    .map((section, index) => {
      const c = section.config || {};
      return `<article class="editor-section" data-editor-section="${escapeHtml(section.id)}"><div class="editor-section-top"><div><strong>${index + 1}. ${escapeHtml(sectionLabel(section.type))}</strong><small>${escapeHtml(section.type)}</small></div><div class="editor-section-actions"><label class="editor-checkbox"><input class="section-enabled" type="checkbox" ${section.enabled !== false ? "checked" : ""}> Aktif</label><button class="icon-btn section-delete" type="button" title="Hapus"><i class="fas fa-trash"></i></button></div></div><div class="form-grid"><label>Jenis<select class="section-type">${SECTION_TYPES.map((type) => `<option value="${type}" ${section.type === type ? "selected" : ""}>${escapeHtml(sectionLabel(type))}</option>`).join("")}</select></label><label>Judul<input class="section-title" type="text" maxlength="160" value="${escapeHtml(c.title || "")}"></label><label class="full">Deskripsi<textarea class="section-description" rows="3" maxlength="500">${escapeHtml(c.description || "")}</textarea></label>${["serviceSchedule", "featuredEvents", "ministries"].includes(section.type) ? `<label>Batas Item<input class="section-limit" type="number" min="1" max="20" value="${Number(c.limit) || 4}"></label>` : ""}</div></article>`;
    })
    .join("");
  el.querySelectorAll(".section-delete").forEach((btn) =>
    btn.addEventListener("click", () => {
      btn.closest(".editor-section")?.remove();
      syncEditorSections();
    }),
  );
  el.querySelectorAll(".section-type").forEach((select) =>
    select.addEventListener("change", () => {
      syncEditorSections();
      renderEditorSections();
    }),
  );
}

function syncEditorSections() {
  if (!state.editingPage) return;
  const cards = [...document.querySelectorAll(".editor-section")];
  state.editingPage.sections = cards.map((card, index) => {
    const id = card.dataset.editorSection;
    const old =
      (state.editingPage.sections || []).find((section) => section.id === id) ||
      sectionDefaults("welcome");
    const type = card.querySelector(".section-type")?.value || old.type;
    const config = {
      ...(old.config || {}),
      title: card.querySelector(".section-title")?.value?.trim() || "",
      description:
        card.querySelector(".section-description")?.value?.trim() || "",
    };
    const limit = card.querySelector(".section-limit");
    if (limit)
      config.limit = Math.min(20, Math.max(1, Number(limit.value) || 4));
    else delete config.limit;
    return {
      ...old,
      id,
      type,
      enabled: card.querySelector(".section-enabled")?.checked !== false,
      order: index + 1,
      config,
    };
  });
}

function addSection() {
  if (!state.editingPage) return;
  syncEditorSections();
  state.editingPage.sections = [
    ...(state.editingPage.sections || []),
    sectionDefaults("welcome"),
  ];
  state.editingPage.sections.forEach(
    (section, index) => (section.order = index + 1),
  );
  renderEditorSections();
}

async function savePageEditor(event) {
  event.preventDefault();
  if (!state.editingPage) return;
  syncEditorSections();
  state.editingPage.title = getValue("page-editor-title-input");
  state.editingPage.slug = getValue("page-editor-slug") || "/";
  state.editingPage.published = $("page-editor-published").checked;
  const index = state.pages.findIndex(
    (page) => page.id === state.editingPage.id,
  );
  if (index < 0) return;
  state.pages[index] = JSON.parse(JSON.stringify(state.editingPage));
  try {
    await saveDraft();
    renderPages();
    closePageEditor();
    alert("Page berhasil disimpan sebagai draft.");
  } catch (error) {
    console.error(error);
    alert(error.message || "Gagal menyimpan page.");
  }
}

async function publish() {
  await saveDraft();
  const result = await api("/publish", { method: "POST", body: "{}" });
  const eventsResult = await api("/publish-events", {
    method: "POST",
    body: "{}",
  });
  const groupsResult = await api("/publish-groups", {
    method: "POST",
    body: "{}",
  });
  await loadDraft();
  return {
    ...result,
    eventCount: eventsResult.eventCount,
    ministryCount: groupsResult.ministryCount,
  };
}

function bindUI() {
  document
    .querySelectorAll(".website-nav")
    .forEach((btn) =>
      btn.addEventListener("click", () => switchSection(btn.dataset.section)),
    );
  document
    .querySelectorAll("[data-go]")
    .forEach((btn) =>
      btn.addEventListener("click", () => switchSection(btn.dataset.go)),
    );
  $("website-logout")?.addEventListener("click", async () => {
    await firebaseLogout();
  });
  $("appearance-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await saveDraft();
      alert("Draft website berhasil disimpan.");
    } catch (err) {
      console.error(err);
      alert(err.message || "Gagal menyimpan draft.");
    }
  });
  $("website-publish-sidebar")?.addEventListener("click", async () => {
    try {
      const result = await publish();
      alert(
        `${result.message || "Website berhasil dipublikasikan."}${typeof result.eventCount === "number" ? ` Event publik: ${result.eventCount}.` : ""}${typeof result.ministryCount === "number" ? ` Ministry publik: ${result.ministryCount}.` : ""}`,
      );
    } catch (err) {
      console.error(err);
      alert(err.message || "Gagal mempublikasikan website.");
    }
  });
  $("preview-open")?.addEventListener("click", () => {
    const href = $("website-public-link")?.href;
    if (href && href !== "#") window.open(href, "_blank", "noopener");
    else alert("Website publik belum memiliki slug.");
  });
  $("page-editor-close")?.addEventListener("click", closePageEditor);
  $("page-editor-cancel")?.addEventListener("click", closePageEditor);
  $("page-add-section")?.addEventListener("click", addSection);
  $("page-editor-form")?.addEventListener("submit", savePageEditor);
  $("page-editor-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "page-editor-modal") closePageEditor();
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !$("page-editor-modal")?.classList.contains("hidden")
    )
      closePageEditor();
  });
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    await loadProfile(user);
    await provision();
    bindUI();
    hide("website-loading");
    show("website-manager");
  } catch (err) {
    console.error("[WEBSITE] access check failed:", err);
    hide("website-loading");
    show("website-access-denied");
    if (err.message === "ROLE_NOT_ALLOWED")
      setText("website-access-denied", "Akses Ditolak");
  }
});
