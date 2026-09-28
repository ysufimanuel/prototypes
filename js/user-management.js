/**
 * User Management Module
 * RBAC: Only Superadmin can manage users and change roles
 */

let editingUserId = null;

// ========================================
// MODAL MANAGEMENT
// ========================================

function showAddUserModal() {
  if (!canManageUsers()) {
    showToast(
      currentLanguage === "id"
        ? "Anda tidak memiliki akses ke User Management"
        : "You do not have access to User Management",
      "error",
    );
    return;
  }

  editingUserId = null;
  document.getElementById("user-id").value = "";
  document.getElementById("user-nama").value = "";
  document.getElementById("user-username").value = "";
  document.getElementById("user-email").value = "";
  document.getElementById("user-password").value = "";
  document.getElementById("user-role").value = "user";

  document.getElementById("password-required").textContent = "*";
  document.getElementById("password-hint").textContent =
    currentLanguage === "id"
      ? "Password minimal 4 karakter"
      : "Password minimum 4 characters";
  document.getElementById("user-password").required = true;

  document.getElementById("modal-user-title").textContent =
    currentLanguage === "id" ? "Tambah User Baru" : "Add New User";

  openModal("modal-user");
}

function editUser(uid) {
  if (!canManageUsers()) {
    showToast(
      currentLanguage === "id"
        ? "Anda tidak memiliki akses ke User Management"
        : "You do not have access to User Management",
      "error",
    );
    return;
  }

  // Load from Firebase real-time data (via dataCache)
  let user = null;
  if (window.dataCache?.users) {
    user = window.dataCache.users.find((u) => u.uid === uid);
  }

  if (!user) {
    showToast(
      currentLanguage === "id" ? "User tidak ditemukan" : "User not found",
      "error",
    );
    return;
  }

  editingUserId = uid;
  document.getElementById("user-id").value = uid;
  document.getElementById("user-nama").value = user.nama || "";
  document.getElementById("user-username").value = user.username || "";
  document.getElementById("user-email").value = user.email || "";
  document.getElementById("user-password").value = "";
  document.getElementById("user-role").value = user.role || "user";

  // Password is optional for updates
  document.getElementById("password-required").textContent = "";
  document.getElementById("password-hint").textContent =
    currentLanguage === "id"
      ? "Biarkan kosong jika tidak ingin mengubah password"
      : "Leave empty to keep current password";
  document.getElementById("user-password").required = false;

  document.getElementById("modal-user-title").textContent =
    currentLanguage === "id" ? "Edit User" : "Edit User";

  openModal("modal-user");
}

// ========================================
// SAVE / CREATE / UPDATE
// ========================================

async function saveUser(event) {
  event.preventDefault();

  if (!canManageUsers()) {
    showToast(
      currentLanguage === "id"
        ? "Anda tidak memiliki akses ke User Management"
        : "You do not have access to User Management",
      "error",
    );
    return;
  }

  const uid = document.getElementById("user-id").value;
  const nama = document.getElementById("user-nama").value.trim();
  const username = document.getElementById("user-username").value.trim();
  const email = document.getElementById("user-email").value.trim();
  const password = document.getElementById("user-password").value.trim();
  const role = document.getElementById("user-role").value;

  if (!nama || !username || !email || !role) {
    showToast(
      currentLanguage === "id"
        ? "Silakan isi semua field yang diperlukan"
        : "Please fill in all required fields",
      "error",
    );
    return;
  }

  const isNew = !uid;

  if (isNew && !password) {
    showToast(
      currentLanguage === "id"
        ? "Password harus diisi untuk user baru"
        : "Password is required for new users",
      "error",
    );
    return;
  }

  showLoadingOverlay(true);

  try {
    if (isNew) {
      // CREATE new user via Firebase API
      const userData = {
        nama,
        username,
        email,
        password,
        role,
      };

      const newUser = await window.createChurchUser(userData);

      showToast(
        currentLanguage === "id"
          ? `User ${nama} berhasil dibuat`
          : `User ${nama} created successfully`,
        "success",
      );
    } else {
      // UPDATE existing user via Firebase API
      const userData = {
        nama,
        username,
        email,
        role,
      };

      if (password) {
        userData.password = password;
      }

      await window.updateChurchUser(uid, userData);

      showToast(
        currentLanguage === "id"
          ? `User ${nama} berhasil diperbarui`
          : `User ${nama} updated successfully`,
        "success",
      );
    }

    closeModal("modal-user");
    editingUserId = null;
    renderUsersGrid();
  } catch (error) {
    console.error("[USER-MGMT] Save error:", error);
    showToast(
      currentLanguage === "id"
        ? `Error: ${error.message}`
        : `Error: ${error.message}`,
      "error",
    );
  } finally {
    showLoadingOverlay(false);
  }
}

