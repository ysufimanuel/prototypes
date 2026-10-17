const { requireChurchAdmin } = require("../../_lib/auth");
const { applyCors } = require("../../_lib/cors");
const { supabaseAdmin } = require("../../_lib/supabase");

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method Not Allowed" });

  const user = await requireChurchAdmin(req, res);
  if (!user) return;

  try {
    const { data: church, error: churchError } = await supabaseAdmin
      .from("churches")
      .select("id, legacy_id")
      .eq("legacy_id", user.churchId)
      .maybeSingle();
    if (churchError) throw churchError;
    if (!church) return res.status(404).json({ success: false, message: "CHURCH_NOT_FOUND" });

    const { data: website, error: websiteError } = await supabaseAdmin
      .from("websites")
      .select("id, enabled, status")
      .eq("church_id", church.id)
      .maybeSingle();
    if (websiteError) throw websiteError;
    if (!website) return res.status(404).json({ success: false, message: "WEBSITE_NOT_FOUND" });

    // The root page is the public entry point and must remain publishable.
    const { error: homeError } = await supabaseAdmin
      .from("website_pages")
      .update({ published: true, updated_at: new Date().toISOString() })
      .eq("website_id", website.id)
      .eq("slug", "/");
    if (homeError) throw homeError;

    const { error: statusError } = await supabaseAdmin
      .from("websites")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", website.id);
    if (statusError) throw statusError;

    return res.json({ success: true, message: "Website berhasil dipublikasikan", slug: user.churchId });
  } catch (error) {
    console.error("[WEBSITE PUBLISH SUPABASE]", error);
    return res.status(500).json({ success: false, message: "WEBSITE_PUBLISH_FAILED" });
  }
};
