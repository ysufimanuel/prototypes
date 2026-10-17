const { supabaseAdmin } = require("../_lib/supabase");

function cleanSlug(value) {
  try { return decodeURIComponent(String(value || "")).trim().replace(/^\/+|\/+$/g, ""); }
  catch { return String(value || "").trim().replace(/^\/+|\/+$/g, ""); }
}

function cleanRoute(value) {
  let route = String(value ?? "/").trim();
  try { route = decodeURIComponent(route); } catch {}
  if (!route.startsWith("/")) route = `/${route}`;
  route = route.replace(/\/+/g, "/");
  if (route.length > 1) route = route.replace(/\/+$/, "");
  return route || "/";
}

function normalizePage(page) {
  return {
    id: page.legacy_id || String(page.id),
    title: page.title || "Website Gereja",
    slug: page.slug || "/",
    published: page.published === true,
    sections: Array.isArray(page.sections) ? page.sections : [],
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method Not Allowed" });
    const slug = cleanSlug(req.query?.slug);
    const route = cleanRoute(req.query?.route || "/");
    if (!slug) return res.status(400).json({ success: false, message: "SITE_NOT_FOUND" });

    const { data: slugRow, error: slugError } = await supabaseAdmin
      .from("site_slugs")
      .select("church_id, slug")
      .eq("slug", slug)
      .maybeSingle();
    if (slugError) throw slugError;
    if (!slugRow) return res.status(404).json({ success: false, message: "SITE_NOT_FOUND" });

    const { data: website, error: websiteError } = await supabaseAdmin
      .from("websites")
      .select("id, church_id, enabled, template_id, site_name, tagline, logo_url, favicon_url, theme, seo, contact, social, status, published_at")
      .eq("church_id", slugRow.church_id)
      .maybeSingle();
    if (websiteError) throw websiteError;
    if (!website || website.enabled === false || website.status !== "published") {
      return res.status(404).json({ success: false, message: "SITE_UNPUBLISHED" });
    }

    const [churchResult, navResult, pagesResult, eventsResult, groupsResult] = await Promise.all([
      supabaseAdmin.from("churches").select("legacy_id, nama").eq("id", slugRow.church_id).maybeSingle(),
      supabaseAdmin.from("website_navigation").select("items").eq("website_id", website.id).maybeSingle(),
      supabaseAdmin.from("website_pages").select("id, legacy_id, title, slug, published, sections").eq("website_id", website.id).eq("published", true).order("id", { ascending: true }),
      supabaseAdmin.from("events").select("id, legacy_id, nama, tipe, custom_type, starts_at, ends_at, lokasi, deskripsi, status, website").eq("church_id", slugRow.church_id).order("starts_at", { ascending: true }).limit(300),
      supabaseAdmin.from("groups").select("id, legacy_id, nama, deskripsi, jadwal, leader_id").eq("church_id", slugRow.church_id).order("id", { ascending: true }).limit(300),
    ]);
    for (const result of [churchResult, navResult, pagesResult, eventsResult, groupsResult]) if (result.error) throw result.error;

    const pages = (pagesResult.data || []).map(normalizePage);
    const page = pages.find((item) => cleanRoute(item.slug || "/") === route);
    if (!page) return res.status(404).json({ success: false, message: "PAGE_NOT_FOUND", route, availableRoutes: pages.map((item) => item.slug) });

    const events = (eventsResult.data || []).filter((event) => event.website?.published !== false).map((event) => ({
      id: event.legacy_id || String(event.id), nama: event.nama, tipe: event.tipe || event.custom_type || "event",
      start: event.starts_at, end: event.ends_at, lokasi: event.lokasi, deskripsi: event.deskripsi, status: event.status,
    }));
    const ministries = (groupsResult.data || []).map((group) => ({
      id: group.legacy_id || String(group.id), name: group.nama, description: group.deskripsi, schedule: group.jadwal,
      leader: group.leader_id ? { id: String(group.leader_id) } : null,
    }));

    return res.setHeader("Cache-Control", "no-store").json({
      success: true,
      data: {
        church: { id: churchResult.data?.legacy_id || "", name: churchResult.data?.nama || website.site_name || "Gereja" },
        slug,
        config: {
          enabled: website.enabled !== false, templateId: website.template_id || "modern-church", siteName: website.site_name || "Gereja Digital",
          tagline: website.tagline || "", logoUrl: website.logo_url || "", faviconUrl: website.favicon_url || "", theme: website.theme || {},
          seo: website.seo || {}, contact: website.contact || {}, social: website.social || {},
        },
        navigation: navResult.data || { items: [] }, page, pages, events, ministries,
      },
    });
  } catch (error) {
    console.error("[PUBLIC WEBSITE] Supabase lookup failed:", error);
    return res.status(500).json({ success: false, message: "PUBLIC_SITE_LOAD_FAILED" });
  }
};
