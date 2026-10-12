import "./firebase.js";

const APP_CHECK_SITE_KEY = "6Lc6Y-gtAAAAAOIWYAW8j66GnhgFn3vbc-xGUjI8";
const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(
  window.location.hostname,
);

let appCheck = null;
let appCheckInitPromise = null;

function withTimeout(promise, timeoutMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = window.setTimeout(() => resolve(null), timeoutMs);
    }),
  ]).finally(() => window.clearTimeout(timer));
}

async function initializeFirebaseAppCheck() {
  if (isLocalhost || !APP_CHECK_SITE_KEY || !window.firebaseApp) {
    return null;
  }

  if (appCheckInitPromise) return appCheckInitPromise;

  appCheckInitPromise = (async () => {
    try {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } =
        await import(
          "https://www.gstatic.com/firebasejs/12.10.0/firebase-app-check.js"
        );

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
  const instance = await withTimeout(initializeFirebaseAppCheck(), 5000);
  if (!instance) return null;

  try {
    const { getToken } = await import(
      "https://www.gstatic.com/firebasejs/12.10.0/firebase-app-check.js"
    );
    const result = await withTimeout(getToken(instance, forceRefresh), 7000);
    return result?.token || null;
  } catch (error) {
    console.error("[APP CHECK] Token unavailable:", error);
    return null;
  }
}

function isAdminApiRequest(input) {
  try {
    const url = new URL(
      typeof input === "string" ? input : input?.url,
      window.location.origin,
    );
    return (
      url.origin === window.location.origin &&
      url.pathname.startsWith("/api/admin/")
    );
  } catch (_error) {
    return false;
  }
}

function installAppCheckFetchInterceptor() {
  if (window.__appCheckFetchInterceptorInstalled) return;
  window.__appCheckFetchInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    if (!isAdminApiRequest(input)) {
      return originalFetch(input, init);
    }

    // Attestation must never leave an admin request hanging forever. If it
    // cannot be obtained, let the backend return its normal App Check error.
    const token = await getFirebaseAppCheckToken(false);
    const headers = new Headers(
      init.headers || (input instanceof Request ? input.headers : undefined),
    );

    if (token) {
      headers.set("X-Firebase-AppCheck", token);
    }

    return originalFetch(input, {
      ...init,
      headers,
    });
  };

  console.log("[APP CHECK] Admin API fetch interceptor installed");
}

window.getFirebaseAppCheckToken = getFirebaseAppCheckToken;
window.initializeFirebaseAppCheck = initializeFirebaseAppCheck;

installAppCheckFetchInterceptor();
initializeFirebaseAppCheck();
