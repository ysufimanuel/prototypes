import "../firebase.js";

const auth = window.auth;
const db = window.db;
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
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

async function loadLocalFirebaseDraft() {
  const currentUser = window.auth?.currentUser || user;
  if (!currentUser) throw new Error("AUTH_REQUIRED");

  const profileSnap = await withTimeout(
    window.firebaseGetDoc(window.firebaseDoc(db, "users", currentUser.uid)),
    10000,
    "Profil Firebase Emulator terlalu lama dimuat.",
  );
  if (!profileSnap.exists()) throw new Error("Profil pengguna tidak ditemukan.");
  const profile = profileSnap.data() || {};
  if (!profile.churchId) throw new Error("Profil belum memiliki churchId.");

  const churchId = profile.churchId;
  const [churchSnap, configSnap, navSnap, pagesSnap] = await Promise.all([
    withTimeout(
      window.firebaseGetDoc(window.firebaseDoc(db, "churches", churchId)),
      10000,
      "Data gereja Firebase Emulator terlalu lama dimuat.",
    ),
    withTimeout(
      window.firebaseGetDoc(window.firebaseDoc(db, "churches", churchId, "website", "config")),
      10000,
      "Config website Firebase Emulator terlalu lama dimuat.",
    ),
    withTimeout(
      window.firebaseGetDoc(window.firebaseDoc(db, "churches", churchId, "website", "navigation")),
      10000,
      "Navigation Firebase Emulator terlalu lama dimuat.",
    ),
    withTimeout(
      window.firebaseGetDocs(window.firebaseCollection(db, "churches", churchId, "website", "content", "pages")),
      10000,
      "Pages Firebase Emulator terlalu lama dimuat.",
    ),
  ]);

  if (!churchSnap.exists()) throw new Error("CHURCH_NOT_FOUND");
  const church = churchSnap.data() || {};
  const pages = pagesSnap.empty
    ? []
    : pagesSnap.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));

  const result = {
    church: {
      id: churchId,
      name: String(church.nama || church.name || church.churchName || "Gereja Digital"),
      website: church.website || {},
    },
    config: configSnap.exists ? configSnap.data() : {},
    navigation: navSnap.exists ? navSnap.data() : { items: [] },
    pages,
  };
  draft = result;
  return result;
}

