async function createChurchUser(userData) {
  if (!isAuthReady() || !_activeChurchId || !auth.currentUser) {
    throw new Error("Autentikasi atau churchId belum siap.");
  }

  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nama: userData.nama,
        username: userData.username,
        email: userData.email,
        password: userData.password,
        role: userData.role,
        churchId: _activeChurchId,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Gagal membuat user.");
    }
    return result.user;
  } catch (e) {
    console.error("[FIREBASE] createChurchUser:", e);
    throw e;
  }
}

async function updateChurchUser(uid, userData) {
  if (!isAuthReady() || !_activeChurchId || !auth.currentUser) {
    throw new Error("Autentikasi atau churchId belum siap.");
  }
  if (!uid) throw new Error("UID user tidak ditemukan.");

  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nama: userData.nama,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        churchId: _activeChurchId,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || `Gagal memperbarui user. (${response.status})`);
    }
    return result.user || result;
  } catch (e) {
    console.error("[FIREBASE] updateChurchUser:", e);
    throw e;
  }
}