// ========================================
// DELETE
// ========================================

async function deleteUser(uid) {
  if (!canManageUsers()) {
    showToast(
      currentLanguage === "id"
        ? "Anda tidak memiliki akses ke User Management"
        : "You do not have access to User Management",
      "error",
    );
    return;
  }

  // Load from Firebase real-time data
  let user = null;
  if (window.dataCache?.users) {
    user = window.dataCache.users.find((u) => u.uid === uid);
  }

  if (!user) {
    showToast(
      currentLanguage === "id" ? "User tidak ditemukan" : "User not found",
      "error",
    );
    return;
  }

  if (user.uid === currentUser.uid) {
    showToast(
      currentLanguage === "id"
        ? "Tidak dapat menghapus akun sendiri"
        : "You cannot delete your own account",
      "error",
    );
    return;
  }

  showConfirm(
    currentLanguage === "id"
      ? `Hapus user ${user.nama}? Tindakan ini tidak dapat dibatalkan.`
      : `Delete user ${user.nama}? This action cannot be undone.`,
    async () => {
      showLoadingOverlay(true);
      try {
        await window.deleteChurchUser(uid);

        showToast(
          currentLanguage === "id"
            ? `User ${user.nama} berhasil dihapus`
            : `User ${user.nama} deleted successfully`,
          "success",
        );

        renderUsersGrid();
      } catch (error) {
        console.error("[USER-MGMT] Delete error:", error);
        showToast(
          currentLanguage === "id"
            ? `Error: ${error.message}`
            : `Error: ${error.message}`,
          "error",
        );
      } finally {
        showLoadingOverlay(false);
      }
    },
  );
}

// ========================================
// SEARCH & FILTER
// ========================================

function searchUsers() {
  renderUsersGrid();
}

// ========================================
// RENDER USERS GRID (Firebase data)
// ========================================

function renderUsersGrid() {
  if (!canManageUsers()) {
    return;
  }

  const container = document.getElementById("users-grid");
  if (!container) return;

  // Use Firebase real-time data from dataCache if available
  const users = window.dataCache?.users || [];
  const searchTerm =
    document.getElementById("search-users")?.value?.toLowerCase() || "";

  const filtered = users.filter(
    (u) =>
      u.nama.toLowerCase().includes(searchTerm) ||
      u.username.toLowerCase().includes(searchTerm) ||
      u.email.toLowerCase().includes(searchTerm),
  );

  const roleLabels = {
    superadmin: currentLanguage === "id" ? "Super Admin" : "Super Admin",
    admin: currentLanguage === "id" ? "Admin" : "Admin",
    user: currentLanguage === "id" ? "User (View Only)" : "User (View Only)",
  };

  const roleColors = {
    superadmin: "danger",
    admin: "warning",
    user: "info",
  };

  container.innerHTML =
    filtered
      .map(
        (u) => `
        <div class="user-card">
            <div class="card-header-section">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(u.nama)}&background=ff6b00&color=fff&size=50" class="card-avatar-img" alt="">
                <div class="card-title">
                    <h4>${u.nama}</h4>
                    <p>@${u.username}</p>
                </div>
            </div>
            <div class="card-info">
                <div class="info-row"><i class="fas fa-envelope"></i> ${u.email}</div>
                <div class="info-row"><i class="fas fa-shield-alt"></i> <span class="badge badge-${roleColors[u.role] || "secondary"}">${roleLabels[u.role] || u.role}</span></div>
                <div class="info-row"><i class="fas fa-circle"></i> <span class="badge badge-${u.status === "aktif" ? "success" : "secondary"}">${u.status === "aktif" ? (currentLanguage === "id" ? "Aktif" : "Active") : currentLanguage === "id" ? "Nonaktif" : "Inactive"}</span></div>
            </div>
            <div class="card-footer-actions">
                <button class="btn btn-secondary btn-sm" onclick="editUser('${u.uid}")><i class="fas fa-edit"></i> ${currentLanguage === "id" ? "Edit" : "Edit"}</button>
                ${u.uid !== currentUser.uid ? `<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.uid}")><i class="fas fa-trash"></i> ${currentLanguage === "id" ? "Hapus" : "Delete"}</button>` : ""}
            </div>
        </div>
    `,
      )
      .join("") ||
    `<p class="text-center" style="grid-column: 1/-1; color: var(--text-muted); padding: 30px;">${currentLanguage === "id" ? "Belum ada user" : "No users yet"}</p>`;
}

// ========================================
// SHOW LOADING OVERLAY
// ========================================

function showLoadingOverlay(show) {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    if (show) {
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
    }
  }
}

console.log("[USER-MGMT] Module loaded");
