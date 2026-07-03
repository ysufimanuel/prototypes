/**
 * ============================================================
 * REALTIME FIREBASE PATCH + BIRTHDAY NOTIFICATION
 * Church Management System — Patch Layer
 *
 * Cara kerja:
 * 1. Override dataCache secara real-time via onSnapshot
 * 2. Setiap perubahan di Firestore langsung refresh UI
 * 3. Cek ulang tahun member saat login & setiap hari
 * ============================================================
 *
 * INSTRUKSI PEMASANGAN di index.html:
 *   Letakkan tag script ini SETELAH firebase.js dan app.js:
 *   <script type="module" src="realtime-firebase.js"></script>
 */

(function () {
    'use strict';

    // =========================================================
    // KONFIGURASI
    // =========================================================

    /** Koleksi yang didengarkan secara real-time */
    const REALTIME_COLLECTIONS = [
        'members', 'families', 'groups', 'events',
        'attendance', 'donations', 'donors', 'volunteers',
        'assignments', 'announcements', 'pemasukan',
        'pengeluaran', 'financeCategories', 'notifications',
        'approvalHistory'
    ];

    /** Map koleksi → field di dataCache */
    const COLLECTION_TO_CACHE_KEY = {
        members: 'members',
        families: 'families',
        groups: 'groups',
        events: 'events',
        attendance: 'attendance',
        donations: 'donations',
        donors: 'donors',
        volunteers: 'volunteers',
        assignments: 'assignments',
        announcements: 'announcements',
        pemasukan: 'pemasukan',
        pengeluaran: 'pengeluaran',
        financeCategories: 'financeCategories',
        notifications: 'notifications',
        approvalHistory: 'approvalHistory',
    };

    /** Map koleksi → fungsi render yang harus dipanggil */
    const COLLECTION_TO_RENDER = {
        members: ['renderMembersTable', 'initDashboard'],
        families: ['renderFamiliesGrid', 'initDashboard'],
        groups: ['renderGroupsGrid', 'initDashboard'],
        events: ['renderEventsGrid', 'initDashboard'],
        attendance: ['renderAttendanceTable', 'initDashboard'],
        donations: ['renderDonationsTable', 'initDashboard'],
        donors: ['renderDonationsTable', 'initDashboard'],
        volunteers: ['renderVolunteersGrid', 'initDashboard'],
        assignments: ['renderVolunteersGrid'],
        announcements: ['renderAnnouncementsList'],
        pemasukan: ['initDashboard'],
        pengeluaran: ['initDashboard'],
        financeCategories: [],
        notifications: ['renderNotifications', 'updateNotificationBadge'],
        approvalHistory: [],
    };

    // =========================================================
    // STATE
    // =========================================================

    let _unsubscribers = [];          // onSnapshot unsubscribe fns
    let _birthdayChecked = false;     // cegah cek berulang hari ini
    let _birthdayCheckDate = null;    // tanggal terakhir dicek

    // =========================================================
    // UTIL — tunggu sampai kondisi terpenuhi
    // =========================================================

    function waitFor(conditionFn, timeout = 15000, interval = 200) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const id = setInterval(() => {
                if (conditionFn()) { clearInterval(id); resolve(); }
                else if (Date.now() - start > timeout) {
                    clearInterval(id);
                    reject(new Error('[RTFB] waitFor timeout'));
                }
            }, interval);
        });
    }

    // =========================================================
    // REAL-TIME LISTENERS
    // =========================================================

    /**
     * Mulai mendengarkan semua koleksi.
     * Dipanggil setelah login berhasil & churchId aktif.
     */
    function startRealtimeListeners() {
        stopRealtimeListeners(); // bersihkan listener lama

        if (!window.isFirebaseReady || !window.isFirebaseReady()) {
            console.warn('[RTFB] Firebase belum siap — real-time listeners dilewati');
            return;
        }
        if (!window.getActiveChurchId || !window.getActiveChurchId()) {
            console.warn('[RTFB] churchId belum di-set — real-time listeners dilewati');
            return;
        }

        console.log('[RTFB] Memulai real-time listeners…');

        REALTIME_COLLECTIONS.forEach(colName => {
            try {
                const unsub = window.onCollectionSnapshot(colName, (docs) => {
                    _handleCollectionUpdate(colName, docs);
                });
                _unsubscribers.push(unsub);
            } catch (err) {
                console.error(`[RTFB] Gagal listen ${colName}:`, err);
            }
        });

        // Juga dengarkan financeConfig (single doc) secara terpisah
        _listenFinanceConfig();

        console.log(`[RTFB] ${_unsubscribers.length} listener aktif`);
    }

    /** Hentikan semua listener aktif */
    function stopRealtimeListeners() {
        _unsubscribers.forEach(fn => { try { fn(); } catch (_) {} });
        _unsubscribers = [];
        console.log('[RTFB] Semua listener dihentikan');
    }

    /** Single-doc listener untuk financeConfig */
    function _listenFinanceConfig() {
        if (!window.firebaseOnSnapshot || !window.firebaseDoc || !window.db || !window.getActiveChurchId) return;
        try {
            const ref = window.firebaseDoc(
                window.db, 'churches', window.getActiveChurchId(), 'financeConfig', 'config'
            );
            const unsub = window.firebaseOnSnapshot(ref, (snap) => {
                if (snap.exists()) {
                    const cfg = { id: snap.id, ...snap.data() };
                    if (window.dataCache) window.dataCache.finance = cfg;
                }
            });
            _unsubscribers.push(unsub);
        } catch (err) {
            console.error('[RTFB] financeConfig listener error:', err);
        }
    }

    /**
     * Dipanggil setiap kali snapshot berubah.
     * Update dataCache lalu trigger render yang sesuai.
     */
    function _handleCollectionUpdate(colName, docs) {
        // Pastikan dataCache ada
        if (!window.dataCache) window.dataCache = {};

        const cacheKey = COLLECTION_TO_CACHE_KEY[colName];
        if (!cacheKey) return;

        window.dataCache[cacheKey] = docs;

        // Khusus notifications — update state internal app.js juga
        if (colName === 'notifications') {
            _syncNotificationsState(docs);
            return; // renderNotifications sudah dipanggil di dalam _syncNotificationsState
        }

        // Trigger render fungsi yang relevan
        const renders = COLLECTION_TO_RENDER[colName] || [];
        renders.forEach(fnName => {
            if (typeof window[fnName] === 'function') {
                try { window[fnName](); } catch (e) {
                    console.warn(`[RTFB] ${fnName}() error:`, e);
                }
            }
        });

        // Cek ulang tahun setiap kali data members berubah
        if (colName === 'members') {
            _checkBirthdays(docs);
        }
    }

    // =========================================================
    // SYNC NOTIFICATION STATE (agar badge & dropdown sinkron)
    // =========================================================

    function _syncNotificationsState(docs) {
        // app.js menyimpan notifications & unreadCount di scope-nya
        // Kita update lewat window jika tersedia, atau lewat loadNotifications()
        if (typeof window.loadNotifications === 'function') {
            // loadNotifications sudah mengambil dari Firebase — panggil saja
            // Tapi ini async dan akan re-fetch; lebih efisien update langsung:
            try {
                // Update variabel internal jika bisa
                const sorted = [...docs].sort(
                    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
                );
                // Coba set via setter jika ada, atau fallback ke loadNotifications
                if (typeof window._setNotificationsState === 'function') {
                    window._setNotificationsState(sorted);
                } else {
                    window.loadNotifications();
                }
            } catch (_) {
                window.loadNotifications();
            }
        }
    }

    // =========================================================
    // BIRTHDAY NOTIFICATION
    // =========================================================

    /**
     * Cek ulang tahun member hari ini.
     * Tambah notifikasi Firebase jika belum ada notif hari ini.
     */
    async function _checkBirthdays(members) {
        if (!window.isFirebaseReady || !window.isFirebaseReady()) return;
        if (!window.addNotification) return;

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

        // Cegah cek berulang dalam satu hari
        if (_birthdayChecked && _birthdayCheckDate === todayStr) return;
        _birthdayChecked = true;
        _birthdayCheckDate = todayStr;

        const todayMonth = today.getMonth() + 1; // 1-12
        const todayDay = today.getDate();

        const birthdayMembers = (members || []).filter(m => {
            if (!m.tglLahir || m.status !== 'aktif') return false;
            try {
                const [, mm, dd] = m.tglLahir.split('-').map(Number);
                return mm === todayMonth && dd === todayDay;
            } catch (_) { return false; }
        });

        if (birthdayMembers.length === 0) return;

        console.log(`[RTFB] Ditemukan ${birthdayMembers.length} ulang tahun hari ini`);

        // Cek notifikasi yang sudah ada hari ini untuk menghindari duplikat
        let existingNotifs = [];
        try {
            existingNotifs = await window.getNotifications() || [];
        } catch (_) {}

        const existingBirthdayIds = new Set(
            existingNotifs
                .filter(n => n.type === 'birthday' && n.date === todayStr)
                .map(n => n.memberId)
        );

        for (const member of birthdayMembers) {
            if (existingBirthdayIds.has(String(member.id))) continue; // sudah ada

            const age = _calcAge(member.tglLahir);
            const ageText = age > 0 ? ` (${age} tahun)` : '';

            await window.addNotification({
                title: '🎂 Ulang Tahun Jemaat',
                message: `${member.nama}${ageText} berulang tahun hari ini! Berikan ucapan selamat.`,
                type: 'birthday',
                memberId: String(member.id),
                date: todayStr,
                timestamp: new Date().toISOString(),
                read: false
            });

            console.log(`[RTFB] Notifikasi ulang tahun dikirim: ${member.nama}`);
        }

        // Tampilkan toast ringkasan
        if (birthdayMembers.length === 1) {
            _showBirthdayToast(birthdayMembers[0]);
        } else if (birthdayMembers.length > 1) {
            _showToastSafe(
                `🎂 ${birthdayMembers.length} jemaat berulang tahun hari ini!`,
                'info'
            );
        }
    }

    function _calcAge(tglLahir) {
        if (!tglLahir) return 0;
        const today = new Date();
        const birth = new Date(tglLahir);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    }

    function _showBirthdayToast(member) {
        const age = _calcAge(member.tglLahir);
        const msg = age > 0
            ? `🎂 Selamat ulang tahun ke-${age} untuk ${member.nama}!`
            : `🎂 Selamat ulang tahun untuk ${member.nama}!`;
        _showToastSafe(msg, 'info');
    }

    function _showToastSafe(msg, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else {
            console.info(`[RTFB] Toast: ${msg}`);
        }
    }

    // =========================================================
    // PATCH renderNotifications — tambah ikon 🎂 untuk ulang tahun
    // =========================================================

    function _patchRenderNotifications() {
        const origRender = window.renderNotifications;
        if (!origRender) return;

        window.renderNotifications = function () {
            origRender(); // panggil fungsi asli dulu

            // Tambahkan warna/ikon khusus birthday setelah render
            document.querySelectorAll('.notif-item').forEach(item => {
                const titleEl = item.querySelector('.notif-title');
                if (titleEl && titleEl.textContent.includes('Ulang Tahun')) {
                    item.style.borderLeft = '4px solid #ff9800';
                    const iconEl = item.querySelector('.notif-icon i');
                    if (iconEl) {
                        iconEl.className = 'fas fa-birthday-cake';
                        iconEl.style.color = '#ff9800';
                    }
                }
            });
        };

        console.log('[RTFB] renderNotifications di-patch ✓');
    }

    // =========================================================
    // PATCH _showMainApp — mulai listeners setelah login
    // =========================================================

    function _patchShowMainApp() {
        const orig = window._showMainApp;
        if (!orig) {
            console.warn('[RTFB] _showMainApp tidak ditemukan, mencoba lagi…');
            return false;
        }

        window._showMainApp = async function (user) {
            orig(user); // jalankan logika asli

            // Tunggu churchId aktif lalu mulai listeners
            try {
                await waitFor(() =>
                    window.getActiveChurchId && !!window.getActiveChurchId(),
                    5000
                );
                startRealtimeListeners();

                // Cek ulang tahun segera setelah login
                _birthdayChecked = false;
                const members = window.dataCache?.members || [];
                if (members.length > 0) {
                    await _checkBirthdays(members);
                }
            } catch (e) {
                console.warn('[RTFB] Gagal start listeners setelah login:', e);
            }
        };

        console.log('[RTFB] _showMainApp di-patch ✓');
        return true;
    }

    // =========================================================
    // PATCH logout — hentikan listeners
    // =========================================================

    function _patchLogout() {
        const orig = window.logout;
        if (!orig) return;

        window.logout = async function () {
            stopRealtimeListeners();
            _birthdayChecked = false;
            await orig();
        };

        console.log('[RTFB] logout di-patch ✓');
    }

    // =========================================================
    // SCHEDULE BIRTHDAY CHECK HARIAN (jam 00:01)
    // =========================================================

    function _scheduleDailyBirthdayCheck() {
        const now = new Date();
        const next = new Date(now);
        next.setDate(next.getDate() + 1);
        next.setHours(0, 1, 0, 0); // jam 00:01 esok hari
        const ms = next - now;

        setTimeout(() => {
            _birthdayChecked = false; // reset flag
            const members = window.dataCache?.members || [];
            if (members.length > 0) _checkBirthdays(members);

            // Jadwalkan lagi untuk hari berikutnya
            _scheduleDailyBirthdayCheck();
        }, ms);

        console.log(`[RTFB] Cek ulang tahun berikutnya: ${next.toLocaleString('id-ID')}`);
    }

    // =========================================================
    // EXPOSE API ke window (opsional, untuk debugging)
    // =========================================================

    window.rtfb = {
        startRealtimeListeners,
        stopRealtimeListeners,
        checkBirthdaysNow: () => {
            _birthdayChecked = false;
            _checkBirthdays(window.dataCache?.members || []);
        }
    };

    // =========================================================
    // INIT — jalankan setelah DOM + app.js siap
    // =========================================================

    async function init() {
        console.log('[RTFB] Patch layer initializing…');

        // Tunggu app.js selesai define fungsi-fungsinya
        try {
            await waitFor(() =>
                typeof window._showMainApp === 'function' &&
                typeof window.loadNotifications === 'function',
                10000
            );
        } catch (e) {
            console.error('[RTFB] app.js functions tidak ditemukan dalam 10 detik:', e);
            return;
        }

        // Terapkan semua patch
        _patchRenderNotifications();
        _patchLogout();

        // Patch _showMainApp dengan retry karena bisa jadi belum terdefinisi
        const patched = _patchShowMainApp();
        if (!patched) {
            setTimeout(() => {
                _patchShowMainApp();
            }, 1000);
        }

        // Jika user sudah login (session restore), mulai listeners langsung
        try {
            await waitFor(() =>
                window.getActiveChurchId && !!window.getActiveChurchId(),
                3000
            );
            console.log('[RTFB] Session aktif — mulai listeners langsung');
            startRealtimeListeners();

            // Cek ulang tahun
            await waitFor(() => !!window.dataCache?.members, 5000);
            await _checkBirthdays(window.dataCache.members);
        } catch (_) {
            console.log('[RTFB] Tidak ada session aktif — listeners akan dimulai setelah login');
        }

        // Jadwalkan pengecekan harian
        _scheduleDailyBirthdayCheck();

        console.log('[RTFB] ✅ Patch layer aktif — real-time & birthday notification siap');
    }

    // Jalankan setelah DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM sudah siap (script dimuat async/defer)
        setTimeout(init, 100);
    }

})();
