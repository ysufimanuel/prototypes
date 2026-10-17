const { db } = require("../../_lib/firebase-admin");
const { requireChurchAdmin } = require("../../_lib/auth");
const { applyCors } = require("../../_lib/cors");
const { FieldValue } = require("firebase-admin/firestore");
const { supabaseAdmin } = require("../../_lib/supabase");

const now = () => FieldValue.serverTimestamp();
const cleanString = (value, max = 500) => String(value ?? "").trim().slice(0, max);

async function getChurch(user) {
  const { data, error } = await supabaseAdmin
    .from("churches")
    .select("id, legacy_id")
    .eq("legacy_id", user.churchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("CHURCH_NOT_FOUND");
  return data;
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

  const events = (eventsResult.data || [])
    .filter((event) => event.website?.published !== false)
    .map((event) => ({
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
      publishedAt: now(),
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
      updatedAt: now(),
    };
  });

  return { events, ministries };
}

async function replaceCollection(ref, items) {
  const existing = await ref.get();
  const operations = [];
  existing.docs.forEach((snap) => operations.push({ type: "delete", ref: snap.ref }));
  items.forEach((item) => operations.push({ type: "set", ref: ref.doc(item.id), data: item }));
  for (let i = 0; i < operations.length; i += 450) {
    const batch = db.batch();
    operations.slice(i, i + 450).forEach((operation) => {
      if (operation.type === "delete") batch.delete(operation.ref);
      else batch.set(operation.ref, operation.data);
    });
    await batch.commit();
  }
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method tidak diizinkan" });

  const user = await requireChurchAdmin(req, res);
  if (!user) return;

  try {
    const church = await getChurch(user);
    const content = await loadContent(church.id);
    const publicBase = db.collection("publicSites").doc(user.churchId);
    await replaceCollection(publicBase.collection("events"), content.events);
    await replaceCollection(publicBase.collection("ministries"), content.ministries);
    return res.json({
      success: true,
      eventCount: content.events.length,
      ministryCount: content.ministries.length,
      message: "Data Event dan Pelayanan berhasil dipublikasikan.",
    });
  } catch (error) {
    console.error("[WEBSITE PUBLISH CONTENT] Internal error:", { name: error?.name || null, message: error?.message || String(error) });
    return res.status(500).json({ success: false, message: error?.message || "Gagal mempublikasikan data website." });
  }
};
