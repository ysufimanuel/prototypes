const APP_CHECK_SITE_KEY = "6Lc6Y-gtAAAAAOIWYAW8j66GnhgFn3vbc-xGUjI8";
const FIREBASE_API_BASE_URL = "https://us-central1-churchmanagementsystem-a77a3.cloudfunctions.net";
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

function buildAdminApiUrl(input) {
  const url = new URL(
    typeof input === "string" ? input : input?.url,
    window.location.origin,
  );

  if (isLocalhost) return url.href;
  return `${FIREBASE_API_BASE_URL}${url.pathname}${url.search}`;
}

function installAppCheckFetchInterceptor() {
  if (window.__appCheckFetchInterceptorInstalled) return;
  window.__appCheckFetchInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    if (!isAdminApiRequest(input)) {
      return originalFetch(input, init);
    }

    const token = await getFirebaseAppCheckToken(false);
    const headers = new Headers(
      init.headers || (input instanceof Request ? input.headers : undefined),
    );

    if (token) {
      headers.set("X-Firebase-AppCheck", token);
    }

    const apiUrl = buildAdminApiUrl(input);
    const requestInput = input instanceof Request ? new Request(apiUrl, input) : apiUrl;

    console.log("[APP CHECK] Admin API request:", apiUrl);

    return originalFetch(requestInput, {
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
