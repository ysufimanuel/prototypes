import "../firebase.js";

const API = "/api/admin/website";
let publishing = false;

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

async function api(user, path, options = {}) {
  const token = await withTimeout(
    user.getIdToken(),
    15000,
    "Firebase ID token terlalu lama dimuat. Silakan refresh halaman.",
  );
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(API + path, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request ${path} terlalu lama (lebih dari 30 detik).`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function publish(user) {
  await api(user, "/publish", { method: "POST", body: "{}" });
  await api(user, "/publish-content", { method: "POST", body: "{}" });
  window.dispatchEvent(new CustomEvent("cms:website-draft-updated"));
}

function init() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("#website-publish-sidebar");
    if (!button || publishing) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const user = window.auth?.currentUser;
    if (!user) {
      alert("Sesi login belum siap.");
      return;
    }

    publishing = true;
    button.disabled = true;
    const original = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Publishing...</span>';

    try {
      await publish(user);
      alert("Website dan data Event/Ministries berhasil dipublikasikan.");
    } catch (error) {
      console.error("[WEBSITE PUBLISH FIX]", error);
      alert(error.message || "Gagal mempublikasikan website.");
    } finally {
      publishing = false;
      button.disabled = false;
      button.innerHTML = original;
    }
  }, true);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
