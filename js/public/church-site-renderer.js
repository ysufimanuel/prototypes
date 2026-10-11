const esc = (v = "") => String(v).replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

export function normalizeSlug(value = "/") {
  const slug = String(value || "/").trim();
  return !slug || slug === "/" ? "/" : `/${slug.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch { return null; }
}

function youtubeEmbed(url) {
  const parsed = safeUrl(url); if (!parsed) return "";
  let id = parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v") || "";
  if (!id && parsed.pathname.startsWith("/embed/")) id = parsed.pathname.split("/")[2] || "";
  if (!id && parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.split("/")[2] || "";
  return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : "";
}

function vimeoEmbed(url) {
  const parsed = safeUrl(url); if (!parsed || !parsed.hostname.endsWith("vimeo.com")) return "";
  const match = parsed.pathname.match(/\/(\d+)/); return match ? `https://player.vimeo.com/video/${match[1]}` : "";
}

function mediaHtml(media = {}) {
  const type = media.type || "image", title = media.title || "Media", parsed = safeUrl(media.url);
  if (!parsed) return "";
  const radius = Math.min(60, Math.max(0, Number(media.radius) || 16));
  const style = `border-radius:${radius}px`;
  if (type === "image") return `<figure class="site-media" style="${style}"><img src="${esc(parsed.href)}" alt="${esc(title)}" loading="lazy"><figcaption>${esc(title)}</figcaption></figure>`;
  if (type === "youtube") { const src = youtubeEmbed(parsed.href); return src ? `<figure class="site-media" style="${style}"><div class="site-media-frame" style="${style}"><iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><figcaption>${esc(title)}</figcaption></figure>` : ""; }
  if (type === "vimeo") { const src = vimeoEmbed(parsed.href); return src ? `<figure class="site-media" style="${style}"><div class="site-media-frame" style="${style}"><iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div><figcaption>${esc(title)}</figcaption></figure>` : ""; }
  if (type === "video") return `<figure class="site-media" style="${style}"><video controls preload="metadata" src="${esc(parsed.href)}"></video><figcaption>${esc(title)}</figcaption></figure>`;
  return `<figure class="site-media" style="${style}"><a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></figure>`;
}

function mediaList(section) {
  const c = section.config || {};
  if (Array.isArray(c.media)) return c.media;
  if (c.media && typeof c.media === "object") return [c.media];
  return [];
}

function renderMediaLayout(section, contentHtml) {
  const media = mediaList(section).filter(m => m?.url);
  if (!media.length) return contentHtml;
  const first = media[0], position = first.position || "bottom", mode = first.mode || "inline";
  if (mode === "background" || position === "background") {
    const parsed = safeUrl(first.url);
    if (!parsed) return contentHtml;
    const radius = Math.min(60, Math.max(0, Number(first.radius) || 0));
    const overlay = Math.min(95, Math.max(0, Number(first.overlay) || 45));
    const bg = first.type === "image" ? `background-image:linear-gradient(rgba(0,0,0,${overlay / 100}),rgba(0,0,0,${overlay / 100})),url("${esc(parsed.href)}")` : "";
    if (bg) return `<div class="section-media-bg" style="${bg};border-radius:${radius}px"><div class="section-media-bg-content">${contentHtml}</div></div>`;
    return `<div class="section-media-bg section-media-bg-video"><div class="section-media-bg-content">${contentHtml}</div>${mediaHtml(first)}</div>`;
  }
  const all = media.map(mediaHtml).join("");
  if (position === "left" || position === "right") return `<div class="section-media-layout side-${position}"><div class="section-media-column">${all}</div><div class="section-content-column">${contentHtml}</div></div>`;
  return `<div class="section-media-layout stacked-${position}">${position === "top" ? all + contentHtml : contentHtml + all}</div>`;
}

