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
  theme: { primary: "#ff6b00", secondary: "#1f2937", accent: "#f59e0b", headingFont: "Poppins", bodyFont: "Poppins" },
  seo: { title: "", description: "", ogImageUrl: "" },
  contact: { email: "", phone: "", address: "", mapsUrl: "" },
  social: { facebook: "", instagram: "", youtube: "" },
};

function cleanString(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

async function loadWebsite(user) {
  const { data: church, error: churchError } = await supabaseAdmin
    .from("churches")
    .select("id, legacy_id, nama")
    .eq("legacy_id", user.churchId)
    .maybeSingle();
  if (churchError) throw churchError;
  if (!church) throw new Error("CHURCH_NOT_FOUND");

  const { data: website, error: websiteError } = await supabaseAdmin
    .from("websites")
    .select("id, church_id, enabled, template_id, site_name, tagline, logo_url, favicon_url, theme, seo, contact, social, status, published_at, updated_at")
    .eq("church_id", church.id)
    .maybeSingle();
  if (websiteError) throw websiteError;
  if (!website) throw new Error("WEBSITE_NOT_FOUND");

  const [slugResult, navigationResult, pagesResult] = await Promise.all([
    supabaseAdmin.from("site_slugs").select("slug").eq("church_id", church.id).maybeSingle(),
    supabaseAdmin.from("website_navigation").select("items").eq("website_id", website.id).maybeSingle(),
    supabaseAdmin.from("website_pages").select("id, legacy_id, title, slug, published, sections").eq("website_id", website.id).order("id", { ascending: true }),
  ]);
  if (slugResult.error) throw slugResult.error;
  if (navigationResult.error) throw navigationResult.error;
  if (pagesResult.error) throw pagesResult.error;

  return {
    church,
    website,
    slug: slugResult.data?.slug || null,
    navigation: navigationResult.data || { items: [] },
    pages: pagesResult.data || [],
  };
}

async function loadContent(churchId) {
  const [eventsResult, groupsResult] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("legacy_id, nama, tipe, custom_type, starts_at, ends_at, lokasi, deskripsi, kapasitas, status, website")
      .eq("church_id", churchId)
      .order("starts_at", { ascending: true })
      .limit(300),
    supabaseAdmin
      .from("groups")
      .select("legacy_id, nama, deskripsi, leader_id, jadwal, show_phone")
      .eq("church_id", churchId)
      .order("id", { ascending: true })
      .limit(300),
  ]);
  if (eventsResult.error) throw eventsResult.error;
  if (groupsResult.error) throw groupsResult.error;

  const leaderIds = [...new Set((groupsResult.data || []).map((group) => group.leader_id).filter((id) => id != null))];
  let leaders = new Map();
  if (leaderIds.length) {
    const { data, error } = await supabaseAdmin.from("members").select("id, nama, telepon").in("id", leaderIds);
    if (error) throw error;
    leaders = new Map((data || []).map((member) => [member.id, member]));
  }

  const events = (eventsResult.data || []).filter((event) => event.website?.published !== false).map((event) => ({
    id: event.legacy_id || String(event.nama || "event"),
    nama: cleanString(event.nama, 160),
    tipe: cleanString(event.tipe, 80),
    customType: cleanString(event.custom_type, 120),
    start: event.starts_at ? new Date(event.starts_at).toISOString() : "",
    end: event.ends_at ? new Date(event.ends_at).toISOString() : "",
    lokasi: cleanString(event.lokasi, 240),
    deskripsi: cleanString(event.deskripsi, 1000),
    kapasitas: Number.isFinite(Number(event.kapasitas)) ? Number(event.kapasitas) : 0,
    status: cleanString(event.status, 40),
  }));

  const ministries = (groupsResult.data || []).map((group) => {
    const leader = leaders.get(group.leader_id);
    const leaderData = leader ? { name: cleanString(leader.nama, 120) } : null;
    if (leader && group.show_phone === true && leader.telepon) leaderData.phone = cleanString(leader.telepon, 50);
    return {
      id: group.legacy_id || String(group.nama || "group"),
      name: cleanString(group.nama, 120),
      description: cleanString(group.deskripsi, 1000),
      schedule: cleanString(group.jadwal, 300),
      leader: leaderData,
    };
  });

  return { events, ministries };
}

function toClientDraft(record, content) {
  const website = record.website;
  return {
    church: {
      id: record.church.legacy_id,
      name: cleanString(record.church.nama || "Gereja Digital", 120),
      website: {
        enabled: website.enabled !== false,
        slug: record.slug,
        status: website.status || "draft",
        templateId: website.template_id || "modern-church",
        publishedAt: website.published_at || null,
        updatedAt: website.updated_at || null,
      },
    },
    config: {
      enabled: website.enabled !== false,
      templateId: website.template_id || "modern-church",
      siteName: cleanString(website.site_name || DEFAULT_CONFIG.siteName, 120),
      tagline: cleanString(website.tagline || "", 180),
      logoUrl: cleanString(website.logo_url || "", 1000),
      faviconUrl: cleanString(website.favicon_url || "", 1000),
      theme: website.theme || DEFAULT_CONFIG.theme,
      seo: website.seo || DEFAULT_CONFIG.seo,
      contact: website.contact || DEFAULT_CONFIG.contact,
      social: website.social || DEFAULT_CONFIG.social,
    },
    navigation: record.navigation?.items ? { items: record.navigation.items } : { items: [] },
    pages: record.pages.map((page) => ({
      id: page.legacy_id || String(page.id),
      title: cleanString(page.title, 120),
      slug: cleanString(page.slug, 200),
      published: page.published === true,
      sections: Array.isArray(page.sections) ? page.sections : [],
    })),
    content,
  };
}

