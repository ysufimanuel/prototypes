const APP_CHECK_SITE_KEY = window.APP_CHECK_SITE_KEY || "";
const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(
  window.location.hostname,
);

let appCheck = null;
let appCheckInitPromise = null;

async function initializeFirebaseAppCheck() {
  if (isLocalhost || !APP_CHECK_SITE_KEY || !window.firebaseApp) {
    return null;
  }

  if (appCheckInitPromise) return appCheckInitPromise;

  appCheckInitPromise = (async () => {
    try {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } =
        await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-app-check.js");

      appCheck = initializeAppCheck(window.firebaseApp, {
        provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });

      console.log("[APP CHECK] Production provider initialized");
      return appCheck;
    } catch (error) {
      console.error("[APP CHECK] Initialization failed:", error);
      appCheck = null;
      return null;
    }
  })();

  return appCheckInitPromise;
}

async function getFirebaseAppCheckToken(forceRefresh = false) {
  const instance = await initializeFirebaseAppCheck();
  if (!instance) return null;

  try {
    const { getToken } = await import(
      "https://www.gstatic.com/firebasejs/12.10.0/firebase-app-check.js"
    );
    const result = await getToken(instance, forceRefresh);
    return result?.token || null;
  } catch (error) {
    console.error("[APP CHECK] Token unavailable:", error);
    return null;
  }
}

window.getFirebaseAppCheckToken = getFirebaseAppCheckToken;
window.initializeFirebaseAppCheck = initializeFirebaseAppCheck;

initializeFirebaseAppCheck();
