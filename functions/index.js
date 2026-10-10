const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const adminUsersRouter = require("./admin-users");
const websiteRouter = require("./website");
const websiteEventsRouter = require("./website-events");
const websiteGroupsRouter = require("./website-groups");
const { requireAppCheck } = require("./app-check-middleware");

const app = express();
app.use(express.json());

// App Check is opt-in through APP_CHECK_ENFORCED=true so local emulator
// development remains usable. Production should enable enforcement after
// the web app is registered with a production App Check provider.
app.use("/api/admin", requireAppCheck);
app.use("/api/admin", adminUsersRouter);
app.use("/api/admin/website", websiteRouter);
app.use("/api/admin/website", websiteEventsRouter);
app.use("/api/admin/website", websiteGroupsRouter);

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "CMS V6 Backend hidup 🔥" });
});

exports.api = onRequest(app);
