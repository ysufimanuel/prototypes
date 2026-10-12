// Website Manager startup guard.
// Firebase is a top-level-await module, so import it here before installing the auth wrapper.
// The watchdog also runs independently so profile/provision/draft failures cannot leave the page stuck forever.
import "../firebase.js";

(function installWebsiteStartupGuard() {
  const timeoutMs = 20000;
  let startupSettled = false;

  const showStartupFailure = (message) => {
    const loading = document.getElementById("website-loading");
    const manager = document.getElementById("website-manager");
    if (!loading || !manager || loading.classList.contains("hidden") || !manager.classList.contains("hidden")) {
      return;
    }

    console.error("[WEBSITE] Startup guard:", message);
    loading.classList.add("hidden");

    const denied = document.getElementById("website-access-denied");
    if (!denied) return;
    denied.classList.remove("hidden");

    const icon = denied.querySelector("i");
    if (icon) icon.className = "fas fa-triangle-exclamation";
    const heading = denied.querySelector("h1");
    if (heading) heading.textContent = "Website Manager gagal dimuat";
    const paragraph = denied.querySelector("p");
    if (paragraph) paragraph.textContent = message;
  };

  // Independent watchdog: this catches hangs after Firebase auth, including
  // loadProfile(), /provision, /draft, or UI initialization.
  window.setTimeout(() => {
    if (!startupSettled) {
      showStartupFailure(
        "Proses Firebase/API terlalu lama (lebih dari 20 detik). Refresh halaman dan lihat Console untuk mengetahui tahap yang berhenti.",
      );
    }
  }, timeoutMs);

  if (window.firebaseInitError) {
    showStartupFailure(`Firebase gagal diinisialisasi: ${window.firebaseInitError}`);
    return;
  }

  const originalAuthStateChanged = window.firebaseOnAuthStateChanged;
  if (typeof originalAuthStateChanged !== "function") {
    console.error("[WEBSITE] Startup guard could not install: Firebase Auth is unavailable.");
    return;
  }

  window.firebaseOnAuthStateChanged = (auth, callback) =>
    originalAuthStateChanged(auth, (user) => {
      try {
        const result = callback(user);
        if (result && typeof result.then === "function") {
          return result.finally(() => {
            startupSettled = true;
          });
        }
        startupSettled = true;
        return result;
      } catch (error) {
        startupSettled = true;
        throw error;
      }
    });

  console.log("[WEBSITE] Startup guard installed");
})();