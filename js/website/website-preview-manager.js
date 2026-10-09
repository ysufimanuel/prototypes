import { auth } from '../firebase.js';
import { onAuthStateChanged, getIdToken } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, getDocs, collection } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const db = getFirestore();
const frame = () => document.getElementById('website-preview-frame');
const refreshButton = () => document.getElementById('preview-refresh');
let tokenUser = null;
let latestDraft = null;
let initialized = false;
let sending = false;

async function loadDraft() {
  if (!tokenUser) return;
  const token = await getIdToken(tokenUser, true);
  const response = await fetch('/api/admin/website/draft', { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Gagal memuat draft preview.');
  latestDraft = data.data;
}

async function loadPublicContent() {
  const churchId = latestDraft?.church?.id;
  if (!churchId) return { events: [], ministries: [] };
  const base = `publicSites/${churchId}`;
  const [eventsSnap, ministriesSnap] = await Promise.all([
    getDocs(collection(db, base, 'events')),
    getDocs(collection(db, base, 'ministries'))
  ]);
  return {
    events: eventsSnap.docs.map(s => ({ id: s.id, ...s.data() })),
    ministries: ministriesSnap.docs.map(s => ({ id: s.id, ...s.data() }))
  };
}

async function sendPreview() {
  if (sending || !latestDraft || !frame()?.contentWindow) return;
  sending = true;
  try {
    const pages = latestDraft.pages || [];
    const page = pages.find(p => p.id === 'home') || pages.find(p => p.slug === '/') || pages[0];
    if (!page) return;
    const publicContent = await loadPublicContent();
    frame().contentWindow.postMessage({
      type: 'CMS_WEBSITE_PREVIEW',
      churchId: latestDraft.church?.id || '',
      slug: latestDraft.church?.website?.slug || '',
      config: latestDraft.config || {},
      navigation: latestDraft.navigation || { items: [] },
      page,
      ...publicContent
    }, window.location.origin);
  } finally {
    sending = false;
  }
}

async function refreshPreview() {
  if (!tokenUser) return;
  const button = refreshButton();
  if (button) button.disabled = true;
  try {
    await loadDraft();
    await sendPreview();
  } catch (error) {
    console.error('[WEBSITE PREVIEW]', error);
  } finally {
    if (button) button.disabled = false;
  }
}

async function init() {
  if (initialized) return;
  const iframe = frame();
  if (!iframe) return;
  initialized = true;
  iframe.addEventListener('load', () => { sendPreview().catch(console.error); });
  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.data?.type !== 'CMS_WEBSITE_PREVIEW_READY') return;
    sendPreview().catch(console.error);
  });
  refreshButton()?.addEventListener('click', refreshPreview);
  window.addEventListener('cms:website-draft-updated', () => refreshPreview());
  try {
    await loadDraft();
    iframe.src = '/website-preview.html';
  } catch (error) {
    console.error('[WEBSITE PREVIEW]', error);
  }
}

onAuthStateChanged(auth, user => {
  tokenUser = user;
  if (user) init();
});
