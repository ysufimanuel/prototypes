const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");

const app = express();

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "CMS V6 Backend hidup 🔥",
  });
});

exports.api = onRequest(app);
