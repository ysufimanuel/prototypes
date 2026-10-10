import '../firebase.js';

const root = document.getElementById('church-site');
const loading = document.getElementById('site-loading');
const errorBox = document.getElementById('site-error');
const esc = (v = '') => String(v).replace(/[&<>\\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const parts = location.pathname.split('/').filter(Boolean);
const churchIndex = parts.indexOf('church');
const slug = churchIndex >= 0 ? decodeURIComponent(parts[churchIndex + 1] || '') : '';

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

async function main() {
  if (!slug) throw new Error('SITE_NOT_FOUND');
  const db = await waitForFirebase();
  const slugDoc = await window.firebaseGetDoc(window.firebaseDoc(db, 'siteSlugs', slug));
  if (!slugDoc.exists()) throw new Error('SITE_NOT_FOUND');
  const churchId = slugDoc.data().churchId;
  if (!churchId) throw new Error('SITE_INVALID');

  const [configDoc, navDoc, pageDoc, eventsSnap, ministriesSnap] = await Promise.all([
    window.firebaseGetDoc(window.firebaseDoc(db, 'publicSites', churchId, 'config', 'site')),
    window.firebaseGetDoc(window.firebaseDoc(db, 'publicSites', churchId, 'navigation', 'main')),
    window.firebaseGetDoc(window.firebaseDoc(db, 'publicSites', churchId, 'pages', 'home')),
    window.firebaseGetDocs(window.firebaseCollection(db, 'publicSites', churchId, 'events')),
    window.firebaseGetDocs(window.firebaseCollection(db, 'publicSites', churchId, 'ministries'))
  ]);
  if (!configDoc.exists() || configDoc.data().enabled === false) throw new Error('SITE_UNPUBLISHED');

  const config = configDoc.data();
  const nav = navDoc.exists() ? navDoc.data().items || [] : [];
  const page = pageDoc.exists() ? pageDoc.data() : { sections: [] };
  const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ministries = ministriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  document.title = config.seo?.title || config.siteName || 'Website Gereja';
  document.querySelector('meta[name="description"]')?.setAttribute('content', config.seo?.description || config.tagline || 'Website gereja');
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
    if (section.type === 'contact') return `<section class="section"><div class="container"><span class="eyebrow">CONTACT</span><h2>${esc(c.title || 'Hubungi Kami')}</h2><p>${esc(config.contact?.address || '')}</p><p>${esc(config.contact?.phone || '')}</p><p>${esc(config.contact?.email || '')}</p></div></section>`;
    if (section.type === 'serviceSchedule') return `<section class="section alt"><div class="container"><span class="eyebrow">IBADAH</span><h2>${esc(c.title || 'Jadwal Ibadah')}</h2><p>Jadwal ibadah akan ditampilkan di sini.</p></div></section>`;
    return '';
  }).join('');

  root.innerHTML = `<header class="site-header"><div class="container nav-wrap"><a class="brand" href="/church/${encodeURIComponent(slug)}"><img class="brand-logo ${config.logoUrl ? '' : 'hidden'}" src="${esc(config.logoUrl)}" alt=""><span>${esc(config.siteName || 'Gereja')}</span></a><nav>${visibleNav.map(item => `<a href="${esc(item.target || '#')}">${esc(item.label)}</a>`).join('')}</nav></div></header><main>${sectionsHtml}</main><footer class="site-footer"><div class="container"><strong>${esc(config.siteName || 'Gereja')}</strong><span>${esc(config.tagline || '')}</span></div></footer>`;
  loading.classList.add('hidden');
  root.classList.remove('hidden');
}

main().catch(err => { console.error('[PUBLIC WEBSITE]', err); loading.classList.add('hidden'); errorBox.classList.remove('hidden'); });
