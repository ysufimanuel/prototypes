const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not configured.');

const serviceAccount = require(path.resolve(serviceAccountPath));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const args = process.argv.slice(2);
const churchFlag = args.indexOf('--church');
const requestedChurchId = churchFlag >= 0 ? args[churchFlag + 1] : null;
const outputFlag = args.indexOf('--output');
const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : 'live-website-pages.json';

function jsonSafe(value, seen = new WeakSet()) {
  if (value === undefined || value === null) return value ?? null;
  if (value instanceof admin.firestore.Timestamp) return value.toDate().toISOString();
  if (value instanceof admin.firestore.GeoPoint) return { latitude: value.latitude, longitude: value.longitude };
  if (value instanceof admin.firestore.DocumentReference) return value.path;
  if (Array.isArray(value)) return value.map((item) => jsonSafe(item, seen));
  if (typeof value === 'object') {
    if (seen.has(value)) throw new Error('Circular Firestore value detected.');
    seen.add(value);
    const result = {};
    for (const [key, item] of Object.entries(value)) result[key] = jsonSafe(item, seen);
    seen.delete(value);
    return result;
  }
  return value;
}

function countMedia(value, seen = new WeakSet()) {
  let urls = 0;
  let objects = 0;
  if (!value || typeof value !== 'object' || seen.has(value)) return { urls, objects };
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = countMedia(item, seen);
      urls += result.urls;
      objects += result.objects;
    }
    seen.delete(value);
    return { urls, objects };
  }

  for (const [key, item] of Object.entries(value)) {
    const looksLikeMedia = /(^|_)(url|uri|src|source|media|image|video|thumbnail|file|asset)(_|$)/i.test(key);
    if (typeof item === 'string' && looksLikeMedia && /^(https?:)?\/\//i.test(item.trim())) urls += 1;
    else if (item && typeof item === 'object' && looksLikeMedia) objects += 1;

    const nested = countMedia(item, seen);
    urls += nested.urls;
    objects += nested.objects;
  }

  seen.delete(value);
  return { urls, objects };
}

async function getChurchIds() {
  if (requestedChurchId) return [requestedChurchId];
  const snapshot = await db.collection('churches').get();
  return snapshot.docs.map((doc) => doc.id).sort();
}

async function extractChurch(churchId) {
  const churchRef = db.doc(`churches/${churchId}`);
  const churchSnap = await churchRef.get();
  if (!churchSnap.exists) throw new Error(`Church not found: ${churchId}`);

  const church = churchSnap.data() || {};
  const pagesSnap = await churchRef.collection('website').doc('content').collection('pages').get();
  const pages = [];

  for (const doc of pagesSnap.docs) {
    const raw = doc.data() || {};
    const sections = Array.isArray(raw.sections) ? jsonSafe(raw.sections) : [];
    const media = countMedia(raw.sections);

    pages.push({
      id: doc.id,
      title: raw.title ?? null,
      slug: raw.slug ?? null,
      published: raw.published === true,
      sections,
      updatedAt: jsonSafe(raw.updatedAt),
      createdAt: jsonSafe(raw.createdAt),
      updatedBy: raw.updatedBy ?? null,
      sourceKeys: Object.keys(raw).sort(),
      sectionCount: sections.length,
      mediaUrlCount: media.urls,
      mediaObjectCount: media.objects,
    });
  }

  pages.sort((a, b) => String(a.slug ?? a.id).localeCompare(String(b.slug ?? b.id)));

  return {
    firebaseChurchId: churchId,
    churchName: church.nama ?? church.name ?? null,
    websiteSlug: church.website?.slug ?? null,
    pageCount: pages.length,
    pages,
  };
}

(async () => {
  console.log('[extract-live-website-pages] READ-ONLY');
  console.log('[extract-live-website-pages] No Firebase writes. No Supabase access.');

  const churchIds = await getChurchIds();
  const churches = [];
  for (const churchId of churchIds) churches.push(await extractChurch(churchId));

  const result = {
    generatedAt: new Date().toISOString(),
    source: 'firebase-live',
    pathPattern: 'churches/{churchId}/website/content/pages/*',
    churchCount: churches.length,
    totalPageCount: churches.reduce((sum, church) => sum + church.pageCount, 0),
    totalSections: churches.reduce((sum, church) => sum + church.pages.reduce((s, page) => s + page.sectionCount, 0), 0),
    totalMediaUrls: churches.reduce((sum, church) => sum + church.pages.reduce((s, page) => s + page.mediaUrlCount, 0), 0),
    totalMediaObjects: churches.reduce((sum, church) => sum + church.pages.reduce((s, page) => s + page.mediaObjectCount, 0), 0),
    churches,
  };

  const resolvedOutput = path.resolve(outputPath);
  fs.writeFileSync(resolvedOutput, JSON.stringify(result, null, 2), 'utf8');

  console.log(JSON.stringify({
    generatedAt: result.generatedAt,
    churchCount: result.churchCount,
    totalPageCount: result.totalPageCount,
    totalSections: result.totalSections,
    totalMediaUrls: result.totalMediaUrls,
    totalMediaObjects: result.totalMediaObjects,
    output: resolvedOutput,
  }, null, 2));
  console.log('[extract-live-website-pages] Extraction complete.');
})().catch((error) => {
  console.error('[extract-live-website-pages] FAILED');
  console.error(error.stack || error.message || error);
  process.exit(1);
});