function normalizeConfig(config = {}) {
  const theme = config.theme || {};
  const contact = config.contact || {};
  return {
    enabled: config.enabled !== false,
    template_id: "modern-church",
    site_name: cleanString(config.siteName || DEFAULT_CONFIG.siteName, 120),
    tagline: cleanString(config.tagline, 180),
    logo_url: cleanString(config.logoUrl, 1000),
    favicon_url: cleanString(config.faviconUrl, 1000),
    theme: {
      primary: cleanString(theme.primary, 30),
      secondary: cleanString(theme.secondary, 30),
      accent: cleanString(theme.accent, 30),
      headingFont: cleanString(theme.headingFont, 80) || "Poppins",
      bodyFont: "Poppins",
    },
    seo: config.seo || DEFAULT_CONFIG.seo,
    contact: {
      email: cleanString(contact.email, 160),
      phone: cleanString(contact.phone, 60),
      address: cleanString(contact.address, 300),
      mapsUrl: cleanString(contact.mapsUrl, 1000),
    },
    social: config.social || DEFAULT_CONFIG.social,
  };
}

async function getDraft(req, res, user) {
  const record = await loadWebsite(user);
  const content = await loadContent(record.church.id);
  return res.json({ success: true, data: toClientDraft(record, content) });
}

async function saveDraft(req, res, user) {
  const body = req.body || {};
  const record = await loadWebsite(user);
  const config = normalizeConfig(body.config || {});

  const { error: websiteError } = await supabaseAdmin
    .from("websites")
    .update({
      enabled: config.enabled,
      template_id: config.template_id,
      site_name: config.site_name,
      tagline: config.tagline,
      logo_url: config.logo_url,
      favicon_url: config.favicon_url,
      theme: config.theme,
      seo: config.seo,
      contact: config.contact,
      social: config.social,
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.website.id);
  if (websiteError) throw new Error(`SUPABASE_WEBSITE_SAVE_FAILED: ${websiteError.message}`);

  if (Array.isArray(body.navigation?.items)) {
    const items = body.navigation.items.slice(0, 30).map((item) => ({
      id: cleanString(item.id, 80),
      label: cleanString(item.label, 80),
      type: "page",
      target: cleanString(item.target, 200),
      visible: item.visible !== false,
    }));
    const { data: existingNav, error: navReadError } = await supabaseAdmin
      .from("website_navigation")
      .select("id")
      .eq("website_id", record.website.id)
      .maybeSingle();
    if (navReadError) throw navReadError;
    if (existingNav) {
      const { error } = await supabaseAdmin.from("website_navigation").update({ items, updated_at: new Date().toISOString() }).eq("id", existingNav.id);
      if (error) throw new Error(`SUPABASE_NAVIGATION_SAVE_FAILED: ${error.message}`);
    } else {
      const { error } = await supabaseAdmin.from("website_navigation").insert({ website_id: record.website.id, items });
      if (error) throw new Error(`SUPABASE_NAVIGATION_SAVE_FAILED: ${error.message}`);
    }
  }

  if (Array.isArray(body.pages)) {
    const pages = body.pages
      .filter((page) => page?.id)
      .slice(0, 30)
      .map((page) => ({
        website_id: record.website.id,
        legacy_id: cleanString(page.id, 80),
        title: cleanString(page.title, 120),
        slug: cleanString(page.slug || "/", 200),
        published: page.published === true,
        sections: Array.isArray(page.sections) ? page.sections.slice(0, 30) : [],
      }));

    const { error: upsertError } = await supabaseAdmin
      .from("website_pages")
      .upsert(pages, { onConflict: "website_id,slug" });
    if (upsertError) throw new Error(`SUPABASE_PAGES_SAVE_FAILED: ${upsertError.message}`);

    const incomingIds = new Set(pages.map((page) => page.legacy_id));
    const stale = record.pages.filter((page) => !incomingIds.has(page.legacy_id));
    if (stale.length) {
      const staleIds = stale.map((page) => page.id).filter(Boolean);
      const { error: staleDeleteError } = await supabaseAdmin.from("website_pages").delete().in("id", staleIds);
      if (staleDeleteError) throw new Error(`SUPABASE_PAGES_CLEANUP_FAILED: ${staleDeleteError.message}`);
    }
  }

  return res.json({ success: true, message: "Draft website berhasil disimpan" });
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (!["GET", "PUT"].includes(req.method)) {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const user = await requireChurchAdmin(req, res);
  if (!user) return;

  try {
    if (req.method === "GET") return await getDraft(req, res, user);
    return await saveDraft(req, res, user);
  } catch (error) {
    console.error("[WEBSITE DRAFT] request failed:", error);
    return res.status(500).json({ success: false, message: "WEBSITE_DRAFT_FAILED" });
  }
};