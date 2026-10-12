// Website Manager startup guard.
// The main module performs Firebase/profile/provision work inside the auth callback.
// This wrapper prevents a slow Firebase/API operation from leaving the loading screen forever.
(function installWebsiteStartupGuard() {
  const originalAuthStateChanged = window.firebaseOnAuthStateChanged;
  if (typeof originalAuthStateChanged !== "function") return;

  const timeoutMs = 15000;
  const showTimeout = () => {
    const loading = document.getElementById("website-loading");
    const manager = document.getElementById("website-manager");
    if (!loading || !manager || loading.classList.contains("hidden") || !manager.classList.contains("hidden")) return;

    console.error("[WEBSITE] Startup timed out after 15s. Firebase/API initialization did not finish.");
    loading.classList.add("hidden");
    const denied = document.getElementById("website-access-denied");
    if (denied) {
      denied.classList.remove("hidden");
      const icon = denied.querySelector("i");
      if (icon) icon.className = "fas fa-triangle-exclamation";
      const heading = denied.querySelector("h1");
      if (heading) heading.textContent = "Website Manager gagal dimuat";
      const message = denied.querySelector("p");
      if (message) message.textContent = "Proses Firebase/API terlalu lama. Refresh halaman dan lihat Console jika masalah berulang.";
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
        return Promise.resolve(result).finally(() => {
          settled = true;
          window.clearTimeout(timer);
        });
      } catch (error) {
        settled = true;
        window.clearTimeout(timer);
        throw error;
      }
    });

  console.log("[WEBSITE] Startup guard installed");
})();
