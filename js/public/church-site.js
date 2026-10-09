import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDUMMY',
  authDomain: 'cms-v6.firebaseapp.com',
  projectId: 'cms-v6',
  storageBucket: 'cms-v6.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:000000000000'
};

// This file is intentionally isolated from the private CMS Firebase client.
// Replace the config above with the project's existing public Firebase config.
const app = initializeApp(firebaseConfig, 'public-site');
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const state = { slug: '', churchId: '', config: null, navigation: null, pages: [] };

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function slugFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const churchIndex = parts.indexOf('church');
  return churchIndex >= 0 ? decodeURIComponent(parts[churchIndex + 1] || '') : '';
}

async function loadSite() {
  state.slug = slugFromPath();
  if (!state.slug) throw new Error('SLUG_MISSING');

  const slugSnap = await getDoc(doc(db, 'siteSlugs', state.slug));
  if (!slugSnap.exists()) throw new Error('SITE_NOT_FOUND');
  state.churchId = slugSnap.data().churchId;
  if (!state.churchId) throw new Error('SITE_INVALID');

  const base = `publicSites/${state.churchId}`;
  const [configSnap, navSnap, pagesSnap] = await Promise.all([
    getDoc(doc(db, base, 'config/site')),
    getDoc(doc(db, base, 'navigation/main')),
    getDoc(doc(db, base, 'pages/home'))
  ]);

  if (!configSnap.exists() || configSnap.data().enabled === false) throw new Error('SITE_UNPUBLISHED');
  state.config = configSnap.data();
  state.navigation = navSnap.exists() ? navSnap.data() : { items: [] };
  state.pages = pagesSnap.exists() ? [pagesSnap.data()] : [];
}

function sectionHtml(section, config) {
  if (!section?.enabled) return '';
  const c = section.config || {};
  switch (section.type) {
    case 'hero':
      return `<section class="hero"><div class="container"><span class="eyebrow">${escapeHtml(config.siteName)}</span><h1>${escapeHtml(c.title || config.tagline || 'Selamat datang')}</h1><p>${escapeHtml(c.description || '')}</p></div></section>`;
    case 'welcome':
      return `<section class="section"><div class="container"><span class="eyebrow">WELCOME</span><h2>${escapeHtml(c.title || 'Selamat Datang')}</h2><p>${escapeHtml(c.description || 'Kami senang menyambut Anda di website gereja kami.')}</p></div></section>`;
    case 'serviceSchedule':
      return `<section class="section alt"><div class="container"><span class="eyebrow">IBADAH</span><h2>${escapeHtml(c.title || 'Jadwal Ibadah')}</h2><div class="placeholder-grid"><article><strong>Minggu</strong><span>Jadwal ibadah akan ditampilkan di sini.</span></article></div></div></section>`;
    case 'featuredEvents':
      return `<section class="section"><div class="container"><span class="eyebrow">EVENT</span><h2>${escapeHtml(c.title || 'Event Terdekat')}</h2><div class="placeholder-grid"><article><strong>Event Gereja</strong><span>Data event publik akan terhubung pada tahap berikutnya.</span></article></div></div></section>`;
    case 'ministries':
      return `<section class="section alt"><div class="container"><span class="eyebrow">MINISTRIES</span><h2>${escapeHtml(c.title || 'Pelayanan')}</h2><p>${escapeHtml(c.description || 'Temukan pelayanan yang dapat Anda ikuti.')}</p></div></section>`;
    case 'contact':
      return `<section class="section"><div class="container"><span class="eyebrow">CONTACT</span><h2>${escapeHtml(c.title || 'Hubungi Kami')}</h2><p>${escapeHtml(config.contact?.address || '')}</p><p>${escapeHtml(config.contact?.phone || '')}</p><p>${escapeHtml(config.contact?.email || '')}</p></div></section>`;
    default:
      return '';
  }
}

function render() {
  const config = state.config;
  document.title = config.seo?.title || config.siteName || 'Website Gereja';
  document.querySelector('meta[name="description"]')?.setAttribute('content', config.seo?.description || config.tagline || 'Website gereja');
  document.documentElement.style.setProperty('--primary', config.theme?.primary || '#ff6b00');
  document.documentElement.style.setProperty('--secondary', config.theme?.secondary || '#1f2937');
  document.documentElement.style.setProperty('--accent', config.theme?.accent || '#f59e0b');

  const nav = (state.navigation.items || []).filter(item => item.visible !== false);
  const page = state.pages.find(item => item.slug === '/') || state.pages[0];
  const sections = (page?.sections || []).filter(s => s.enabled !== false).sort((a,b) => (a.order || 0) - (b.order || 0));

  $('church-site').innerHTML = `
    <header class="site-header"><div class="container nav-wrap">
      <a class="brand" href="/church/${encodeURIComponent(state.slug)}"><img class="brand-logo ${config.logoUrl ? '' : 'hidden'}" src="${escapeHtml(config.logoUrl)}" alt=""><span>${escapeHtml(config.siteName)}</span></a>
      <nav>${nav.map(item => `<a href="${escapeHtml(item.target || '#')}">${escapeHtml(item.label)}</a>`).join('')}</nav>
    </div></header>
    <main>${sections.map(section => sectionHtml(section, config)).join('')}</main>
    <footer class="site-footer"><div class="container"><strong>${escapeHtml(config.siteName)}</strong><span>${escapeHtml(config.tagline)}</span></div></footer>`;

  $('site-loading').classList.add('hidden');
  $('church-site').classList.remove('hidden');
}

function showError() {
  $('site-loading').classList.add('hidden');
  $('site-error').classList.remove('hidden');
}

loadSite().then(render).catch((error) => {
  console.error('[PUBLIC WEBSITE]', error);
  showError();
});
