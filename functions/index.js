const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const adminUsersRouter = require("./admin-users");

const app = express();

// The Hosting rewrite forwards /api/** to this function. Keep the /api
// prefix here so the same routes also work when calling the function URL
// directly during local development.
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "CMS V6 Backend hidup 🔥",
  });
});

// All user-management mutations are protected by requireSuperAdmin in
// admin-users.js. This is the server-side enforcement point for RBAC.
app.use("/api/admin", adminUsersRouter);

// Return JSON rather than an HTML error for unknown API routes.
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "API route tidak ditemukan." });
});

exports.api = onRequest(app);
