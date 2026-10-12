// Website Manager startup guard.
// Firebase is a top-level-await module, so import it here before installing the auth wrapper.
// The main module performs Firebase/profile/provision work inside the auth callback.
// This wrapper prevents a slow Firebase/API operation from leaving the loading screen forever.
import "../firebase.js";

(function installWebsiteStartupGuard() {
  const originalAuthStateChanged = window.firebaseOnAuthStateChanged;
  if (typeof originalAuthStateChanged !== "function") {
    console.error("[WEBSITE] Startup guard could not install: Firebase Auth is unavailable.");
    return;
  }

  const timeoutMs = 15000;
  const showTimeout = () => {
    const loading = document.getElementById("website-loading");
    const manager = document.getElementById("website-manager");
    if (
      !loading ||
      !manager ||
      loading.classList.contains("hidden") ||
      !manager.classList.contains("hidden")
    )
      return;

    console.error(
      "[WEBSITE] Startup timed out after 15s. Firebase/API initialization did not finish.",
    );
    loading.classList.add("hidden");
    const denied = document.getElementById("website-access-denied");
    if (denied) {
      denied.classList.remove("hidden");
      const icon = denied.querySelector("i");
      if (icon) icon.className = "fas fa-triangle-exclamation";
      const heading = denied.querySelector("h1");
      if (heading) heading.textContent = "Website Manager gagal dimuat";
      const message = denied.querySelector("p");
      if (message)
        message.textContent =
          "Proses Firebase/API terlalu lama. Refresh halaman dan lihat Console jika masalah berulang.";
    }
  };

  window.firebaseOnAuthStateChanged = (auth, callback) =>
    originalAuthStateChanged(auth, (user) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (!settled) showTimeout();
      }, timeoutMs);

      try {
        const result = callback(user);
        if (result && typeof result.then === "function") {
          result.finally(() => {
            settled = true;
            window.clearTimeout(timer);
          });
        } else {
          settled = true;
          window.clearTimeout(timer);
        }
        return result;
      } catch (error) {
        settled = true;
        window.clearTimeout(timer);
        throw error;
      }
    });

  console.log("[WEBSITE] Startup guard installed");
})();