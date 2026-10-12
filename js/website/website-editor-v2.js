import "../firebase.js";

const $ = id => document.getElementById(id);
let user = null;
let draft = null;
let editing = null;
const API = "/api/admin/website";

const esc = v => String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

async function withTimeout(promise, timeoutMs, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

async function api(path, options = {}) {
  if (!user) throw new Error("AUTH_REQUIRED");
  const token = await withTimeout(
    user.getIdToken(),
    15000,
    "Firebase ID token terlalu lama dimuat. Silakan refresh halaman.",
  );
  const controller = new AbortController();
  const requestTimeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(API + path, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.success === false)
      throw new Error(data.message || `HTTP ${r.status}`);
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request ${path} terlalu lama (lebih dari 20 detik).`);
    }
    throw error;
  } finally {
    window.clearTimeout(requestTimeout);
  }
}

async function loadDraft() { draft = (await api("/draft")).data; return draft; }
function ensureMobilePublish() { if ($("website-mobile-publish")) return; const b=document.createElement("button"); b.id="website-mobile-publish"; b.className="website-publish-btn mobile-publish-floating"; b.type="button"; b.innerHTML='<i class="fas fa-cloud-upload-alt"></i><span>Publish</span>'; b.addEventListener("click", publish); document.body.appendChild(b); }
async function publish(){try{await saveAll();const a=await api("/publish",{method:"POST",body:"{}"});await api("/publish-events",{method:"POST",body:"{}"});await api("/publish-groups",{method:"POST",body:"{}"});alert(a.message||"Website berhasil dipublikasikan.");window.dispatchEvent(new CustomEvent("cms:website-draft-updated"));}catch(e){console.error(e);alert(e.message||"Gagal mempublikasikan website.")}}
function mediaRow(m={}) { const id=m.id||`media-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; return `<div class="v2-media-row" data-media-id="${esc(id)}"><div class="form-grid"><label>Jenis Media<select class="v2-media-type"><option value="image" ${m.type==="image"?"selected":""}>Foto / Gambar</option><option value="youtube" ${m.type==="youtube"?"selected":""}>YouTube</option><option value="vimeo" ${m.type==="vimeo"?"selected":""}>Vimeo</option><option value="video" ${m.type==="video"?"selected":""}>Video URL</option></select></label><label>Judul Media<input class="v2-media-title" maxlength="160" value="${esc(m.title||"")}"></label><label class="full">URL Media<input class="v2-media-url" type="url" maxlength="1000" placeholder="https://..." value="${esc(m.url||"")}"></label><label>Posisi<select class="v2-media-position"><option value="top" ${m.position==="top"?"selected":""}>Atas teks</option><option value="bottom" ${!m.position||m.position==="bottom"?"selected":""}>Bawah teks</option><option value="left" ${m.position==="left"?"selected":""}>Kiri teks</option><option value="right" ${m.position==="right"?"selected":""}>Kanan teks</option><option value="background" ${m.position==="background"?"selected":""}>Background / Overlay</option></select></label><label>Mode<select class="v2-media-mode"><option value="inline" ${m.mode!=="background"?"selected":""}>Media biasa</option><option value="background" ${m.mode==="background"?"selected":""}>Background / Overlay</option></select></label><label>Radius <span class="v2-range-value">${Number(m.radius)||16}px</span><input class="v2-media-radius" type="range" min="0" max="60" value="${Number(m.radius)||16}"></label><label class="v2-overlay-field ${m.mode==="background"||m.position==="background"?"":"hidden"}">Overlay <span class="v2-range-value">${Number(m.overlay)||45}%</span><input class="v2-media-overlay" type="range" min="0" max="95" value="${Number(m.overlay)||45}"></label><div class="full v2-media-actions"><button type="button" class="website-btn secondary v2-media-remove"><i class="fas fa-trash"></i> Hapus Media</button></div></div><div class="v2-media-preview"></div></div>`; }
function sectionCard(s,i){ const c=s.config||{}, media=Array.isArray(c.media)?c.media:[]; return `<article class="v2-section-card" data-id="${esc(s.id)}"><div class="editor-section-top"><div><strong>${i+1}. ${esc(s.type)}</strong><small>Section</small></div><div class="editor-section-actions"><label class="editor-checkbox"><input class="v2-enabled" type="checkbox" ${s.enabled!==false?"checked":""}> Aktif</label><button type="button" class="icon-btn v2-section-remove" title="Hapus"><i class="fas fa-trash"></i></button></div></div><div class="form-grid"><label>Jenis<select class="v2-section-type">${["hero","welcome","serviceSchedule","featuredEvents","about","ministries","sermons","resources","contact","cta"].map(t=>`<option value="${t}" ${s.type===t?"selected":""}>${t}</option>`).join("")}</select></label><label>Judul<input class="v2-section-title" maxlength="160" value="${esc(c.title||"")}"></label><label class="full">Deskripsi<textarea class="v2-section-description" rows="3" maxlength="1000">${esc(c.description||"")}</textarea></label>${["serviceSchedule","featuredEvents","ministries"].includes(s.type)?`<label>Batas Item<input class="v2-limit" type="number" min="1" max="20" value="${Number(c.limit)||4}"></label>`:""}</div><div class="v2-media-box"><div class="v2-media-head"><div><strong>Media Section</strong><small>Foto/video bisa dipasang di semua section.</small></div><button type="button" class="website-btn secondary v2-media-add"><i class="fas fa-image"></i> Tambah Media</button></div><div class="v2-media-list">${media.map(mediaRow).join("")||'<p class="v2-empty-media">Belum ada media.</p>'}</div></div></article>`; }
function renderEditor(){const modal=$("page-editor-modal"), form=$("page-editor-form"), pages=draft.pages||[]; if(!modal||!form||!editing)return; form.innerHTML=`<input id="page-editor-id" type="hidden" value="${esc(editing.id)}"><div class="form-grid page-meta-grid"><label>Judul Halaman<input id="v2-page-title" type="text" maxlength="120" required value="${esc(editing.title||"")}"></label><label>Slug<input id="v2-page-slug" type="text" maxlength="200" required value="${esc(editing.slug||"/")}"></label></div><label class="editor-checkbox"><input id="v2-page-published" type="checkbox" ${editing.published!==false?"checked":""}> Tampilkan halaman di website publik</label><div class="editor-section-heading"><div><h3>Sections & Media</h3><p>Setiap section bisa punya foto/video sendiri, posisi, overlay, dan radius.</p></div><button type="button" class="website-btn secondary" id="v2-add-section"><i class="fas fa-plus"></i> Tambah Section</button></div><div id="v2-sections" class="page-editor-sections">${(editing.sections||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(sectionCard).join("")}</div><div class="form-actions"><button type="button" id="v2-cancel" class="website-btn secondary">Batal</button><button type="submit" class="website-btn primary"><i class="fas fa-save"></i> Simpan & Update Preview</button></div>`; modal.classList.remove("hidden"); document.body.classList.add("modal-open"); }
function readEditor(){ const cards=[...document.querySelectorAll("#v2-sections .v2-section-card")]; const sections=cards.map((card,i)=>{const old=(editing.sections||[]).find(s=>s.id===card.dataset.id)||{id:card.dataset.id,type:"welcome",config:{}};const media=[...card.querySelectorAll(".v2-media-row")].map(row=>({id:row.dataset.mediaId,type:row.querySelector(".v2-media-type")?.value||"image",title:row.querySelector(".v2-media-title")?.value?.trim()||"",url:row.querySelector(".v2-media-url")?.value?.trim()||"",position:row.querySelector(".v2-media-position")?.value||"bottom",mode:row.querySelector(".v2-media-mode")?.value||"inline",radius:Number(row.querySelector(".v2-media-radius")?.value)||0,overlay:Number(row.querySelector(".v2-media-overlay")?.value)||45})).filter(m=>m.url);const config={...(old.config||{}),title:card.querySelector(".v2-section-title")?.value?.trim()||"",description:card.querySelector(".v2-section-description")?.value?.trim()||"",media};const limit=card.querySelector(".v2-limit");if(limit)config.limit=Math.min(20,Math.max(1,Number(limit.value)||4));else delete config.limit;return {...old,id:card.dataset.id,type:card.querySelector(".v2-section-type")?.value||old.type,enabled:card.querySelector(".v2-enabled")?.checked!==false,order:i+1,config};});return sections; }
async function savePage(){ const sections=readEditor(); const title=$("v2-page-title").value.trim(); const slug=$("v2-page-slug").value.trim()||"/"; editing={...editing,title,slug,published:$("v2-page-published").checked,sections}; draft.pages=(draft.pages||[]).map(p=>p.id===editing.id?JSON.parse(JSON.stringify(editing)):p); draft.navigation=draft.navigation||{items:[]}; draft.navigation.items=(draft.navigation.items||[]).map(item=>{const target=String(item.target||"").replace(/^\/+|\/+$/g,""); if(target===String(slug).replace(/^\/+|\/+$/g,"")||item.id===editing.id)return {...item,label:title,target:slug};return item}); await saveAll(); closeEditor(); window.dispatchEvent(new CustomEvent("cms:website-draft-updated")); }
async function saveAll(){ if(!draft)await loadDraft(); await api("/draft",{method:"PUT",body:JSON.stringify({config:draft.config,navigation:draft.navigation,pages:draft.pages})}); }
function closeEditor(){$("page-editor-modal")?.classList.add("hidden");document.body.classList.remove("modal-open");editing=null;}
function openEditor(id){const page=(draft?.pages||[]).find(p=>p.id===id);if(!page)return;editing=JSON.parse(JSON.stringify(page));renderEditor();}
function renderNavSave(){const box=$("website-navigation-list");if(!box)return;let b=box.parentElement.querySelector(".v2-nav-save");if(!b){b=document.createElement("button");b.className="website-btn primary v2-nav-save";b.type="button";b.innerHTML='<i class="fas fa-save"></i> Simpan Navigation';box.parentElement.appendChild(b);b.addEventListener("click",async()=>{try{draft=await loadDraft();draft.navigation={items:(draft.navigation?.items||[]).map(i=>({...i,visible:box.querySelector(`[data-v2-nav="${CSS.escape(i.id)}"]`)?.checked!==false}))};await saveAll();alert("Navigation berhasil disimpan.");window.dispatchEvent(new CustomEvent("cms:website-draft-updated"));}catch(e){alert(e.message||"Gagal menyimpan navigation.")}})} }
function bindNavigation(){const box=$("website-navigation-list");if(!box||box.dataset.v2Ready)return;box.dataset.v2Ready="1";const observer=new MutationObserver(()=>{renderNavSave();});observer.observe(box,{childList:true});renderNavSave();}
function init(){ensureMobilePublish();document.addEventListener("click",async e=>{const edit=e.target.closest(".page-edit-btn");if(edit){e.preventDefault();e.stopImmediatePropagation();try{draft=await loadDraft();openEditor(edit.dataset.page)}catch(err){alert(err.message||"Gagal memuat page")}}},true);document.addEventListener("click",e=>{if(e.target.closest("#v2-cancel,#page-editor-close")){e.preventDefault();closeEditor();return}if(e.target.closest("#v2-add-section")){e.preventDefault();if(!editing)return;const sections=$("v2-sections");const id=`section-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;const holder=document.createElement("div");holder.innerHTML=sectionCard({id,type:"welcome",enabled:true,order:99,config:{}},sections.children.length);sections.appendChild(holder.firstElementChild);return}const add=e.target.closest(".v2-media-add");if(add){const list=add.closest(".v2-media-box")?.querySelector(".v2-media-list");list?.querySelector(".v2-empty-media")?.remove();const holder=document.createElement("div");holder.innerHTML=mediaRow({});list?.appendChild(holder.firstElementChild);return}const rm=e.target.closest(".v2-media-remove");if(rm){rm.closest(".v2-media-row")?.remove();return}const rs=e.target.closest(".v2-section-remove");if(rs){rs.closest(".v2-section-card")?.remove();return}},true);document.addEventListener("submit",async e=>{if(e.target.id!=="page-editor-form")return;e.preventDefault();e.stopImmediatePropagation();try{await savePage();alert("Page berhasil disimpan dan draft preview diperbarui.")}catch(err){console.error(err);alert(err.message||"Gagal menyimpan page.")}},true);document.addEventListener("input",e=>{if(e.target.matches(".v2-media-radius,.v2-media-overlay")){const label=e.target.parentElement.querySelector(".v2-range-value");if(label)label.textContent=`${e.target.value}${e.target.classList.contains("v2-media-overlay")?"%":"px"}`}});bindNavigation();new MutationObserver(bindNavigation).observe(document.body,{childList:true,subtree:true});}
const auth=window.auth,onAuth=window.firebaseOnAuthStateChanged;if(onAuth)onAuth(auth,u=>{user=u;if(user){init();}});
