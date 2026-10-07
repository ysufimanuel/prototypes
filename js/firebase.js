    }

    if (!response.ok) {
      throw new Error(result?.message || result?.error || "Gagal membuat user.");
    }

    return result.user;
  } catch (e) {
    console.error("[FIREBASE] createChurchUser:", e);
    throw e;
  }
}

async function updateChurchUser(uid, userData) {
  console.log("[FIREBASE] UPDATE USER PAYLOAD:", {
    uid,
    ...userData,
  });

  if (!isAuthReady() || !_activeChurchId) {
    console.error("[FIREBASE] Auth belum siap atau churchId kosong");
    return null;
  }

  if (!uid) throw new Error("UID user tidak ditemukan.");

  try {
    const token = await auth.currentUser.getIdToken(true);

    const response = await fetch(
      `/api/admin/users/${encodeURIComponent(uid)}`,
      {
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
      },
    );

    const responseText = await response.text();
    let result;

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch (_) {
      result = {
        success: false,
        message: responseText || `Server mengembalikan response tidak valid (${response.status}).`,
      };
    }

    if (!response.ok) {
      throw new Error(
        result.message || `Gagal memperbarui user. (${response.status})`,
      );
    }

    return result.user || result;
  } catch (e) {
    console.error("[FIREBASE] updateChurchUser:", e);
    throw e;
  }
}

async function deleteChurchUser(uid) {
  if (!isAuthReady() || !_activeChurchId) {
    console.error("[FIREBASE] Auth belum siap atau churchId kosong");
    return null;
  }

  if (!uid) throw new Error("UID user tidak ditemukan.");

  if (auth.currentUser?.uid === uid) {