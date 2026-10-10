const PUBLIC_MESSAGES = {
  createUser: 'Gagal membuat user.',
  updateUser: 'Gagal memperbarui user.',
  deleteUser: 'Gagal menghapus user.',
};

function safeApiError(res, error, fallback, options = {}) {
  const code = error?.code;
  const allowed = options.allowed || {};
  const status = allowed[code] || 500;

  if (code && allowed[code]) {
    const message = options.messages?.[code] || fallback;
    return res.status(status).json({ success: false, message });
  }

  console.error('[API] Internal error:', error?.message || error);
  return res.status(500).json({ success: false, message: fallback });
}

module.exports = { PUBLIC_MESSAGES, safeApiError };
