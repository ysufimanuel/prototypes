const { db } = require("../../_lib/firebase-admin");
const { requireChurchAdmin } = require("../../_lib/auth");
const { applyCors } = require("../../_lib/cors");

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

const DEFAULT_NAVIGATION = {
  items: [
    { id: "home", label: "Home", type: "page", target: "/" },
    { id: "new-to-church", label: "New to Church", type: "page", target: "/new-to-church" },
    { id: "connect", label: "Connect", type: "page", target: "/connect" },
    { id: "grow", label: "Grow", type: "page", target: "/grow" },
    { id: "ministries", label: "Ministries", type: "page", target: "/ministries" },
    { id: "resources", label: "Resources", type: "page", target: "/resources" },
  ],
};

const DEFAULT_PAGES = [
  { id: "home", title: "Home", slug: "/", published: true, sections: [] },
  { id: "new-to-church", title: "New to Church", slug: "/new-to-church", published: true, sections: [] },
  { id: "connect", title: "Connect", slug: "/connect", published: true, sections: [] },
  { id: "grow", title: "Grow", slug: "/grow", published: true, sections: [] },
  { id: "ministries", title: "Ministries", slug: "/ministries", published: true, sections: [] },
  { id: "resources", title: "Resources", slug: "/resources", published: true, sections: [] },
];

function cleanString(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function getRoutePath(req) {
  const queryPath = req.query?.path;
  if (Array.isArray(queryPath)) return queryPath.join("/");
  if (typeof queryPath === "string" && queryPath) return queryPath.replace(/^\/+|\/+$/g, "");

  const rawUrl = String(req.url || "").split("?", 1)[0];
  const prefix = "/api/admin/website-firebase/";
  if (!rawUrl.startsWith(prefix)) return "";
  return decodeURIComponent(rawUrl.slice(prefix.length)).replace(/^\/+|\/+$/g, "");
}

async function getDraft(user) {
  const churchRef = db.collection("churches").doc(user.churchId);
  const base = churchRef.collection("website");
  const pagesRef = base.doc("content").collection("pages");
  const [churchSnap, configSnap, navSnap, pagesSnap] = await Promise.all([
    churchRef.get(),
    base.doc("config").get(),
    base.doc("navigation").get(),
    pagesRef.get(),
  ]);

  if (!churchSnap.exists) throw new Error("CHURCH_NOT_FOUND");
  const church = churchSnap.data() || {};

  return {
    church: {
      id: user.churchId,
      name: cleanString(church.nama || church.name || church.churchName || "Gereja Digital", 120),
      website: church.website || {},
    },
    config: configSnap.exists ? configSnap.data() : DEFAULT_CONFIG,
    navigation: navSnap.exists ? navSnap.data() : DEFAULT_NAVIGATION,
    pages: pagesSnap.empty
      ? DEFAULT_PAGES
      : pagesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" || getRoutePath(req) !== "draft") {
    return res.status(404).json({ success: false, message: "Route tidak tersedia pada Firebase draft adapter." });
  }

  const user = await requireChurchAdmin(req, res);
  if (!user) return;

  try {
    const data = await getDraft(user);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("[WEBSITE-FIREBASE] GET /draft gagal:", {
      name: error?.name || null,
      message: error?.message || "Unknown error",
    });
    return res.status(500).json({ success: false, message: "Gagal memuat website draft dari Firebase." });
  }
};
