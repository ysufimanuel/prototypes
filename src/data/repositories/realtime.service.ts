/**
 * Real-time Sync Service + Birthday Notification
 * Menggantikan realtime-firebase.js
 */

import { subscribeToCollection, addDocument, queryDocuments, getActiveChurchId, subscribeToDocument } from './base.repository';
import { store } from '@/core/store';
import { DB_COLLECTIONS } from '@/core/config';
import type { Member, Notification } from '@/types/models';

let unsubscribers: (() => void)[] = [];
let birthdayChecked = false;
let birthdayCheckDate: string | null = null;

/**
 * Start real-time listeners untuk semua koleksi
 */
export function startRealtimeSync(): () => void {
  stopRealtimeSync(); // Bersihkan listener lama

  const churchId = getActiveChurchId();
  if (!churchId) {
    console.warn('[RT] churchId belum di-set');
    return () => {};
  }

  console.log('[RT] Memulai real-time sync...');

  // Subscribe ke semua koleksi utama
  const collections = [
    { name: DB_COLLECTIONS.MEMBERS, key: 'members' as const },
    { name: DB_COLLECTIONS.FAMILIES, key: 'families' as const },
    { name: DB_COLLECTIONS.GROUPS, key: 'groups' as const },
    { name: DB_COLLECTIONS.EVENTS, key: 'events' as const },
    { name: DB_COLLECTIONS.ATTENDANCE, key: 'attendance' as const },
    { name: DB_COLLECTIONS.DONATIONS, key: 'donations' as const },
    { name: DB_COLLECTIONS.DONORS, key: 'donors' as const },
    { name: DB_COLLECTIONS.VOLUNTEERS, key: 'volunteers' as const },
    { name: DB_COLLECTIONS.ASSIGNMENTS, key: 'assignments' as const },
    { name: DB_COLLECTIONS.ANNOUNCEMENTS, key: 'announcements' as const },
    { name: DB_COLLECTIONS.PEMASUKAN, key: 'pemasukan' as const },
    { name: DB_COLLECTIONS.PENGELUARAN, key: 'pengeluaran' as const },
    { name: DB_COLLECTIONS.FINANCE_CATEGORIES, key: 'financeCategories' as const },
    { name: DB_COLLECTIONS.APPROVAL_HISTORY, key: 'approvalHistory' as const },
    { name: DB_COLLECTIONS.DEATHS, key: 'deaths' as const },
    { name: DB_COLLECTIONS.NOTIFICATIONS, key: 'notifications' as const },
  ];

  collections.forEach(({ name, key }) => {
    try {
      const unsub = subscribeToCollection(name, (data: any[]) => {
        store.setCollection(key, data);

        // Cek ulang tahun setiap data members berubah
        if (key === 'members' && data.length > 0) {
          checkBirthdays(data as Member[]);
        }
      });
      unsubscribers.push(unsub);
    } catch (err) {
      console.error(`[RT] Gagal subscribe ${name}:`, err);
    }
  });

  // Finance Config (single document)
  try {
    const unsub = subscribeToDocument('financeConfig', 'config', (data: any) => {
      if (data) {
        store.set({ finance: data });
      }
    });
    unsubscribers.push(unsub);
  } catch {
    // Ignore
  }

  console.log(`[RT] ${unsubscribers.length} listener aktif`);

  // Schedule daily birthday check
  scheduleDailyBirthdayCheck();

  return stopRealtimeSync;
}

/**
 * Stop semua listeners
 */
export function stopRealtimeSync(): void {
  unsubscribers.forEach(fn => {
    try { fn(); } catch {}
  });
  unsubscribers = [];
  console.log('[RT] Semua listener dihentikan');
}

/**
 * Cek ulang tahun member hari ini
 */
async function checkBirthdays(members: Member[]): Promise<void> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Cegah cek berulang dalam satu hari
  if (birthdayChecked && birthdayCheckDate === todayStr) return;
  birthdayChecked = true;
  birthdayCheckDate = todayStr;

  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const birthdayMembers = members.filter(m => {
    if (!m.tglLahir || m.status !== 'aktif') return false;
    try {
      const [, mm, dd] = m.tglLahir.split('-').map(Number);
      return mm === todayMonth && dd === todayDay;
    } catch {
      return false;
    }
  });

  if (birthdayMembers.length === 0) return;

  console.log(`[RT] ${birthdayMembers.length} ulang tahun hari ini`);

  try {
    // Cek notifikasi yang sudah ada
    const existingNotifs = await queryDocuments<Notification>('notifications', 'type', '==', 'birthday');
    const existingIds = new Set(
      existingNotifs
        .filter(n => n.date === todayStr)
        .map(n => n.memberId)
    );

    for (const member of birthdayMembers) {
      if (existingIds.has(String(member.id))) continue;

      const age = calculateAge(member.tglLahir);
      const ageText = age > 0 ? ` (${age} tahun)` : '';

      await addDocument('notifications', {
        title: '\ud83c\udf82 Ulang Tahun Jemaat',
        message: `${member.nama}${ageText} berulang tahun hari ini! Berikan ucapan selamat.`,
        type: 'birthday',
        memberId: String(member.id),
        date: todayStr,
        timestamp: new Date().toISOString(),
        read: false,
      });

      console.log(`[RT] Notifikasi ulang tahun: ${member.nama}`);
    }

    // Show toast
    if (birthdayMembers.length === 1) {
      store.showToast(`\ud83c\udf82 Selamat ulang tahun ${birthdayMembers[0].nama}!`, 'info');
    } else {
      store.showToast(`\ud83c\udf82 ${birthdayMembers.length} jemaat berulang tahun hari ini!`, 'info');
    }
  } catch (e) {
    console.error('[RT] Birthday check error:', e);
  }
}

/**
 * Hitung umur
 */
function calculateAge(tglLahir?: string): number {
  if (!tglLahir) return 0;
  const today = new Date();
  const birth = new Date(tglLahir);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * Schedule pengecekan ulang tahun harian
 */
function scheduleDailyBirthdayCheck(): void {
  const now = new Date();
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 1, 0, 0);
  const ms = next.getTime() - now.getTime();

  setTimeout(() => {
    birthdayChecked = false;
    const members = store.get(s => s.members);
    if (members.length > 0) {
      checkBirthdays(members);
    }
    scheduleDailyBirthdayCheck();
  }, ms);

  console.log(`[RT] Cek ulang tahun berikutnya: ${next.toLocaleString('id-ID')}`);
}
