const { db } = require("../../api/_lib/firebase-admin");
const { supabaseAdmin } = require("../../api/_lib/supabase");

function canonicalize(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((out, key) => {
        out[key] = canonicalize(value[key]);
        return out;
      }, {});
  }
  return value;
}

function normalizeFirebaseConfig(config) {
  const c = config || {};
  return {
    enabled: c.enabled !== false,
    templateId: c.templateId || "modern-church",
    siteName: c.siteName || "Gereja Digital",
    tagline: c.tagline || "",
    logoUrl: c.logoUrl || "",
    faviconUrl: c.faviconUrl || "",
    theme: c.theme || {},
    seo: c.seo || {},
    contact: c.contact || {},
    social: c.social || {},
  };
}

function normalizeSupabaseConfig(website) {
  return {
    enabled: website?.enabled !== false,
    templateId: website?.template_id || "modern-church",
    siteName: website?.site_name || "Gereja Digital",
    tagline: website?.tagline || "",
    logoUrl: website?.logo_url || "",
    faviconUrl: website?.favicon_url || "",
    theme: website?.theme || {},
    seo: website?.seo || {},
    contact: website?.contact || {},
    social: website?.social || {},
  };
}

function normalizeNavigation(value) {
  return { items: Array.isArray(value?.items) ? value.items : [] };
}

function normalizePages(pages) {
  return (pages || [])
    .map((page) => ({
      id: String(page.id),
      title: page.title || "",
      slug: page.slug || "",
      published: page.published === true,
      sections: Array.isArray(page.sections) ? page.sections : [],
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function diff(label, firebaseValue, supabaseValue, differences) {
  const a = JSON.stringify(canonicalize(firebaseValue));
  const b = JSON.stringify(canonicalize(supabaseValue));
  if (a !== b) differences.push(label);
}

async function loadFirebaseDraft(churchSnap) {
  const churchId = churchSnap.id;
  const church = churchSnap.data() || {};
  const base = churchSnap.ref.collection("website");
  const pagesRef = base.doc("content").collection("pages");
  const [configSnap, navSnap, pagesSnap] = await Promise.all([
    base.doc("config").get(),
    base.doc("navigation").get(),
    pagesRef.get(),
  ]);

  return {
    churchId,
    churchName: church.nama || church.name || church.churchName || "Gereja Digital",
    website: church.website || {},
    config: configSnap.exists ? configSnap.data() : null,
    navigation: navSnap.exists ? navSnap.data() : null,
    pages: pagesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

async function loadSupabaseDraft(legacyChurchId) {
  const { data: church, error: churchError } = await supabaseAdmin
    .from("churches")
    .select("id, legacy_id, nama")
    .eq("legacy_id", legacyChurchId)
    .maybeSingle();
  if (churchError) throw churchError;
  if (!church) throw new Error(`Supabase church not found for ${legacyChurchId}`);

  const [websiteResult, slugResult] = await Promise.all([
    supabaseAdmin.from("websites").select("*").eq("church_id", church.id).maybeSingle(),
    supabaseAdmin.from("site_slugs").select("slug").eq("church_id", church.id).maybeSingle(),
  ]);
  if (websiteResult.error) throw websiteResult.error;
  if (slugResult.error) throw slugResult.error;

  const website = websiteResult.data;
  if (!website) throw new Error(`Supabase website not found for church ${church.id}`);

  const [navResult, pagesResult] = await Promise.all([
    supabaseAdmin.from("website_navigation").select("items").eq("website_id", website.id).maybeSingle(),
    supabaseAdmin.from("website_pages").select("legacy_id, title, slug, published, sections").eq("website_id", website.id),
  ]);
  if (navResult.error) throw navResult.error;
  if (pagesResult.error) throw pagesResult.error;

  return {
    churchId: legacyChurchId,
    churchName: church.nama || "Gereja Digital",
    website: {
      enabled: website.enabled !== false,
      slug: slugResult.data?.slug || null,
      status: website.status || "draft",
      templateId: website.template_id || "modern-church",
    },
    config: website,
    navigation: navResult.data || { items: [] },
    pages: (pagesResult.data || []).map((page) => ({
      id: page.legacy_id || "",
      title: page.title,
      slug: page.slug,
      published: page.published,
      sections: page.sections,
    })),
  };
}

(async () => {
  const snapshot = await db.collection("churches").get();
  const summary = [];
  let totalErrors = 0;

  for (const churchSnap of snapshot.docs) {
    const firebase = await loadFirebaseDraft(churchSnap);
    const supabase = await loadSupabaseDraft(firebase.churchId);
    const differences = [];

    diff("church.name", firebase.churchName, supabase.churchName, differences);
    diff("config", normalizeFirebaseConfig(firebase.config), normalizeSupabaseConfig(supabase.config), differences);
    diff("navigation", normalizeNavigation(firebase.navigation), normalizeNavigation(supabase.navigation), differences);
    diff("pages", normalizePages(firebase.pages), normalizePages(supabase.pages), differences);

    const result = {
      firebaseChurchId: firebase.churchId,
      churchName: firebase.churchName,
      firebasePageCount: firebase.pages.length,
      supabasePageCount: supabase.pages.length,
      differenceCount: differences.length,
      differences,
    };
    summary.push(result);
    totalErrors += differences.length;
  }

  console.log(JSON.stringify({
    mode: "READ_ONLY_COMPARE",
    firebaseChurchCount: snapshot.size,
    totalErrors,
    pass: totalErrors === 0,
    churches: summary,
  }, null, 2));

  if (totalErrors > 0) process.exitCode = 1;
})().catch((error) => {
  console.error("[compare-live-website-draft] FAILED");
  console.error(error?.message || error);
  process.exitCode = 1;
});
