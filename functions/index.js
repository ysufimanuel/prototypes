const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const adminUsersRouter = require("./admin-users");

const app = express();
app.use(express.json());

app.use("/api/admin", adminUsersRouter);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "CMS V6 Backend hidup 🔥",
  });
});

exports.api = onRequest(app);
