import { renderSite } from "../public/church-site-renderer.js";

const root = document.getElementById("church-site");
const empty = document.getElementById("preview-empty");

function ensurePreviewMapStyle() {
  if (document.getElementById("cms-preview-map-style")) return;
  const style = document.createElement("style");
  style.id = "cms-preview-map-style";
  style.textContent = `
    .map-preview { aspect-ratio: 1 / 1 !important; }
    .map-preview iframe { width: 100%; height: 100%; display: block; border: 0; }
  `;
  document.head.appendChild(style);
}

function render(payload) {
  ensurePreviewMapStyle();
  renderSite({
    root,
    config: payload.config || {},
    navigation: payload.navigation || { items: [] },
    page: payload.page || {},
    events: payload.events || [],
    ministries: payload.ministries || [],
    slug: payload.slug || "",
    preview: true,
  });

  const toggle = root?.querySelector(".theme-toggle");
  if (toggle) {
    toggle.textContent =
      document.documentElement.dataset.theme === "dark" ? "☀" : "☾";
    toggle.addEventListener("click", () =>
      setTimeout(() => {
        toggle.textContent =
          document.documentElement.dataset.theme === "dark" ? "☀" : "☾";
      }, 0),
    );
  }

  empty?.classList.add("hidden");
  root?.classList.remove("hidden");
}

window.addEventListener("message", (event) => {
  if (
    event.origin !== window.location.origin ||
    event.data?.type !== "CMS_WEBSITE_PREVIEW"
  )
    return;

  render(event.data);
  event.source?.postMessage(
    { type: "CMS_WEBSITE_PREVIEW_READY" },
    event.origin,
  );
});

ensurePreviewMapStyle();
window.parent?.postMessage(
  { type: "CMS_WEBSITE_PREVIEW_READY" },
  window.location.origin,
);
