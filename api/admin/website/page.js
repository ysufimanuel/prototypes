const { requireChurchAdmin } = require("../../_lib/auth");
const { applyCors } = require("../../_lib/cors");
const { supabaseAdmin } = require("../../_lib/supabase");

function cleanString(value, max = 500) { return String(value ?? "").trim().slice(0, max); }

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method !== "PUT") return res.status(405).json({ success: false, message: "Method Not Allowed" });

  const user = await requireChurchAdmin(req, res);
  if (!user) return;

  try {
    const page = req.body?.page;
    if (!page?.id) return res.status(400).json({ success: false, message: "PAGE_ID_REQUIRED" });

    const { data: church, error: churchError } = await supabaseAdmin
      .from("churches")
      .select("id")
      .eq("legacy_id", user.churchId)
      .maybeSingle();
    if (churchError) throw churchError;
    if (!church) return res.status(404).json({ success: false, message: "CHURCH_NOT_FOUND" });

    const { data: website, error: websiteError } = await supabaseAdmin
      .from("websites")
      .select("id")
      .eq("church_id", church.id)
      .maybeSingle();
    if (websiteError) throw websiteError;
    if (!website) return res.status(404).json({ success: false, message: "WEBSITE_NOT_FOUND" });

    const payload = {
      website_id: website.id,
      legacy_id: cleanString(page.id, 80),
      title: cleanString(page.title, 120),
      slug: cleanString(page.slug || "/", 200),
      published: page.published !== false,
      sections: Array.isArray(page.sections) ? page.sections.slice(0, 30) : [],
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("website_pages")
      .select("id")
      .eq("website_id", website.id)
      .eq("legacy_id", payload.legacy_id)
      .maybeSingle();
    if (existingError) throw existingError;

    let saved;
    if (existing) {
      const { data, error } = await supabaseAdmin.from("website_pages").update(payload).eq("id", existing.id).select("id, legacy_id, title, slug, published, sections").single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabaseAdmin.from("website_pages").insert(payload).select("id, legacy_id, title, slug, published, sections").single();
      if (error) throw error;
      saved = data;
    }

    await supabaseAdmin.from("websites").update({ updated_at: new Date().toISOString() }).eq("id", website.id);
    return res.json({ success: true, data: saved, message: "Page berhasil disimpan" });
  } catch (error) {
    console.error("[WEBSITE PAGE] save failed:", error);
    return res.status(500).json({ success: false, message: "WEBSITE_PAGE_SAVE_FAILED" });
  }
};
