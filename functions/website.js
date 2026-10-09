const express = require('express');
const { db, admin } = require('./firebase-admin');
const { requireChurchAdmin } = require('./auth-middleware');

const router = express.Router();

const DEFAULT_CONFIG = {
  enabled: true,
  templateId: 'modern-church',
  siteName: 'Gereja Digital',
  tagline: 'Selamat datang di website gereja kami',
  logoUrl: '',
  faviconUrl: '',
  theme: {
    primary: '#ff6b00',
    secondary: '#1f2937',
    accent: '#f59e0b',
    headingFont: 'Poppins',
    bodyFont: 'Poppins'
  },
  seo: { title: '', description: '', ogImageUrl: '' },
  contact: { email: '', phone: '', address: '', mapsUrl: '' },
  social: { facebook: '', instagram: '', youtube: '' }
};

const DEFAULT_NAVIGATION = {
  items: [
    { id: 'home', label: 'Home', type: 'page', target: '/' },
    { id: 'new-to-church', label: 'New to Church', type: 'page', target: '/new-to-church' },
    { id: 'connect', label: 'Connect', type: 'page', target: '/connect' },
    { id: 'grow', label: 'Grow', type: 'page', target: '/grow' },
    { id: 'ministries', label: 'Ministries', type: 'page', target: '/ministries' },
    { id: 'resources', label: 'Resources', type: 'page', target: '/resources' }
  ]
};

const DEFAULT_PAGES = [
  { id: 'home', title: 'Home', slug: '/', published: false, sections: [
    { id: 'hero', type: 'hero', enabled: true, order: 1, config: {} },
    { id: 'welcome', type: 'welcome', enabled: true, order: 2, config: {} },
    { id: 'services', type: 'serviceSchedule', enabled: true, order: 3, config: {} },
    { id: 'events', type: 'featuredEvents', enabled: true, order: 4, config: { limit: 3 } },
    { id: 'about', type: 'about', enabled: true, order: 5, config: {} },
    { id: 'ministries', type: 'ministries', enabled: true, order: 6, config: {} },
    { id: 'contact', type: 'contact', enabled: true, order: 7, config: {} }
  ] },
  { id: 'new-to-church', title: 'New to Church', slug: '/new-to-church', published: false, sections: [{ id: 'welcome', type: 'welcome', enabled: true, order: 1, config: {} }] },
  { id: 'connect', title: 'Connect', slug: '/connect', published: false, sections: [{ id: 'connect', type: 'cta', enabled: true, order: 1, config: {} }] },
  { id: 'grow', title: 'Grow', slug: '/grow', published: false, sections: [{ id: 'grow', type: 'about', enabled: true, order: 1, config: {} }] },
  { id: 'ministries', title: 'Ministries', slug: '/ministries', published: false, sections: [{ id: 'ministries', type: 'ministries', enabled: true, order: 1, config: {} }] },
  { id: 'resources', title: 'Resources', slug: '/resources', published: false, sections: [{ id: 'resources', type: 'sermons', enabled: true, order: 1, config: {} }] }
];

function now(){ return admin.firestore.FieldValue.serverTimestamp(); }

router.get('/draft', requireChurchAdmin, async (req, res) => {
  try {
    const base = db.collection('churches').doc(req.user.churchId).collection('website');
    const [configSnap, navSnap, pagesSnap] = await Promise.all([
      base.doc('config').get(), base.doc('navigation').get(), base.collection('pages').get()
    ]);
    res.json({ success:true, data:{
      config: configSnap.exists ? configSnap.data() : DEFAULT_CONFIG,
      navigation: navSnap.exists ? navSnap.data() : DEFAULT_NAVIGATION,
      pages: pagesSnap.empty ? DEFAULT_PAGES : pagesSnap.docs.map(d=>({id:d.id,...d.data()}))
    }});
  } catch(error){ console.error('[WEBSITE] draft:',error); res.status(500).json({success:false,message:'Gagal memuat draft website'}); }
});

router.post('/provision', requireChurchAdmin, async (req,res)=>{
  try{
    const churchId=req.user.churchId;
    const base=db.collection('churches').doc(churchId).collection('website');
    const batch=db.batch();
    const configRef=base.doc('config');
    const navRef=base.doc('navigation');
    const configSnap=await configRef.get();
    if(!configSnap.exists) batch.set(configRef,{...DEFAULT_CONFIG,createdAt:now(),updatedAt:now(),updatedBy:req.user.uid});
    const navSnap=await navRef.get();
    if(!navSnap.exists) batch.set(navRef,{...DEFAULT_NAVIGATION,createdAt:now(),updatedAt:now(),updatedBy:req.user.uid});
    const pagesSnap=await base.collection('pages').limit(1).get();
    if(pagesSnap.empty){ for(const page of DEFAULT_PAGES) batch.set(base.collection('pages').doc(page.id),{...page,createdAt:now(),updatedAt:now(),updatedBy:req.user.uid}); }
    await batch.commit();
    res.json({success:true,message:'Website draft siap digunakan'});
  }catch(error){console.error('[WEBSITE] provision:',error);res.status(500).json({success:false,message:'Gagal membuat draft website'});}
});

router.post('/publish', requireChurchAdmin, async (req,res)=>{
  try{
    const churchId=req.user.churchId;
    const source=db.collection('churches').doc(churchId).collection('website');
    const [configSnap,navSnap,pagesSnap]=await Promise.all([source.doc('config').get(),source.doc('navigation').get(),source.collection('pages').get()]);
    if(!configSnap.exists) return res.status(400).json({success:false,message:'Draft website belum tersedia'});
    const publicBase=db.collection('publicSites').doc(churchId);
    const batch=db.batch();
    const config=configSnap.data();
    const safeConfig={enabled:!!config.enabled,templateId:config.templateId||'modern-church',siteName:String(config.siteName||''),tagline:String(config.tagline||''),logoUrl:String(config.logoUrl||''),faviconUrl:String(config.faviconUrl||''),theme:config.theme||DEFAULT_CONFIG.theme,seo:config.seo||DEFAULT_CONFIG.seo,contact:config.contact||DEFAULT_CONFIG.contact,social:config.social||DEFAULT_CONFIG.social,publishedAt:now(),publishedBy:req.user.uid};
    batch.set(publicBase.collection('config').doc('site'),safeConfig,{merge:true});
    if(navSnap.exists) batch.set(publicBase.collection('navigation').doc('main'),navSnap.data());
    pagesSnap.forEach(s=>{const data=s.data();batch.set(publicBase.collection('pages').doc(s.id),{title:String(data.title||''),slug:String(data.slug||''),published:data.published!==false,sections:Array.isArray(data.sections)?data.sections:[],publishedAt:now()});});
    batch.set(source.doc('config'),{status:'published',updatedAt:now(),updatedBy:req.user.uid},{merge:true});
    await batch.commit();
    res.json({success:true,message:'Website berhasil dipublikasikan'});
  }catch(error){console.error('[WEBSITE] publish:',error);res.status(500).json({success:false,message:'Gagal mempublikasikan website'});}
});

module.exports=router;
