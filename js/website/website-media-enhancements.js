const $ = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>\"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

function safeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function yt(value) {
  const url = safeUrl(value);
  if (!url) return "";
  let id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || "";
  if (!id && url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2] || "";
  if (!id && url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2] || "";
  return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : "";
}

function vm(value) {
  const url = safeUrl(value);
  if (!url || !url.hostname.endsWith("vimeo.com")) return "";
  const match = url.pathname.match(/\/(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : "";
}

function mapPoint(value) {
  const raw = String(value || "");
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[/?]|$)/,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
  }
  return null;
}

function mapEmbed(value) {
  const url = safeUrl(value);
  if (!url) return "";
  const point = mapPoint(url.href);
  const query = point ? `${point.lat},${point.lng}` : url.href;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${point ? 16 : 14}&output=embed`;
}

function renderMapPreview(input) {
  const value = input?.value?.trim() || "";
  let box = input?.parentElement?.querySelector(".map-editor-preview");
  if (!box) {
    box = document.createElement("div");
    box.className = "map-editor-preview";
    input?.parentElement?.appendChild(box);
  }

  if (box.dataset.value === value) return;
  box.dataset.value = value;

  if (!value) {
    box.innerHTML = '<div class="media-preview-empty">Tempel link Google Maps untuk melihat titik lokasi.</div>';
    return;
  }

  const src = mapEmbed(value);
  if (!src) {
    box.innerHTML = '<div class="media-preview-empty">Link Google Maps tidak valid.</div>';
    return;
  }

  const point = mapPoint(value);
  const marker = point
    ? `<span class="map-editor-pin" title="${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}"><i class="fas fa-location-dot"></i></span><span class="map-editor-coords">${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}</span>`
    : "";
  box.innerHTML = `<div class="map-editor-canvas"><iframe src="${esc(src)}" title="Preview lokasi Google Maps" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>${marker}</div>`;
}

function mediaSignature(row) {
  return JSON.stringify({
    type: row.querySelector(".v2-media-type")?.value || "image",
    url: row.querySelector(".v2-media-url")?.value?.trim() || "",
    title: row.querySelector(".v2-media-title")?.value?.trim() || "Preview media",
    aspectRatio: row.querySelector(".v2-media-aspect")?.value || "16:9",
  });
}

function renderMedia(row) {
  const box = row.querySelector(".v2-media-preview");
  if (!box) return;

  const signature = mediaSignature(row);
  if (box.dataset.signature === signature) return;
  box.dataset.signature = signature;

  const type = row.querySelector(".v2-media-type")?.value || "image";
  const url = row.querySelector(".v2-media-url")?.value?.trim() || "";
  const title = row.querySelector(".v2-media-title")?.value?.trim() || "Preview media";
  const aspect = row.querySelector(".v2-media-aspect")?.value || "16:9";
  box.style.setProperty("--media-aspect", aspect.replace(":", "/"));

  if (!url) {
    box.innerHTML = '<div class="media-preview-empty">Masukkan URL media untuk melihat preview.</div>';
    return;
  }

  const safe = safeUrl(url);
  if (!safe) {
    box.innerHTML = '<div class="media-preview-empty">URL media tidak valid.</div>';
    return;
  }

  if (type === "image") {
    box.innerHTML = `<img src="${esc(safe.href)}" alt="${esc(title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\"media-preview-empty\">Gambar gagal dimuat dari URL ini.</div>'>`;
    return;
  }

  if (type === "video") {
    box.innerHTML = `<video controls preload="metadata" src="${esc(safe.href)}"></video>`;
    return;
  }

  if (type === "youtube") {
    const src = yt(safe.href);
    box.innerHTML = src ? `<iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allowfullscreen></iframe>` : '<div class="media-preview-empty">URL YouTube tidak valid.</div>';
    return;
  }

  if (type === "vimeo") {
    const src = vm(safe.href);
    box.innerHTML = src ? `<iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allowfullscreen></iframe>` : '<div class="media-preview-empty">URL Vimeo tidak valid.</div>';
    return;
  }

  box.innerHTML = `<div class="media-preview-empty"><a href="${esc(safe.href)}" target="_blank" rel="noopener noreferrer">Buka media</a></div>`;
}

function refreshMedia(root = document) {
  root.querySelectorAll?.(".v2-media-row").forEach(renderMedia);
}

function ensureMap() {
  const input = $("contact-maps");
  if (!input) return;
  renderMapPreview(input);
  if (input.dataset.mapEnhancement) return;
  input.dataset.mapEnhancement = "1";
  input.addEventListener("input", () => renderMapPreview(input));
  input.addEventListener("change", () => renderMapPreview(input));
}

function observe() {
  ensureMap();
  refreshMedia();

  let scheduled = false;
  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      ensureMap();
      refreshMedia();
    });
  };

  const observer = new MutationObserver(() => scheduleRefresh());
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("input", (event) => {
    if (event.target.matches?.(".v2-media-url,.v2-media-title,.v2-media-type,.v2-media-aspect")) renderMedia(event.target.closest(".v2-media-row"));
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches?.(".v2-media-url,.v2-media-type,.v2-media-aspect")) renderMedia(event.target.closest(".v2-media-row"));
  });

  window.addEventListener("cms:website-draft-updated", () => {
    window.setTimeout(() => {
      ensureMap();
      refreshMedia();
    }, 100);
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observe, { once: true });
else observe();
