import { auth, db, logout as firebaseLogout } from '../firebase.js';
import { onAuthStateChanged, getIdToken } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const state = { user:null, profile:null, churchId:null, church:null, config:null, navigation:null, pages:[] };
const API_BASE = '/api/admin/website';

function show(id){ $(id)?.classList.remove('hidden'); }
function hide(id){ $(id)?.classList.add('hidden'); }
function setText(id,value){ const el=$(id); if(el) el.textContent=value ?? ''; }
function setValue(id,value){ const el=$(id); if(el) el.value=value ?? ''; }
function getValue(id){ return $(id)?.value?.trim() || ''; }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#92;','"':'&quot;'}[m])); }

async function api(path, options={}){
  if(!state.user) throw new Error('AUTH_REQUIRED');
  const token=await getIdToken(state.user,true);
  const response=await fetch(`${API_BASE}${path}`,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok || data.success===false) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}

function switchSection(section){
  document.querySelectorAll('.website-section').forEach(el=>el.classList.toggle('active',el.dataset.panel===section));
  document.querySelectorAll('.website-nav').forEach(el=>el.classList.toggle('active',el.dataset.section===section));
}

function renderPages(){
  const el=$('website-pages-list'); if(!el)return;
  el.innerHTML=state.pages.map(page=>`<div class="page-item"><div class="page-item-main"><span class="drag-handle"><i class="fas fa-grip-vertical"></i></span><div><strong>${escapeHtml(page.title)}</strong><small>${escapeHtml(page.slug)}</small></div></div><button class="website-btn secondary" type="button" data-page="${escapeHtml(page.id)}">Edit</button></div>`).join('');
}

function renderNavigation(){
  const el=$('website-navigation-list'); if(!el)return;
  const items=state.navigation?.items || [];
  el.innerHTML=items.map(item=>`<div class="navigation-item"><div class="navigation-item-main"><span class="drag-handle"><i class="fas fa-grip-vertical"></i></span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.target)}</small></div></div><label><input type="checkbox" ${item.visible!==false?'checked':''} data-nav="${escapeHtml(item.id)}"> Visible</label></div>`).join('');
}

function renderAppearance(){
  const c=state.config||{}, t=c.theme||{}, contact=c.contact||{};
  setValue('site-name',c.siteName); setValue('site-tagline',c.tagline); setValue('site-logo',c.logoUrl); setValue('site-favicon',c.faviconUrl);
  setValue('theme-primary',t.primary); setValue('theme-secondary',t.secondary); setValue('theme-accent',t.accent); setValue('theme-heading-font',t.headingFont);
  setValue('contact-email',contact.email); setValue('contact-phone',contact.phone); setValue('contact-address',contact.address); setValue('contact-maps',contact.mapsUrl);
}

function renderOverview(){
  const website=state.church?.website||{}, status=state.config?.status || website.status || 'draft', slug=website.slug;
  setText('overview-status',status==='published'?'Published':'Draft');
  setText('overview-published-at',state.config?.publishedAt?'Sudah dipublikasikan':'Belum pernah dipublikasikan');
  setText('website-church-name',state.church?.name || state.config?.siteName || 'Gereja Digital');
  if(slug){ const url=`/church/${encodeURIComponent(slug)}`; const link=$('website-public-link'); link.href=url; link.classList.remove('disabled'); setText('overview-url',url); const frame=$('website-preview-frame'); if(frame) frame.src=url; }
  else { setText('overview-url','Slug belum tersedia'); }
}

async function loadProfile(user){
  const snap=await getDoc(doc(db,'users',user.uid));
  if(!snap.exists()) throw new Error('Profil pengguna tidak ditemukan.');
  const profile=snap.data();
  if(!['admin','superadmin'].includes(profile.role)) throw new Error('ROLE_NOT_ALLOWED');
  if(!profile.churchId) throw new Error('Profil belum memiliki churchId.');
  state.user=user; state.profile=profile; state.churchId=profile.churchId;
}

async function loadDraft(){
  const result=await api('/draft');
  state.church=result.data.church||{}; state.config=result.data.config||{}; state.navigation=result.data.navigation||{items:[]}; state.pages=result.data.pages||[];
  renderOverview(); renderAppearance(); renderPages(); renderNavigation();
}

async function provision(){ await api('/provision',{method:'POST',body:'{}'}); await loadDraft(); }

async function saveDraft(){
  const navigation={items:(state.navigation?.items||[]).map(item=>({...item,visible:document.querySelector(`[data-nav="${CSS.escape(item.id)}"]`)?.checked!==false}))};
  const config={...state.config,siteName:getValue('site-name'),tagline:getValue('site-tagline'),logoUrl:getValue('site-logo'),faviconUrl:getValue('site-favicon'),theme:{...(state.config?.theme||{}),primary:getValue('theme-primary'),secondary:getValue('theme-secondary'),accent:getValue('theme-accent'),headingFont:getValue('theme-heading-font')||'Poppins'},contact:{email:getValue('contact-email'),phone:getValue('contact-phone'),address:getValue('contact-address'),mapsUrl:getValue('contact-maps')}};
  const result=await api('/draft',{method:'PUT',body:JSON.stringify({config,navigation,pages:state.pages})});
  state.config={...state.config,...config}; state.navigation=navigation;
  renderOverview(); return result;
}

async function publish(){
  await saveDraft();
  const result=await api('/publish',{method:'POST',body:'{}'});
  const eventsResult=await api('/publish-events',{method:'POST',body:'{}'});
  await loadDraft();
  return {...result,eventCount:eventsResult.eventCount};
}

function bindUI(){
  document.querySelectorAll('.website-nav').forEach(btn=>btn.addEventListener('click',()=>switchSection(btn.dataset.section)));
  document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>switchSection(btn.dataset.go)));
  $('website-logout')?.addEventListener('click',async()=>{await firebaseLogout();});
  $('appearance-form')?.addEventListener('submit',async(e)=>{e.preventDefault();try{await saveDraft();alert('Draft website berhasil disimpan.');}catch(err){console.error(err);alert(err.message||'Gagal menyimpan draft.');}});
  $('website-publish-sidebar')?.addEventListener('click',async()=>{try{const result=await publish();alert(`${result.message||'Website berhasil dipublikasikan.'}${typeof result.eventCount==='number'?` Event publik: ${result.eventCount}.`:''}`);}catch(err){console.error(err);alert(err.message||'Gagal mempublikasikan website.');}});
  $('preview-open')?.addEventListener('click',()=>{const href=$('website-public-link')?.href;if(href && href!=='#')window.open(href,'_blank','noopener');else alert('Website publik belum memiliki slug.');});
}

onAuthStateChanged(auth,async(user)=>{
  try{
    if(!user){window.location.href='index.html';return;}
    await loadProfile(user);
    await provision();
    bindUI();
    hide('website-loading'); show('website-manager');
  }catch(err){
    console.error('[WEBSITE] access check failed:',err);
    hide('website-loading'); show('website-access-denied');
    if(err.message==='ROLE_NOT_ALLOWED') setText('website-access-denied','Akses Ditolak');
  }
});
