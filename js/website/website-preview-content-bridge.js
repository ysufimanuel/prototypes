import "../firebase.js";

let loading = false;
let loadedFor = null;

async function hydrate(draft) {
  if (!draft || !Array.isArray(draft.pages) || loading) return;
  const key = `${draft.church?.id || ""}:${draft.church?.website?.updatedAt || ""}`;
  if (loadedFor === key && draft.content?.events && draft.content?.ministries) return;
  loading = true;
  try {
    const user = window.auth?.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch("/api/admin/website/content", { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) throw new Error(result.message || `HTTP ${response.status}`);
    draft.content = result.data || { events: [], ministries: [] };
    window.__cmsWebsiteDraft = draft;
    loadedFor = key;
    window.dispatchEvent(new CustomEvent("cms:website-draft-updated", { detail: { draft, __contentHydrated: true } }));
  } catch (error) {
    console.error("[WEBSITE PREVIEW CONTENT]", error);
  } finally {
    loading = false;
  }
}

window.addEventListener("cms:website-draft-updated", (event) => {
  if (event.detail?.__contentHydrated) return;
  hydrate(event.detail?.draft || window.__cmsWebsiteDraft);
});

const timer = window.setInterval(() => {
  const draft = window.__cmsWebsiteDraft;
  if (draft && !draft.content?.events && !draft.content?.ministries) hydrate(draft);
  else if (draft && !draft.content?.events) hydrate(draft);
}, 500);
window.addEventListener("beforeunload", () => window.clearInterval(timer));