function installFirebaseDraftFetchBridge() {
  if (window.__cmsFirebaseDraftFetchBridge) return;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function bridgedFetch(input, init = {}) {
    let url = "";
    try {
      url = new URL(typeof input === "string" ? input : input?.url || "", window.location.origin).pathname;
    } catch {
      return originalFetch(input, init);
    }

    const method = String(init?.method || input?.method || "GET").toUpperCase();
    if (
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
      method === "GET" &&
      url === "/api/admin/website-firebase/draft"
    ) {
      try {
        const data = await loadLocalFirebaseDraft();
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("[WEBSITE LOCAL DRAFT BRIDGE]", error);
        return new Response(
          JSON.stringify({ success: false, message: error?.message || "Gagal memuat draft Firebase lokal." }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    return originalFetch(input, init);
  };

  window.__cmsFirebaseDraftFetchBridge = true;
}

async function loadDraft() {
  if (!user) throw new Error("AUTH_REQUIRED");
  const token = await withTimeout(
    user.getIdToken(),
    15000,
    "Firebase ID token terlalu lama dimuat. Silakan refresh halaman.",
  );
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("/api/admin/website/draft", {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success)
      throw new Error(data.message || "Gagal memuat draft preview.");
    draft = data.data;
    window.__cmsWebsiteDraft = draft;
    return draft;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request /draft terlalu lama (lebih dari 20 detik).");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadFirebaseDraft() {
  return loadLocalFirebaseDraft();
}

async function content() {
  const id = draft?.church?.id;
  if (!id) return { events: [], ministries: [] };
  const [events, ministries] = await Promise.all([
    window.firebaseGetDocs(
      window.firebaseCollection(db, "publicSites", id, "events"),
    ),
    window.firebaseGetDocs(
      window.firebaseCollection(db, "publicSites", id, "ministries"),
    ),
  ]);
  return {
    events: events.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
    ministries: ministries.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })),
  };
}

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

  select.addEventListener("change", async () => {
    selectedPage = select.value;
    try {
      await send();
      flashPreview();
    } catch (error) {
      console.error("[WEBSITE PREVIEW] page switch:", error);
      alert(error.message || "Preview halaman gagal dimuat.");
    }
  });

  bar.insertBefore(label, $("preview-refresh"));
  bar.insertBefore(select, $("preview-refresh"));
}

function fillPicker() {
  const select = $("preview-page-select");
  if (!select || !draft) return;

  const pages = Array.isArray(draft.pages) ? draft.pages : [];
  const current = selectedPage;
  select.innerHTML = pages
    .map(
      (page) =>
        `<option value="${String(page.id).replace(/"/g, "&quot;")}">${String(
          page.title || page.id,
        ).replace(/[&<>"']/g, "_")}</option>`,
    )
    .join("");

  if (!selectedPage || !pages.some((page) => page.id === selectedPage)) {
    selectedPage =
      pages.find((page) => page.id === "home")?.id || pages[0]?.id || "";
  } else if (current) {
    selectedPage = current;
  }
  select.value = selectedPage;
}

async function send() {
  const target = frame()?.contentWindow;
  if (!draft || !target || !frameReady) return false;

  const pages = Array.isArray(draft.pages) ? draft.pages : [];
  const page = pages.find((item) => item.id === selectedPage) || pages[0];
  if (!page) return false;

  const data = await content();
  target.postMessage(
    {
      type: "CMS_WEBSITE_PREVIEW",
      churchId: draft.church?.id || "",
      slug: draft.church?.website?.slug || "",
      config: draft.config || {},
      navigation: draft.navigation || { items: [] },
      page,
      ...data,
    },
    window.location.origin,
  );
  return true;
}

function setRefreshState(active) {
  const button = $("preview-refresh");
  if (!button) return;
  button.classList.toggle("is-refreshing", active);
  button.disabled = active;
  button.setAttribute("aria-busy", active ? "true" : "false");
  const icon = button.querySelector("i");
  if (icon) icon.classList.toggle("fa-spin", active);
}

function flashPreview() {
  const shell = document.querySelector(".preview-shell");
  if (!shell) return;
  shell.classList.remove("preview-updated");
  void shell.offsetWidth;
  shell.classList.add("preview-updated");
  window.setTimeout(() => shell.classList.remove("preview-updated"), 700);
}

function ensureNavigationDraftButton() {
  const box = $("website-navigation-list");
  if (!box || $("website-navigation-save-draft")) return;

  const button = document.createElement("button");
  button.id = "website-navigation-save-draft";
  button.type = "button";
  button.className = "website-btn primary v2-nav-save";
  button.innerHTML = '<i class="fas fa-save"></i><span>Simpan Draft Navigation</span>';
  button.style.marginTop = "16px";
  button.style.transition = "transform .2s ease, box-shadow .2s ease, opacity .2s ease";

  button.addEventListener("mouseenter", () => {
    if (!button.disabled) button.style.transform = "translateY(-2px)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.transform = "translateY(0)";
  });
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.style.transform = "scale(.98)";
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Menyimpan Draft...</span>';
    try {
      const current = await loadLocalFirebaseDraft();
      const navigation = {
        items: (current.navigation?.items || []).map((item) => ({
          ...item,
          visible: box.querySelector(`[data-nav="${CSS.escape(item.id)}"]`)?.checked !== false,
        })),
      };
      const token = await withTimeout(
        (window.auth?.currentUser || user).getIdToken(),
        15000,
        "Firebase ID token terlalu lama dimuat.",
      );
      const response = await fetch("/api/admin/website/draft", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          config: current.config || {},
          navigation,
          pages: current.pages || [],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      current.navigation = navigation;
      draft = current;
      window.__cmsWebsiteDraft = current;
      window.dispatchEvent(new CustomEvent("cms:website-draft-updated", { detail: { draft: current } }));
      flashPreview();
      button.innerHTML = '<i class="fas fa-check"></i><span>Draft Tersimpan</span>';
      window.setTimeout(() => {
        button.innerHTML = '<i class="fas fa-save"></i><span>Simpan Draft Navigation</span>';
      }, 1200);
    } catch (error) {
      console.error("[WEBSITE NAV DRAFT]", error);
      alert(error.message || "Gagal menyimpan navigation draft.");
      button.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Gagal, Coba Lagi</span>';
    } finally {
      button.disabled = false;
      button.style.transform = "translateY(0)";
    }
  });

  box.parentElement?.appendChild(button);
}

