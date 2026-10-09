import { auth, db, getActiveChurchId, logout as firebaseLogout } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const state = { user:null, profile:null, churchId:null };

function show(id){ $(id)?.classList.remove('hidden'); }
function hide(id){ $(id)?.classList.add('hidden'); }
function setText(id,value){ const el=$(id); if(el) el.textContent=value ?? ''; }
function setValue(id,value){ const el=$(id); if(el) el.value=value ?? ''; }
function getValue(id){ return $(id)?.value?.trim() || ''; }

function switchSection(section){
  document.querySelectorAll('.website-section').forEach(el=>el.classList.toggle('active',el.dataset.panel===section));
  document.querySelectorAll('.website-nav').forEach(el=>el.classList.toggle('active',el.dataset.section===section));
}

function renderPages(){
  const pages=[
    ['home','Home','Hero, welcome, jadwal ibadah, dan konten utama'],
    ['new-to-church','New to Church','Informasi untuk pengunjung baru'],
    ['connect','Connect','Cara terhubung dengan gereja'],
    ['grow','Grow','Pertumbuhan iman dan resources'],
    ['ministries','Ministries','Pelayanan dan ministry gereja'],
    ['resources','Resources','Sermon, media, dan materi'],
  ];
  const el=$('website-pages-list'); if(!el)return;
  el.innerHTML=pages.map(([id,title,desc])=>`<div class="page-item"><div class="page-item-main"><span class="drag-handle"><i class="fas fa-grip-vertical"></i></span><div><strong>${title}</strong><small>${desc}</small></div></div><button class="website-btn secondary" type="button" data-page="${id}">Edit</button></div>`).join('');
}

function renderNavigation(){
  const items=[['home','Home','/'],['new-to-church','New to Church','/new-to-church'],['connect','Connect','/connect'],['grow','Grow','/grow'],['ministries','Ministries','/ministries'],['resources','Resources','/resources']];
  const el=$('website-navigation-list'); if(!el)return;
  el.innerHTML=items.map(([id,title,target])=>`<div class="navigation-item"><div class="navigation-item-main"><span class="drag-handle"><i class="fas fa-grip-vertical"></i></span><div><strong>${title}</strong><small>${target}</small></div></div><label><input type="checkbox" checked data-nav="${id}"> Visible</label></div>`).join('');
}

async function loadProfile(user){
  const snap=await getDoc(doc(db,'users',user.uid));
  if(!snap.exists()) throw new Error('Profil pengguna tidak ditemukan.');
  const profile=snap.data();
  if(!['admin','superadmin'].includes(profile.role)) throw new Error('ROLE_NOT_ALLOWED');
  if(!profile.churchId) throw new Error('Profil belum memiliki churchId.');
  state.user=user; state.profile=profile; state.churchId=profile.churchId;
}

function renderProfile(){
  setText('website-church-name',state.profile?.churchName || 'Gereja Digital');
  const slug=state.profile?.churchSlug;
  if(slug){
    const url=`/church/${encodeURIComponent(slug)}`;
    const link=$('website-public-link'); link.href=url; link.classList.remove('disabled');
    setText('overview-url',url);
  }else{
    setText('overview-url','Slug belum tersedia');
  }
}

function bindUI(){
  document.querySelectorAll('.website-nav').forEach(btn=>btn.addEventListener('click',()=>switchSection(btn.dataset.section)));
  document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>switchSection(btn.dataset.go)));
  $('website-logout')?.addEventListener('click',async()=>{await firebaseLogout();});
  $('appearance-form')?.addEventListener('submit',(e)=>{e.preventDefault(); alert('Draft Appearance siap disimpan. Backend website akan kita sambungkan pada tahap berikutnya.');});
  $('website-publish-sidebar')?.addEventListener('click',()=>alert('Publish backend akan kita aktifkan setelah struktur draft selesai.'));
  $('preview-open')?.addEventListener('click',()=>{$('website-public-link')?.click();});
}

onAuthStateChanged(auth,async(user)=>{
  try{
    if(!user){ window.location.href='index.html'; return; }
    await loadProfile(user);
    renderProfile(); renderPages(); renderNavigation(); bindUI();
    hide('website-loading'); show('website-manager');
  }catch(err){
    console.error('[WEBSITE] access check failed:',err);
    hide('website-loading'); show('website-access-denied');
    if(err.message==='ROLE_NOT_ALLOWED') setText('website-access-denied','Akses Ditolak');
  }
});
