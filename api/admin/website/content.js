const { requireChurchAdmin } = require("../../_lib/auth");
const { applyCors } = require("../../_lib/cors");
const { supabaseAdmin } = require("../../_lib/supabase");

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method Not Allowed" });

  const user = await requireChurchAdmin(req, res);
  if (!user) return;

  try {
    const { data: church, error: churchError } = await supabaseAdmin
      .from("churches")
      .select("id")
      .eq("legacy_id", user.churchId)
      .maybeSingle();
    if (churchError) throw churchError;
    if (!church) return res.status(404).json({ success: false, message: "CHURCH_NOT_FOUND" });

    const [eventsResult, groupsResult] = await Promise.all([
      supabaseAdmin
        .from("events")
        .select("id, legacy_id, nama, tipe, custom_type, starts_at, ends_at, lokasi, deskripsi, status, website")
        .eq("church_id", church.id)
        .order("starts_at", { ascending: true })
        .limit(300),
      supabaseAdmin
        .from("groups")
        .select("id, legacy_id, nama, deskripsi, jadwal, leader_id")
        .eq("church_id", church.id)
        .order("id", { ascending: true })
        .limit(300),
    ]);
    if (eventsResult.error) throw eventsResult.error;
    if (groupsResult.error) throw groupsResult.error;

    const events = (eventsResult.data || [])
      .filter((event) => event.website?.published !== false)
      .map((event) => ({
        id: event.legacy_id || String(event.id),
        nama: event.nama,
        tipe: event.tipe || event.custom_type || "event",
        start: event.starts_at,
        end: event.ends_at,
        lokasi: event.lokasi,
        deskripsi: event.deskripsi,
        status: event.status,
      }));

    const ministries = (groupsResult.data || []).map((group) => ({
      id: group.legacy_id || String(group.id),
      name: group.nama,
      description: group.deskripsi,
      schedule: group.jadwal,
      leader: group.leader_id ? { id: String(group.leader_id) } : null,
    }));

    return res.setHeader("Cache-Control", "no-store").json({
      success: true,
      data: { events, ministries },
    });
  } catch (error) {
    console.error("[WEBSITE CONTENT] Supabase lookup failed:", error);
    return res.status(500).json({ success: false, message: "WEBSITE_CONTENT_LOAD_FAILED" });
  }
};
