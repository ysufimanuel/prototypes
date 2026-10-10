const buckets = new Map();

function getClientKey(req) {
  return String(req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function rateLimit({ windowMs = 60_000, max = 20, message = 'Terlalu banyak permintaan. Coba lagi nanti.' } = {}) {
  return (req, res, next) => {
    const key = getClientKey(req);
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || now - current.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, message });
    }

    return next();
  };
}

function resetRateLimitStore() {
  buckets.clear();
}

module.exports = { rateLimit, resetRateLimitStore };