function formatDate(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }
function formatTime(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
function eventsFor(payload, type, limit) { return (payload.events || []).filter(e => type === "service" ? String(e.tipe || "").toLowerCase() === "ibadah" : String(e.tipe || "").toLowerCase() !== "ibadah").filter(e => e.status !== "completed").sort((a,b) => new Date(a.start) - new Date(b.start)).slice(0, Math.max(1, Number(limit) || (type === "service" ? 4 : 3))); }

function resourceHtml(resource) {
  const parsed = safeUrl(resource?.url), type = resource?.type || "link", title = resource?.title || "Resource";
  if (!parsed) return "";
  if (type === "google_maps") return `<article class="public-card"><h3>${esc(title)}</h3><div class="map-preview"><iframe src="https://maps.google.com/maps?q=${encodeURIComponent(parsed.href)}&output=embed" loading="lazy" title="${esc(title)}"></iframe></div><p><a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">Buka Google Maps</a></p></article>`;
  if (type === "image") return `<article class="public-card"><h3>${esc(title)}</h3><img class="resource-image" src="${esc(parsed.href)}" alt="${esc(title)}" loading="lazy"></article>`;
  if (type === "youtube") { const src = youtubeEmbed(parsed.href); return src ? `<article class="public-card"><h3>${esc(title)}</h3><div class="resource-embed"><iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allowfullscreen></iframe></div></article>` : ""; }
  if (type === "vimeo") { const src = vimeoEmbed(parsed.href); return src ? `<article class="public-card"><h3>${esc(title)}</h3><div class="resource-embed"><iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allowfullscreen></iframe></div></article>` : ""; }
  if (type === "pdf") return `<article class="public-card"><h3>${esc(title)}</h3><div class="resource-embed"><iframe src="${esc(parsed.href)}" title="${esc(title)}" loading="lazy"></iframe></div><p><a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">Buka PDF</a></p></article>`;
  if (type === "spotify" && parsed.hostname.endsWith("spotify.com")) return `<article class="public-card"><h3>${esc(title)}</h3><div class="resource-embed resource-spotify"><iframe src="https://open.spotify.com/embed/${esc(parsed.pathname.replace(/^\//, ""))}" title="${esc(title)}" loading="lazy"></iframe></div></article>`;
  return `<article class="public-card"><h3>${esc(title)}</h3><p><a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></p></article>`;
}

export function renderSite({ root, config = {}, navigation = { items: [] }, page = {}, events = [], ministries = [], slug = "", preview = false }) {
  const pageTitle = page.title || config.siteName || "Website Gereja";
  const visibleNav = (navigation.items || []).filter(item => item.visible !== false);
  const publicUrl = target => { const route = normalizeSlug(target); return route === "/" ? `/church/${encodeURIComponent(slug)}` : `/church/${encodeURIComponent(slug)}${route}`; };
  const sections = (page.sections || []).filter(s => s.enabled !== false).sort((a,b) => (a.order || 0) - (b.order || 0));
  const eventList = events.filter(e => e.status !== "completed").sort((a,b) => new Date(a.start) - new Date(b.start));
  const sectionHtml = sections.map(section => {
    const c = section.config || {};
    let content = "";
    if (section.type === "hero") content = `<div class="container"><span class="eyebrow">${esc(config.siteName)}</span><h1>${esc(c.title || config.tagline || "Selamat datang")}</h1><p>${esc(c.description || "")}</p></div>`;
    else if (section.type === "welcome" || section.type === "about" || section.type === "cta") content = `<div class="container"><span class="eyebrow">${esc(section.type === "about" ? "ABOUT" : section.type === "cta" ? "CONNECT" : "WELCOME")}</span><h2>${esc(c.title || (section.type === "about" ? "Tentang Kami" : section.type === "cta" ? "Mari Terhubung" : "Selamat Datang"))}</h2><p>${esc(c.description || "")}</p></div>`;
    else if (section.type === "serviceSchedule" || section.type === "featuredEvents") { const type = section.type === "serviceSchedule" ? "service" : "event"; const list = eventsFor({events:eventList}, type, c.limit || (type === "service" ? 4 : 3)); const cards = list.map(e => `<article class="event-card"><div class="event-card-date"><strong>${esc(formatDate(e.start))}</strong><span>${esc(formatTime(e.start))}</span></div><div class="event-card-body"><h3>${esc(e.nama || (type === "service" ? "Ibadah" : "Event Gereja"))}</h3><p>${esc(e.deskripsi || e.tipe || "")}</p><span>${esc(e.lokasi || "Lokasi akan diumumkan")}</span></div></article>`).join(""); content = `<div class="container"><span class="eyebrow">${type === "service" ? "IBADAH" : "EVENT"}</span><h2>${esc(c.title || (type === "service" ? "Jadwal Ibadah" : "Event Terdekat"))}</h2><p>${esc(c.description || "")}</p><div class="events-grid">${cards || "<p>Belum ada data.</p>"}</div></div>`; }
    else if (section.type === "ministries") { const list = (ministries || []).slice(0, Number(c.limit) || 6); content = `<div class="container"><span class="eyebrow">MINISTRIES</span><h2>${esc(c.title || "Pelayanan")}</h2><p>${esc(c.description || "")}</p><div class="ministries-grid">${list.map(m => `<article class="ministry-card"><h3>${esc(m.name || "Pelayanan")}</h3><p>${esc(m.description || "")}</p>${m.leader?.name ? `<p><strong>Pemimpin:</strong> ${esc(m.leader.name)}</p>` : ""}${m.schedule ? `<p><strong>Jadwal:</strong> ${esc(m.schedule)}</p>` : ""}</article>`).join("") || "<p>Belum ada pelayanan.</p>"}</div></div>`; }
    else if (section.type === "resources" || section.type === "sermons") { const resources = Array.isArray(c.resources) ? c.resources : []; content = `<div class="container"><span class="eyebrow">RESOURCES</span><h2>${esc(c.title || "Resources")}</h2><p>${esc(c.description || "")}</p><div class="events-grid">${resources.map(resourceHtml).join("") || "<p>Belum ada resource.</p>"}</div></div>`; }
    else if (section.type === "contact") { const maps = String(config.contact?.mapsUrl || "").trim(); const mapHtml = maps ? `<div class="map-preview"><iframe src="https://maps.google.com/maps?q=${encodeURIComponent(maps)}&output=embed" loading="lazy" title="Lokasi gereja"></iframe></div><p><a href="${esc(maps)}" target="_blank" rel="noopener noreferrer">📍 Buka Google Maps</a></p>` : ""; content = `<div class="container"><span class="eyebrow">CONTACT</span><h2>${esc(c.title || "Hubungi Kami")}</h2><p>${esc(config.contact?.address || "")}</p><p>${esc(config.contact?.phone || "")}</p><p>${esc(config.contact?.email || "")}</p>${mapHtml}</div>`; }
    else return "";
    const mediaWrapped = renderMediaLayout(section, content);
    const cls = section.type === "hero" ? "hero" : `section ${section.type === "cta" || section.type === "ministries" || section.type === "serviceSchedule" ? "alt" : ""}`;
    return `<section class="${cls}">${mediaWrapped}</section>`;
  }).join("");

  const mode = localStorage.getItem("church-theme-mode") || "light";
  document.documentElement.dataset.theme = mode;
  document.title = `${preview ? "Preview - " : ""}${pageTitle}`;
  document.documentElement.style.setProperty("--primary", config.theme?.primary || "#ff6b00");
  document.documentElement.style.setProperty("--secondary", config.theme?.secondary || "#1f2937");
  document.documentElement.style.setProperty("--accent", config.theme?.accent || "#f59e0b");
  root.innerHTML = `<header class="site-header"><div class="container nav-wrap"><a class="brand" href="${publicUrl("/")}"><img class="brand-logo ${config.logoUrl ? "" : "hidden"}" src="${esc(config.logoUrl || "")}" alt=""><span>${esc(config.siteName || "Gereja")}</span></a><nav>${visibleNav.map(item => `<a href="${esc(publicUrl(item.target || "/"))}">${esc(item.label)}</a>`).join("')}</nav><button class="theme-toggle" type="button" aria-label="Ganti mode gelap" title="Mode gelap"><i class="fas fa-moon"></i></button></div></header><main><div class="container"><div class="page-heading"><span class="eyebrow">${esc(config.siteName || "GEREJA")}</span><h1>${esc(pageTitle)}</h1></div></div>${sectionHtml}</main><footer class="site-footer"><div class="container"><strong>${esc(config.siteName || "Gereja")}</strong><span>${esc(config.tagline || "")}</span></div></footer>`;
  const toggle = root.querySelector(".theme-toggle");
  toggle?.addEventListener("click", () => { const next = (document.documentElement.dataset.theme || "light") === "dark" ? "light" : "dark"; localStorage.setItem("church-theme-mode", next); document.documentElement.dataset.theme = next; toggle.innerHTML = next === "dark" ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; });
}
