const buckets = new Map();

function getClientKey(req) {
  return String(
    req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "unknown",
  )
    .split(",")[0]
    .trim();
}

function checkRateLimit(req, res, { windowMs = 60_000, max = 20 } = {}) {
  const key = getClientKey(req);
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }

  current.count += 1;
  if (current.count > max) {
    const retryAfter = Math.max(
      1,
      Math.ceil((windowMs - (now - current.startedAt)) / 1000),
    );
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      success: false,
      message: "Terlalu banyak permintaan. Coba lagi nanti.",
    });
    return false;
  }

  return true;
}

module.exports = { checkRateLimit };
