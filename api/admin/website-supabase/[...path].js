const { requireChurchAdmin } = require("../../_lib/auth");
const { applyCors } = require("../../_lib/cors");
const { supabaseAdmin } = require("../../_lib/supabase");

const DEFAULT_CONFIG = {
  enabled: true,
  templateId: "modern-church",
  siteName: "Gereja Digital",
  tagline: "Selamat datang di website gereja kami",
  logoUrl: "",
  faviconUrl: "",
  theme: {
    primary: "#ff6b00",
    secondary: "#1f2937",
    accent: "#f59e0b",
    headingFont: "Poppins",
    bodyFont: "Poppins",
  },
  seo: { title: "", description: "", ogImageUrl: "" },
  contact: { email: "", phone: "", address: "", mapsUrl: "" },
  social: { facebook: "", instagram: "", youtube: "" },
};

function cleanString(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildConfig(website) {
  if (!website) return DEFAULT_CONFIG;
  return {
    enabled: website.enabled !== false,
    templateId: cleanString(website.template_id || "modern-church", 120),
    siteName: cleanString(website.site_name || "Gereja Digital", 120),
    tagline: cleanString(website.tagline || "", 180),
    logoUrl: cleanString(website.logo_url || "", 1000),
    faviconUrl: cleanString(website.favicon_url || "", 1000),
    theme: website.theme || DEFAULT_CONFIG.theme,
    seo: website.seo || DEFAULT_CONFIG.seo,
    contact: website.contact || DEFAULT_CONFIG.contact,
    social: website.social || DEFAULT_CONFIG.social,
    status: website.status || "draft",
    publishedAt: toIso(website.published_at),
    updatedAt: toIso(website.updated_at),
  };
}

async function loadSupabaseDraft(user) {
  const { data: church, error: churchError } = await supabaseAdmin
    .from("churches")
    .select("id, legacy_id, nama")
    .eq("legacy_id", user.churchId)
    .maybeSingle();

  if (churchError) throw new Error(`SUPABASE_CHURCH_LOOKUP_FAILED: ${churchError.message}`);
  if (!church) throw new Error("CHURCH_NOT_FOUND");

  const [websiteResult, slugResult] = await Promise.all([
    supabaseAdmin
      .from("websites")
      .select("id, church_id, enabled, template_id, site_name, tagline, logo_url, favicon_url, theme, seo, contact, social, status, published_at, published_by, created_at, updated_at")
      .eq("church_id", church.id)
      .maybeSingle(),
    supabaseAdmin
      .from("site_slugs")
      .select("slug")
      .eq("church_id", church.id)
      .maybeSingle(),
  ]);

  if (websiteResult.error) throw new Error(`SUPABASE_WEBSITE_LOOKUP_FAILED: ${websiteResult.error.message}`);
  if (slugResult.error) throw new Error(`SUPABASE_SLUG_LOOKUP_FAILED: ${slugResult.error.message}`);

  const website = websiteResult.data;
  const slug = slugResult.data?.slug || null;

  if (!website) {
    return {
      church: {
        id: user.churchId,
        name: cleanString(church.nama || "Gereja Digital", 120),
        website: slug ? { enabled: true, slug, status: "draft", templateId: "modern-church" } : {},
      },
      config: DEFAULT_CONFIG,
      navigation: { items: [] },
      pages: [],
    };
  }

  const [navigationResult, pagesResult] = await Promise.all([
    supabaseAdmin
      .from("website_navigation")
      .select("items, updated_at")
      .eq("website_id", website.id)
      .maybeSingle(),
    supabaseAdmin
      .from("website_pages")
      .select("id, legacy_id, title, slug, published, sections, created_at, updated_at")
      .eq("website_id", website.id)
      .order("id", { ascending: true }),
  ]);

  if (navigationResult.error) throw new Error(`SUPABASE_NAVIGATION_LOOKUP_FAILED: ${navigationResult.error.message}`);
  if (pagesResult.error) throw new Error(`SUPABASE_PAGES_LOOKUP_FAILED: ${pagesResult.error.message}`);

  const navigation = navigationResult.data?.items
    ? { items: navigationResult.data.items }
    : { items: [] };

  const pages = (pagesResult.data || []).map((page) => ({
    id: page.legacy_id || String(page.id),
    title: cleanString(page.title, 120),
    slug: cleanString(page.slug, 200),
    published: page.published === true,
    sections: Array.isArray(page.sections) ? page.sections : [],
  }));

  return {
    church: {
      id: user.churchId,
      name: cleanString(church.nama || "Gereja Digital", 120),
      website: {
        enabled: website.enabled !== false,
        slug,
        status: website.status || "draft",
        templateId: website.template_id || "modern-church",
        publishedAt: toIso(website.published_at),
        updatedAt: toIso(website.updated_at),
      },
    },
    config: buildConfig(website),
    navigation,
    pages,
  };
}

function getRoutePath(req) {
  const queryPath = req.query?.path;
  if (Array.isArray(queryPath)) return queryPath.join("/");
  if (typeof queryPath === "string" && queryPath) return queryPath.replace(/^\/+|\/+$/g, "");

  const rawUrl = String(req.url || "").split("?", 1)[0];
  const prefix = "/api/admin/website-supabase/";
  if (!rawUrl.startsWith(prefix)) return "";
  return decodeURIComponent(rawUrl.slice(prefix.length)).replace(/^\/+|\/+$/g, "");
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const route = getRoutePath(req);
  if (route !== "draft" || req.method !== "GET") {
    return res.status(404).json({ success: false, message: "Route tidak tersedia pada adapter Supabase." });
  }

  const user = await requireChurchAdmin(req, res);
  if (!user) return;

  try {
    const data = await loadSupabaseDraft(user);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("[WEBSITE-SUPABASE] GET /draft gagal:", {
      name: error?.name || null,
      message: error?.message || "Unknown error",
    });
    return res.status(500).json({
      success: false,
      message: "Gagal memuat website draft dari Supabase.",
    });
  }
};
