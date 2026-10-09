const express = require('express');
const { db, admin } = require('./firebase-admin');
const { requireChurchAdmin } = require('./auth-middleware');

const router = express.Router();

const DEFAULT_CONFIG = {
  enabled: true,
  templateId: 'modern-church',
  siteName: 'Gereja Digital',
  tagline: 'Selamat datang di website gereja kami',
  logoUrl: '', faviconUrl: '',
  theme: { primary: '#ff6b00', secondary: '#1f2937', accent: '#f59e0b', headingFont: 'Poppins', bodyFont: 'Poppins' },
  seo: { title: '', description: '', ogImageUrl: '' },
  contact: { email: '', phone: '', address: '', mapsUrl: '' },
  social: { facebook: '', instagram: '', youtube: '' }
};

const DEFAULT_NAVIGATION = { items: [
  { id: 'home', label: 'Home', type: 'page', target: '/' },
  { id: 'new-to-church', label: 'New to Church', type: 'page', target: '/new-to-church' },
  { id: 'connect', label: 'Connect', type: 'page', target: '/connect' },
  { id: 'grow', label: 'Grow', type: 'page', target: '/grow' },
  { id: 'ministries', label: 'Ministries', type: 'page', target: '/ministries' },
  { id: 'resources', label: 'Resources', type: 'page', target: '/resources' }
]};

const DEFAULT_PAGES = [
  { id:'home', title:'Home', slug:'/', published:false, sections:[
    {id:'hero',type:'hero',enabled:true,order:1,config:{}},{id:'welcome',type:'welcome',enabled:true,order:2,config:{}},{id:'services',type:'serviceSchedule',enabled:true,order:3,config:{}},{id:'events',type:'featuredEvents',enabled:true,order:4,config:{limit:3}},{id:'about',type:'about',enabled:true,order:5,config:{}},{id:'ministries',type:'ministries',enabled:true,order:6,config:{}},{id:'contact',type:'contact',enabled:true,order:7,config:{}}
  ]},
  {id:'new-to-church',title:'New to Church',slug:'/new-to-church',published:false,sections:[{id:'welcome',type:'welcome',enabled:true,order:1,config:{}}]},
  {id:'connect',title:'Connect',slug:'/connect',published:false,sections:[{id:'connect',type:'cta',enabled:true,order:1,config:{}}]},
  {id:'grow',title:'Grow',slug:'/grow',published:false,sections:[{id:'grow',type:'about',enabled:true,order:1,config:{}}]},
  {id:'ministries',title:'Ministries',slug:'/ministries',published:false,sections:[{id:'ministries',type:'ministries',enabled:true,order:1,config:{}}]},
  {id:'resources',title:'Resources',slug:'/resources',published:false,sections:[{id:'resources',type:'sermons',enabled:true,order:1,config:{}}]}
];

function now(){ return admin.firestore.FieldValue.serverTimestamp(); }
function cleanString(value,max=500){ return String(value ?? '').trim().slice(0,max); }

router.get('/draft', requireChurchAdmin, async (req,res)=>{
  try{
    const churchRef=db.collection('churches').doc(req.user.churchId);
    const base=churchRef.collection('website');
    const [churchSnap,configSnap,navSnap,pagesSnap]=await Promise.all([churchRef.get(),base.doc('config').get(),base.doc('navigation').get(),base.collection('pages').get()]);
    const church=churchSnap.exists?churchSnap.data():{};
    res.json({success:true,data:{church:{id:req.user.churchId,name:cleanString(church.name||church.churchName||'Gereja Digital',120),website:church.website||{}},config:configSnap.exists?configSnap.data():DEFAULT_CONFIG,navigation:navSnap.exists?navSnap.data():DEFAULT_NAVIGATION,pages:pagesSnap.empty?DEFAULT_PAGES:pagesSnap.docs.map(d=>({id:d.id,...d.data()}))}});
  }catch(error){console.error('[WEBSITE] draft:',error);res.status(500).json({success:false,message:'Gagal memuat draft website'});}
});

router.post('/provision', requireChurchAdmin, async(req,res)=>{
  try{
    const churchId=req.user.churchId, base=db.collection('churches').doc(churchId).collection('website');
    const batch=db.batch(), configRef=base.doc('config'), navRef=base.doc('navigation');
    const [configSnap,navSnap,pagesSnap]=await Promise.all([configRef.get(),navRef.get(),base.collection('pages').limit(1).get()]);
    if(!configSnap.exists) batch.set(configRef,{...DEFAULT_CONFIG,status:'draft',createdAt:now(),updatedAt:now(),updatedBy:req.user.uid});
    if(!navSnap.exists) batch.set(navRef,{...DEFAULT_NAVIGATION,createdAt:now(),updatedAt:now(),updatedBy:req.user.uid});
    if(pagesSnap.empty) for(const page of DEFAULT_PAGES) batch.set(base.collection('pages').doc(page.id),{...page,createdAt:now(),updatedAt:now(),updatedBy:req.user.uid});
    await batch.commit();
    res.json({success:true,message:'Website draft siap digunakan'});
  }catch(error){console.error('[WEBSITE] provision:',error);res.status(500).json({success:false,message:'Gagal membuat draft website'});}
});

