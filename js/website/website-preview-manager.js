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
  if (!user) throw new Error("AUTH_REQUIRED");
  const token = await withTimeout(
    user.getIdToken(),
    15000,
    "Firebase ID token terlalu lama dimuat. Silakan refresh halaman.",
  );
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("/api/admin/website-firebase/draft", {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success)
      throw new Error(data.message || "Gagal memuat draft Firebase.");
    draft = data.data;
    return draft;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request draft Firebase terlalu lama (lebih dari 20 detik).");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
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

async function refresh({ animate = true, keepPage = true } = {}) {
  if (busy || !user) return;
  busy = true;
  if (animate) setRefreshState(true);

  try {
    const previousPage = keepPage ? selectedPage : "";
    await loadDraft();
    if (previousPage) selectedPage = previousPage;
    ensurePicker();
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
  ensurePicker();
  fillPicker();
  return true;
}

function init() {
  ensurePicker();

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
