const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const adminUsersRouter = require("./admin-users");

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "CMS V6 backend is healthy",
  });
});

app.use("/api/admin", adminUsersRouter);

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      success: false,
      message: "Request JSON tidak valid.",
    });
  }

  console.error("Unhandled API error", { message: error.message });
  return res.status(500).json({
    success: false,
    message: "Terjadi kesalahan pada server.",
  });
});

exports.api = onRequest(
  {
    region: "asia-southeast1",
  },
  app,
);