router.put('/draft', requireChurchAdmin, async(req,res)=>{
  try{
    const churchId=req.user.churchId, body=req.body||{}, base=db.collection('churches').doc(churchId).collection('website');
    const config=body.config||{}, theme=config.theme||{}, contact=config.contact||{};
    const safeConfig={
      enabled:config.enabled!==false, templateId:'modern-church',
      siteName:cleanString(config.siteName,120), tagline:cleanString(config.tagline,180),
      logoUrl:cleanString(config.logoUrl,1000), faviconUrl:cleanString(config.faviconUrl,1000),
      theme:{primary:cleanString(theme.primary,30),secondary:cleanString(theme.secondary,30),accent:cleanString(theme.accent,30),headingFont:cleanString(theme.headingFont,80)||'Poppins',bodyFont:'Poppins'},
      contact:{email:cleanString(contact.email,160),phone:cleanString(contact.phone,60),address:cleanString(contact.address,300),mapsUrl:cleanString(contact.mapsUrl,1000)},
      updatedAt:now(),updatedBy:req.user.uid
    };
    const batch=db.batch();
    batch.set(base.doc('config'),safeConfig,{merge:true});
    if(Array.isArray(body.navigation?.items)) batch.set(base.doc('navigation'),{items:body.navigation.items.map(i=>({id:cleanString(i.id,80),label:cleanString(i.label,80),type:'page',target:cleanString(i.target,200),visible:i.visible!==false})) ,updatedAt:now(),updatedBy:req.user.uid},{merge:true});
    if(Array.isArray(body.pages)) for(const page of body.pages.slice(0,30)){ batch.set(base.collection('pages').doc(cleanString(page.id,80)),{title:cleanString(page.title,120),slug:cleanString(page.slug,200),published:page.published===true,sections:Array.isArray(page.sections)?page.sections.slice(0,30):[],updatedAt:now(),updatedBy:req.user.uid},{merge:true}); }
    await batch.commit();
    res.json({success:true,message:'Draft website berhasil disimpan'});
  }catch(error){console.error('[WEBSITE] save draft:',error);res.status(500).json({success:false,message:'Gagal menyimpan draft website'});}
});

router.post('/publish', requireChurchAdmin, async(req,res)=>{
  try{
    const churchId=req.user.churchId, source=db.collection('churches').doc(churchId).collection('website');
    const [configSnap,navSnap,pagesSnap]=await Promise.all([source.doc('config').get(),source.doc('navigation').get(),source.collection('pages').get()]);
    if(!configSnap.exists) return res.status(400).json({success:false,message:'Draft website belum tersedia'});
    const publicBase=db.collection('publicSites').doc(churchId), batch=db.batch(), config=configSnap.data();
    const safeConfig={enabled:!!config.enabled,templateId:config.templateId||'modern-church',siteName:cleanString(config.siteName,120),tagline:cleanString(config.tagline,180),logoUrl:cleanString(config.logoUrl,1000),faviconUrl:cleanString(config.faviconUrl,1000),theme:config.theme||DEFAULT_CONFIG.theme,contact:config.contact||DEFAULT_CONFIG.contact,publishedAt:now(),publishedBy:req.user.uid};
    batch.set(publicBase.collection('config').doc('site'),safeConfig,{merge:true});
    if(navSnap.exists) batch.set(publicBase.collection('navigation').doc('main'),navSnap.data());
    pagesSnap.forEach(s=>{const d=s.data();batch.set(publicBase.collection('pages').doc(s.id),{title:cleanString(d.title,120),slug:cleanString(d.slug,200),published:d.published!==false,sections:Array.isArray(d.sections)?d.sections:[],publishedAt:now()});});
    batch.set(source.doc('config'),{status:'published',publishedAt:now(),publishedBy:req.user.uid,updatedAt:now(),updatedBy:req.user.uid},{merge:true});
    await batch.commit();
    res.json({success:true,message:'Website berhasil dipublikasikan'});
  }catch(error){console.error('[WEBSITE] publish:',error);res.status(500).json({success:false,message:'Gagal mempublikasikan website'});}
});

module.exports=router;
