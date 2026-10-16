const admin = require('firebase-admin');

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPath) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not configured.');
}

const serviceAccount = require(require('path').resolve(serviceAccountPath));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const CHURCH_IDS = [
  'JhSB69TxbhTLKLUlR9VR',
  'mA32wi18aM7cMNjzcP7a',
];

function jsonSafe(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof admin.firestore.Timestamp) return value.toDate().toISOString();
  if (value instanceof admin.firestore.GeoPoint) return { latitude: value.latitude, longitude: value.longitude };
  if (value instanceof admin.firestore.DocumentReference) return value.path;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = jsonSafe(item);
    return out;
  }
  return value;
}

function countMedia(value, seen = new WeakSet()) {
  let urls = 0;
  let objects = 0;
  if (!value || typeof value !== 'object') return { urls, objects };
  if (seen.has(value)) return { urls, objects };
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = countMedia(item, seen);
      urls += result.urls;
      objects += result.objects;
    }
    return { urls, objects };
  }

  for (const [key, item] of Object.entries(value)) {
    const keyLooksMedia = /(^|_)(url|uri|src|source|media|image|video|thumbnail|file|asset)(_|$)/i.test(key);
    if (typeof item === 'string' && keyLooksMedia && /^(https?:)?\/\//i.test(item.trim())) {
      urls += 1;
    } else if (item && typeof item === 'object' && keyLooksMedia) {
      objects += 1;
    }
    const result = countMedia(item, seen);
    urls += result.urls;
    objects += result.objects;
  }
  return { urls, objects };
}

async function auditChurch(churchId) {
  const churchRef = db.doc(`churches/${churchId}`);
  const churchSnap = await churchRef.get();
  const church = churchSnap.exists ? churchSnap.data() : null;

  const pagesRef = churchRef.collection('website').doc('content').collection('pages');
  const pagesSnap = await pagesRef.get();

  const pages = [];
  let totalSections = 0;
  let totalMediaUrls = 0;
  let totalMediaObjects = 0;

  for (const doc of pagesSnap.docs) {
    const data = doc.data() || {};
    const sections = Array.isArray(data.sections) ? data.sections : [];
    const media = countMedia(data.sections);
    totalSections += sections.length;
    totalMediaUrls += media.urls;
    totalMediaObjects += media.objects;

    pages.push({
      id: doc.id,
      title: data.title ?? null,
      slug: data.slug ?? null,
      published: data.published ?? null,
      updatedAt: jsonSafe(data.updatedAt),
      createdAt: jsonSafe(data.createdAt),
      sectionCount: sections.length,
      mediaUrlCount: media.urls,
      mediaObjectCount: media.objects,
      sectionTypes: sections.map((section) => section?.type ?? section?.kind ?? null),
      hasSections: Array.isArray(data.sections),
      dataKeys: Object.keys(data).sort(),
    });
  }

  pages.sort((a, b) => String(a.slug ?? a.id).localeCompare(String(b.slug ?? b.id)));

  return {
    churchId,
    churchExists: churchSnap.exists,
    churchName: church?.nama ?? church?.name ?? null,
    websiteSlug: church?.website?.slug ?? null,
    pageCount: pages.length,
    totalSections,
    totalMediaUrls,
    totalMediaObjects,
    pages,
  };
}

(async () => {
  console.log('[audit-firebase-website-pages] READ-ONLY audit');
  console.log('[audit-firebase-website-pages] No Firebase writes will be performed.');

  const results = [];
  for (const churchId of CHURCH_IDS) {
    results.push(await auditChurch(churchId));
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    churchCount: results.length,
    totalPageCount: results.reduce((sum, item) => sum + item.pageCount, 0),
    totalSections: results.reduce((sum, item) => sum + item.totalSections, 0),
    totalMediaUrls: results.reduce((sum, item) => sum + item.totalMediaUrls, 0),
    totalMediaObjects: results.reduce((sum, item) => sum + item.totalMediaObjects, 0),
    churches: results,
  }, null, 2));
})().catch((error) => {
  console.error('[audit-firebase-website-pages] FAILED');
  console.error(error.stack || error.message || error);
  process.exit(1);
});
