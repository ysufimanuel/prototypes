function safeApiError(res, error, fallback, options = {}) {
  const code = error?.code;
  const allowed = options.allowed || {};

  if (code && Object.prototype.hasOwnProperty.call(allowed, code)) {
    return res.status(allowed[code]).json({
      success: false,
      message: options.messages?.[code] || fallback,
    });
  }

  console.error("[API] Internal error:", error?.message || error);
  return res.status(500).json({ success: false, message: fallback });
}

module.exports = { safeApiError };
