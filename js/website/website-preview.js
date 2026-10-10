const $ = (id) => document.getElementById(id);
let lastPayload = null;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}
function normalizeSlug(value = '/') {
  const slug = String(value || '/').trim();
  return !slug || slug === '/' ? '/' : `/${slug.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}
function formatDate(value) {
  const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}
function formatTime(value) {
  const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}
function eventsFor(payload, type, limit) {
  return (payload.events || []).filter(e => type === 'service' ? String(e.tipe || '').toLowerCase() === 'ibadah' : true).filter(e => e.status !== 'completed').sort((a,b) => new Date(a.start) - new Date(b.start)).slice(0, Math.max(1, Number(limit) || (type === 'service' ? 4 : 3)));
}
function sectionHtml(section, config, payload) {
  if (!section || section.enabled === false) return '';
  const c = section.config || {};
  switch (section.type) {
    case 'hero': return `<section class="hero"><div class="container"><span class="eyebrow">${escapeHtml(config.siteName)}</span><h1>${escapeHtml(c.title || config.tagline || 'Selamat datang')}</h1><p>${escapeHtml(c.description || '')}</p></div></section>`;
    case 'welcome': return `<section class="section"><div class="container"><span class="eyebrow">WELCOME</span><h2>${escapeHtml(c.title || 'Selamat Datang')}</h2><p>${escapeHtml(c.description || 'Kami senang menyambut Anda di website gereja kami.')}</p></div></section>`;
    case 'about': return `<section class="section"><div class="container"><span class="eyebrow">ABOUT</span><h2>${escapeHtml(c.title || 'Tentang Kami')}</h2><p>${escapeHtml(c.description || 'Kenali lebih dekat gereja dan komunitas kami.')}</p></div></section>`;
    case 'cta': return `<section class="section alt"><div class="container"><span class="eyebrow">CONNECT</span><h2>${escapeHtml(c.title || 'Mari Terhubung')}</h2><p>${escapeHtml(c.description || 'Kami ingin membantu Anda menemukan tempat untuk bertumbuh dan terhubung.')}</p></div></section>`;
    case 'sermons': return `<section class="section"><div class="container"><span class="eyebrow">RESOURCES</span><h2>${escapeHtml(c.title || 'Resources')}</h2><p>${escapeHtml(c.description || 'Materi dan khotbah akan tersedia di sini.')}</p></div></section>`;
    case 'serviceSchedule': {
      const cards = eventsFor(payload,'service',c.limit || 4).map(e => `<article class="service-card"><div class="service-card-date"><strong>${escapeHtml(formatDate(e.start))}</strong><span>${escapeHtml(formatTime(e.start))}</span></div><div><h3>${escapeHtml(e.nama || 'Ibadah')}</h3><p>${escapeHtml(e.lokasi || 'Lokasi akan diumumkan')}</p></div></article>`).join('');
      return `<section class="section alt"><div class="container"><span class="eyebrow">IBADAH</span><h2>${escapeHtml(c.title || 'Jadwal Ibadah')}</h2><div class="services-grid">${cards || '<p>Belum ada jadwal ibadah yang tersedia.</p>'}</div></div></section>`;
    }
    case 'featuredEvents': {
      const cards = eventsFor(payload,'event',c.limit || 3).map(e => `<article class="event-card"><div class="event-card-date"><strong>${escapeHtml(formatDate(e.start))}</strong><span>${escapeHtml(formatTime(e.start))}</span></div><div class="event-card-body"><h3>${escapeHtml(e.nama || 'Event Gereja')}</h3><p>${escapeHtml(e.deskripsi || e.tipe || '')}</p><span>${escapeHtml(e.lokasi || 'Lokasi akan diumumkan')}</span></div></article>`).join('');
      return `<section class="section"><div class="container"><span class="eyebrow">EVENT</span><h2>${escapeHtml(c.title || 'Event Terdekat')}</h2><div class="events-grid">${cards || '<p>Belum ada event yang tersedia.</p>'}</div></div></section>`;
    }
    case 'ministries': {
      const cards = (payload.ministries || []).slice(0, Math.max(1,Number(c.limit)||6)).map(m => `<article class="ministry-card"><h3>${escapeHtml(m.name || 'Pelayanan')}</h3><p>${escapeHtml(m.description || '')}</p>${m.leader?.name ? `<p><strong>Pemimpin:</strong> ${escapeHtml(m.leader.name)}</p>` : ''}${m.schedule ? `<p><strong>Jadwal:</strong> ${escapeHtml(m.schedule)}</p>` : ''}</article>`).join('');
      return `<section class="section alt"><div class="container"><span class="eyebrow">MINISTRIES</span><h2>${escapeHtml(c.title || 'Pelayanan')}</h2><p>${escapeHtml(c.description || 'Temukan pelayanan yang dapat Anda ikuti.')}</p><div class="ministries-grid">${cards || '<p>Belum ada pelayanan yang tersedia.</p>'}</div></div></section>`;
    }
    case 'contact': return `<section class="section"><div class="container"><span class="eyebrow">CONTACT</span><h2>${escapeHtml(c.title || 'Hubungi Kami')}</h2><p>${escapeHtml(config.contact?.address || '')}</p><p>${escapeHtml(config.contact?.phone || '')}</p><p>${escapeHtml(config.contact?.email || '')}</p></div></section>`;
    default: return '';
  }
}
function render(payload) {
  lastPayload = payload;
  const config = payload.config || {};
  const page = payload.page || {title:'Home',slug:'/',sections:[]};
  const slug = payload.slug || '';
  const nav = (payload.navigation?.items || []).filter(item => item.visible !== false);
  const pageTitle = page.title || config.siteName || 'Website Gereja';
  document.title = `Preview - ${pageTitle}`;
  document.documentElement.style.setProperty('--primary', config.theme?.primary || '#ff6b00');
  document.documentElement.style.setProperty('--secondary', config.theme?.secondary || '#1f2937');
  document.documentElement.style.setProperty('--accent', config.theme?.accent || '#f59e0b');
  const publicUrl = target => { const route=normalizeSlug(target); return route==='/' ? `/church/${encodeURIComponent(slug)}` : `/church/${encodeURIComponent(slug)}${route}`; };
  const sections = (page.sections || []).filter(s => s.enabled !== false).sort((a,b)=>(a.order||0)-(b.order||0));
  $('church-site').innerHTML = `<header class="site-header"><div class="container nav-wrap"><a class="brand" href="#"><img class="brand-logo ${config.logoUrl ? '' : 'hidden'}" src="${escapeHtml(config.logoUrl || '')}" alt=""><span>${escapeHtml(config.siteName || 'Gereja')}</span></a><nav>${nav.map(item => `<a href="${escapeHtml(publicUrl(item.target || '/'))}">${escapeHtml(item.label)}</a>`).join('')}</nav></div></header><main><div class="container"><div class="page-heading"><span class="eyebrow">${escapeHtml(config.siteName || 'GEREJA')}</span><h1>${escapeHtml(pageTitle)}</h1></div></div>${sections.map(s => sectionHtml(s,config,payload)).join('')}</main><footer class="site-footer"><div class="container"><strong>${escapeHtml(config.siteName || 'Gereja')}</strong><span>${escapeHtml(config.tagline || '')}</span></div></footer>`;
  $('preview-empty').classList.add('hidden'); $('church-site').classList.remove('hidden');
}
window.addEventListener('message', event => { if (event.origin !== window.location.origin || !event.data || event.data.type !== 'CMS_WEBSITE_PREVIEW') return; render(event.data); event.source?.postMessage({type:'CMS_WEBSITE_PREVIEW_READY'},event.origin); });
window.parent?.postMessage({type:'CMS_WEBSITE_PREVIEW_READY'},window.location.origin);