function ensureEditorCompatibilityFields() {
  const form = $("page-editor-form");
  if (!form || $("page-editor-published")) return;
  const fields = document.createElement("div");
  fields.hidden = true;
  fields.innerHTML = `
    <input id="page-editor-id" type="hidden">
    <input id="page-editor-title-input" type="text">
    <input id="page-editor-slug" type="text">
    <input id="page-editor-published" type="checkbox">
    <div id="page-editor-sections"></div>
    <button id="page-add-section" type="button"></button>
    <button id="page-editor-cancel" type="button"></button>
  `;
  form.appendChild(fields);
}

async function refresh({ animate = true, keepPage = true } = {}) {
  if (busy || !user) return;
  busy = true;
  if (animate) setRefreshState(true);

  try {
    const previousPage = keepPage ? selectedPage : "";
    await loadDraft();
    if (previousPage) selectedPage = previousPage;
    ensurePicker();
    ensureNavigationDraftButton();
    ensureEditorCompatibilityFields();
    fillPicker();

    if (!frameReady) {
      flashPreview();
      return;
    }

    await send();
    flashPreview();
  } catch (error) {
    console.error("[WEBSITE PREVIEW]", error);
    alert(error.message || "Preview gagal dimuat.");
  } finally {
    busy = false;
    if (animate) setRefreshState(false);
  }
}

function applyDraft(nextDraft) {
  if (!nextDraft || !Array.isArray(nextDraft.pages)) return false;
  draft = JSON.parse(JSON.stringify(nextDraft));
  window.__cmsWebsiteDraft = draft;
  ensurePicker();
  ensureNavigationDraftButton();
  ensureEditorCompatibilityFields();
  fillPicker();
  return true;
}

function init() {
  installFirebaseDraftFetchBridge();
  ensurePicker();
  ensureNavigationDraftButton();
  ensureEditorCompatibilityFields();

  $("preview-refresh")?.addEventListener("click", (event) => {
    event.preventDefault();
    refresh({ animate: true, keepPage: true });
  });

  $("website-preview-frame")?.addEventListener("load", () => {
    frameReady = true;
    send().catch(console.error);
  });

  window.addEventListener("message", (event) => {
    if (
      event.origin !== window.location.origin ||
      event.data?.type !== "CMS_WEBSITE_PREVIEW_READY"
    )
      return;
    frameReady = true;
    send().catch(console.error);
  });

  window.addEventListener("cms:website-draft-updated", async (event) => {
    const suppliedDraft = event.detail?.draft;
    if (applyDraft(suppliedDraft)) {
      try {
        await send();
        flashPreview();
      } catch (error) {
        console.error("[WEBSITE PREVIEW] local draft update:", error);
      }
      return;
    }

    try {
      await loadFirebaseDraft();
      fillPicker();
      await send();
      flashPreview();
    } catch (error) {
      console.error("[WEBSITE PREVIEW] Firebase draft refresh:", error);
      alert(error.message || "Preview gagal diperbarui.");
    }
  });

  const previewFrame = frame();
  if (previewFrame?.contentDocument?.readyState === "complete") {
    frameReady = true;
  }

  refresh({ animate: false, keepPage: true });
}

window.firebaseOnAuthStateChanged(auth, (nextUser) => {
  user = nextUser;
  if (user) init();
});
