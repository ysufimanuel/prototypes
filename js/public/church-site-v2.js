import { renderSite } from "./church-site-renderer.js";

const root = document.getElementById("church-site");
const loading = document.getElementById("site-loading");
const errorBox = document.getElementById("site-error");
const parts = location.pathname.split("/").filter(Boolean);
const idx = parts.indexOf("church");
const slug = idx >= 0 ? decodeURIComponent(parts[idx + 1] || "") : "";
const route = parts.length > idx + 2 ? `/${parts.slice(idx + 2).join("/")}` : "/";

async function main() {
  if (!slug) throw new Error("SITE_NOT_FOUND");
  const response = await fetch(`/api/public/church-site?slug=${encodeURIComponent(slug)}&route=${encodeURIComponent(route)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) throw new Error(result.message || `HTTP ${response.status}`);
  const data = result.data || {};
  renderSite({
    root,
    config: data.config || {},
    navigation: data.navigation || { items: [] },
    page: data.page || {},
    events: data.events || [],
    ministries: data.ministries || [],
    slug: data.slug || slug,
  });
  loading?.classList.add("hidden");
  root?.classList.remove("hidden");
}

main().catch((err) => {
  console.error("[PUBLIC WEBSITE] Error:", err);
  loading?.classList.add("hidden");
  errorBox?.classList.remove("hidden");
});
