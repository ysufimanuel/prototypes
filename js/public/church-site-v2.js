import '../firebase.js';

const root = document.getElementById('church-site');
const loading = document.getElementById('site-loading');
const errorBox = document.getElementById('site-error');
const esc = (v = '') => String(v).replace(/[&<>\\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const parts = location.pathname.split('/').filter(Boolean);
const churchIndex = parts.indexOf('church');
const slug = churchIndex >= 0 ? decodeURIComponent(parts[churchIndex + 1] || '') : '';
const routeSlug = parts.length > churchIndex + 2 ? `/${parts.slice(churchIndex + 2).join('/')}` : '/';

function card(title, body) {
  return `<article class="public-card"><h3>${esc(title)}</h3>${body}</article>`;
}

async function waitForFirebase(timeoutMs = 10000) {
  const started = Date.now();
  while (!window.db) {
    if (Date.now() - started >= timeoutMs) throw new Error('FIREBASE_NOT_READY');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return window.db;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

function youtubeEmbed(url) {
  const parsed = safeUrl(url);
  if (!parsed) return null;
  let id = '';
  if (parsed.hostname === 'youtu.be') id = parsed.pathname.slice(1);
  if (parsed.hostname.endsWith('youtube.com')) {
    id = parsed.searchParams.get('v') || '';
    if (!id && parsed.pathname.startsWith('/embed/')) id = parsed.pathname.split('/')[2] || '';
    if (!id && parsed.pathname.startsWith('/shorts/')) id = parsed.pathname.split('/')[2] || '';
  }
  return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
}

function vimeoEmbed(url) {
  const parsed = safeUrl(url);
  if (!parsed || !parsed.hostname.endsWith('vimeo.com')) return null;
  const match = parsed.pathname.match(/\/(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : null;
}

function renderResource(resource) {
  const type = String(resource?.type || 'link');
  const title = String(resource?.title || 'Resource');
  const rawUrl = String(resource?.url || '').trim();
  const parsed = safeUrl(rawUrl);
  if (!parsed) return '';

  if (type === 'youtube') {
    const src = youtubeEmbed(rawUrl);
    if (!src) return card(title, `<p><a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">Buka resource</a></p>`);
    return card(title, `<div class="resource-embed"><iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`);
  }

  if (type === 'vimeo') {
    const src = vimeoEmbed(rawUrl);
    if (!src) return card(title, `<p><a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">Buka resource</a></p>`);
    return card(title, `<div class="resource-embed"><iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`);
  }

  if (type === 'spotify' && parsed.hostname.endsWith('spotify.com')) {
    const path = parsed.pathname.replace(/^\//, '');
    const src = `https://open.spotify.com/embed/${encodeURIComponent(path)}`;
    return card(title, `<div class="resource-embed resource-spotify"><iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe></div>`);
  }

  if (type === 'soundcloud' && parsed.hostname.endsWith('soundcloud.com')) {
    const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(parsed.href)}&color=%23ff6b00&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&visual=true`;
    return card(title, `<div class="resource-embed"><iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" allow="autoplay"></iframe></div>`);
  }

  if (type === 'image') {
    return card(title, `<p><img class="resource-image" src="${esc(parsed.href)}" alt="${esc(title)}" loading="lazy"></p>`);
  }

  if (type === 'pdf') {
    return card(title, `<div class="resource-embed"><iframe src="${esc(parsed.href)}" title="${esc(title)}" loading="lazy"></iframe></div><p><a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">Buka PDF</a></p>`);
  }

  if (type === 'google_maps') {
    return card(title, `<p><a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">📍 Buka lokasi di Google Maps</a></p>`);
  }

  return card(title, `<p><a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></p>`);
}

function publicUrl(target) {
  const value = String(target || '/').trim();
  if (!value || value === '/') return `/church/${encodeURIComponent(slug)}`;
  if (/^https?:\/\//i.test(value)) return value;
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `/church/${encodeURIComponent(slug)}${normalized}`;
}

async function main() {
  if (!slug) throw new Error('SITE_NOT_FOUND');
  const db = await waitForFirebase();
  const slugDoc = await window.firebaseGetDoc(window.firebaseDoc(db, 'siteSlugs', slug));
  if (!slugDoc.exists()) throw new Error('SITE_NOT_FOUND');
  const churchId = slugDoc.data().churchId;
  if (!churchId) throw new Error('SITE_INVALID');

  const [configDoc, navDoc, pagesSnap, eventsSnap, ministriesSnap] = await Promise.all([
    window.firebaseGetDoc(window.firebaseDoc(db, 'publicSites', churchId, 'config', 'site')),
    window.firebaseGetDoc(window.firebaseDoc(db, 'publicSites', churchId, 'navigation', 'main')),
    window.firebaseGetDocs(window.firebaseCollection(db, 'publicSites', churchId, 'pages')),
    window.firebaseGetDocs(window.firebaseCollection(db, 'publicSites', churchId, 'events')),
    window.firebaseGetDocs(window.firebaseCollection(db, 'publicSites', churchId, 'ministries'))
  ]);
  if (!configDoc.exists() || configDoc.data().enabled === false) throw new Error('SITE_UNPUBLISHED');

  const config = configDoc.data();
  const nav = navDoc.exists() ? navDoc.data().items || [] : [];
  const pages = pagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const page = pages.find(p => String(p.slug || '/') === routeSlug) || (routeSlug === '/' ? pages.find(p => String(p.slug || '/') === '/') : null);
  if (!page) throw new Error('PAGE_NOT_FOUND');
  const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ministries = ministriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  document.title = page.seo?.title || config.seo?.title || page.title || config.siteName || 'Website Gereja';
  document.querySelector('meta[name="description"]')?.setAttribute('content', page.seo?.description || config.seo?.description || config.tagline || 'Website gereja');
  document.documentElement.style.setProperty('--primary', config.theme?.primary || '#ff6b00');
  document.documentElement.style.setProperty('--secondary', config.theme?.secondary || '#1f2937');
  document.documentElement.style.setProperty('--accent', config.theme?.accent || '#f59e0b');

  const visibleNav = nav.filter(item => item.visible !== false);
  const sections = (page.sections || []).filter(s => s.enabled !== false).sort((a,b) => (a.order || 0) - (b.order || 0));
  const eventList = events.filter(e => e.status !== 'completed').sort((a,b) => new Date(a.start) - new Date(b.start)).slice(0, 6);
  const ministryList = ministries.slice(0, 6);

  const sectionsHtml = sections.map(section => {
    const c = section.config || {};
    if (section.type === 'hero') return `<section class="hero"><div class="container"><span class="eyebrow">${esc(config.siteName)}</span><h1>${esc(c.title || config.tagline || 'Selamat datang')}</h1><p>${esc(c.description || '')}</p></div></section>`;
    if (section.type === 'welcome') return `<section class="section"><div class="container"><span class="eyebrow">WELCOME</span><h2>${esc(c.title || 'Selamat Datang')}</h2><p>${esc(c.description || 'Kami senang menyambut Anda di website gereja kami.')}</p></div></section>`;
    if (section.type === 'featuredEvents') return `<section class="section"><div class="container"><span class="eyebrow">EVENT</span><h2>${esc(c.title || 'Event Terdekat')}</h2><div class="events-grid">${eventList.map(e => card(e.nama || 'Event Gereja', `<p>${esc(e.deskripsi || e.tipe || '')}</p><p>${esc(e.lokasi || 'Lokasi akan diumumkan')}</p>`)).join('') || '<p>Belum ada event.</p>'}</div></div></section>`;
    if (section.type === 'ministries') return `<section class="section alt"><div class="container"><span class="eyebrow">MINISTRIES</span><h2>${esc(c.title || 'Pelayanan')}</h2><p>${esc(c.description || 'Temukan pelayanan yang dapat Anda ikuti.')}</p><div class="ministries-grid">${ministryList.map(m => card(m.name || 'Pelayanan', `<p>${esc(m.description || '')}</p>${m.leader?.name ? `<p><strong>Pemimpin:</strong> ${esc(m.leader.name)}</p>` : ''}${m.schedule ? `<p><strong>Jadwal:</strong> ${esc(m.schedule)}</p>` : ''}`)).join('') || '<p>Belum ada pelayanan.</p>'}</div></div></section>`;
    if (section.type === 'resources' || section.type === 'sermons') {
      const resources = Array.isArray(c.resources) ? c.resources : [];
      return `<section class="section"><div class="container"><span class="eyebrow">RESOURCES</span><h2>${esc(c.title || 'Resources')}</h2><p>${esc(c.description || '')}</p><div class="events-grid">${resources.map(renderResource).join('') || '<p>Belum ada resource.</p>'}</div></div></section>`;
    }
    if (section.type === 'about') return `<section class="section"><div class="container"><span class="eyebrow">ABOUT</span><h2>${esc(c.title || 'Tentang Kami')}</h2><p>${esc(c.description || '')}</p></div></section>`;
    if (section.type === 'cta') return `<section class="section alt"><div class="container"><h2>${esc(c.title || 'Mari Terhubung')}</h2><p>${esc(c.description || '')}</p></div></section>`;
    if (section.type === 'contact') {
      const mapsUrl = String(config.contact?.mapsUrl || '').trim();
      const mapsHtml = mapsUrl ? `<p><a href="${esc(mapsUrl)}" target="_blank" rel="noopener noreferrer">📍 Lihat lokasi di Google Maps</a></p>` : '';
      return `<section class="section"><div class="container"><span class="eyebrow">CONTACT</span><h2>${esc(c.title || 'Hubungi Kami')}</h2><p>${esc(config.contact?.address || '')}</p><p>${esc(config.contact?.phone || '')}</p><p>${esc(config.contact?.email || '')}</p>${mapsHtml}</div></section>`;
    }
    if (section.type === 'serviceSchedule') return `<section class="section alt"><div class="container"><span class="eyebrow">IBADAH</span><h2>${esc(c.title || 'Jadwal Ibadah')}</h2><p>Jadwal ibadah akan ditampilkan di sini.</p></div></section>`;
    return '';
  }).join('');

  root.innerHTML = `<header class="site-header"><div class="container nav-wrap"><a class="brand" href="/church/${encodeURIComponent(slug)}"><img class="brand-logo ${config.logoUrl ? '' : 'hidden'}" src="${esc(config.logoUrl)}" alt=""><span>${esc(config.siteName || 'Gereja')}</span></a><nav>${visibleNav.map(item => `<a href="${esc(publicUrl(item.target))}">${esc(item.label)}</a>`).join('')}</nav></div></header><main>${sectionsHtml}</main><footer class="site-footer"><div class="container"><strong>${esc(config.siteName || 'Gereja')}</strong><span>${esc(config.tagline || '')}</span></div></footer>`;
  loading.classList.add('hidden');
  root.classList.remove('hidden');
}

main().catch(err => { console.error('[PUBLIC WEBSITE]', err); loading.classList.add('hidden'); errorBox.classList.remove('hidden'); });
