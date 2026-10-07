const { applyCors } = require("./_lib/cors");

module.exports = function handler(req, res) {
  if (applyCors(req, res)) return;
  res.status(200).json({
    success: true,
    message: "CMS V6 Vercel Backend hidup 🔥",
  });
};
