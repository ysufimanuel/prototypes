/**
 * LOCAL STORAGE HOOK
 * ====================================================================
 * Hook untuk persistensi data ke localStorage dengan sync antar tab
 */
import { useState, useEffect, useCallback } from 'react';
import type { AppData } from '@/types';

const STORAGE_KEY = 'churchDataV6';
const LAST_SYNC_KEY = 'lastSyncTimestamp';

const defaultData: AppData = {
  members: [
    { id: 1, nama: 'Budi Santoso', email: 'budi@email.com', telepon: '08123456789', jk: 'Laki-laki', tempatLahir: 'Jakarta', tglLahir: '1990-01-15', alamat: 'Jl. Mawar No. 1', kota: 'Jakarta', kodepos: '10110', status: 'aktif', groupId: null, joinDate: '2024-01-01', avatar: null },
    { id: 2, nama: 'Ani Wijaya', email: 'ani@email.com', telepon: '08234567890', jk: 'Perempuan', tempatLahir: 'Bandung', tglLahir: '1992-03-20', alamat: 'Jl. Melati No. 5', kota: 'Bandung', kodepos: '40111', status: 'aktif', groupId: null, joinDate: '2024-01-15', avatar: null },
    { id: 3, nama: 'Dedi Kurniawan', email: 'dedi@email.com', telepon: '08345678901', jk: 'Laki-laki', tempatLahir: 'Surabaya', tglLahir: '1985-07-10', alamat: 'Jl. Anggrek No. 12', kota: 'Surabaya', kodepos: '60111', status: 'aktif', groupId: null, joinDate: '2024-02-01', avatar: null },
    { id: 4, nama: 'Siti Rahayu', email: 'siti@email.com', telepon: '08456789012', jk: 'Perempuan', tempatLahir: 'Yogyakarta', tglLahir: '1988-11-25', alamat: 'Jl. Kenanga No. 8', kota: 'Yogyakarta', kodepos: '55111', status: 'aktif', groupId: null, joinDate: '2024-02-15', avatar: null },
    { id: 5, nama: 'Ahmad Fauzi', email: 'ahmad@email.com', telepon: '08567890123', jk: 'Laki-laki', tempatLahir: 'Medan', tglLahir: '1995-05-05', alamat: 'Jl. Cempaka No. 3', kota: 'Medan', kodepos: '20111', status: 'aktif', groupId: null, joinDate: '2024-03-01', avatar: null },
  ],
  families: [
    { id: 1, nama: 'Keluarga Santoso', kepalaId: 1, anggota: [1, 2], alamat: 'Jl. Mawar No. 1', kota: 'Jakarta' },
    { id: 2, nama: 'Keluarga Kurniawan', kepalaId: 3, anggota: [3, 4], alamat: 'Jl. Anggrek No. 12', kota: 'Surabaya' },
  ],
  groups: [
    { id: 1, nama: 'Youth Group', deskripsi: 'Kelompok pemuda gereja', leaderId: 1, jadwal: 'Setiap Sabtu 16:00', anggota: [1, 2, 5], showPhone: true, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 2, nama: 'Praise & Worship', deskripsi: 'Tim pujian dan penyembahan', leaderId: 3, jadwal: 'Setiap Minggu 08:00', anggota: [3, 4], showPhone: true, createdAt: '2024-01-01T00:00:00.000Z' },
  ],
  events: [
    { id: 1, nama: 'Ibadah Minggu', tipe: 'ibadah', start: '2025-07-06T08:00', end: '2025-07-06T10:00', tempat: 'Gedung Utama', deskripsi: 'Ibadah minggu rutin', participants: [], status: 'upcoming', penanggungJawab: 'Pdt. John', budget: 0 },
    { id: 2, nama: 'Doa Pagi', tipe: 'doa', start: '2025-07-05T06:00', end: '2025-07-05T07:00', tempat: 'Ruang Doa', deskripsi: 'Doa pagi bersama', participants: [], status: 'upcoming', penanggungJawab: 'Bpk. Dedi', budget: 0 },
    { id: 3, nama: 'Perayaan Natal', tipe: 'perayaan', start: '2025-12-25T18:00', end: '2025-12-25T22:00', tempat: 'Gedung Utama', deskripsi: 'Perayaan Natal bersama', participants: [], status: 'upcoming', penanggungJawab: 'Panitia Natal', budget: 50000000 },
  ],
  attendance: [
    { id: 1, memberId: 1, eventId: 1, tanggal: '2025-06-29', waktu: '08:15', status: 'hadir' },
    { id: 2, memberId: 2, eventId: 1, tanggal: '2025-06-29', waktu: '08:20', status: 'hadir' },
    { id: 3, memberId: 3, eventId: 1, tanggal: '2025-06-29', waktu: '08:10', status: 'hadir' },
    { id: 4, memberId: 4, eventId: 1, tanggal: '2025-06-29', waktu: '08:25', status: 'hadir' },
    { id: 5, memberId: 5, eventId: 1, tanggal: '2025-06-29', waktu: '08:30', status: 'izin' },
  ],
  donations: [
    { id: 1, donorId: 1, jumlah: 1000000, tipe: 'perpuluhan', tanggal: '2025-06-01', keterangan: 'Perpuluhan Juni', eventId: 1 },
    { id: 2, donorId: 2, jumlah: 500000, tipe: 'persembahan', tanggal: '2025-06-08', keterangan: 'Persembahan', eventId: 1 },
    { id: 3, donorId: 3, jumlah: 2000000, tipe: 'khusus', tanggal: '2025-06-15', keterangan: 'Bakti Natal', eventId: 3 },
  ],
  volunteers: [
    { id: 1, memberId: 1, externalNama: null, externalTelepon: null, externalEmail: null, area: 'worship-leader', status: 'aktif', joinDate: '2024-01-01', notes: '' },
    { id: 2, memberId: 3, externalNama: null, externalTelepon: null, externalEmail: null, area: 'singer', status: 'aktif', joinDate: '2024-01-01', notes: '' },
    { id: 3, memberId: null, externalNama: 'John Doe', externalTelepon: '0811223344', externalEmail: 'john@email.com', area: 'multimedia', status: 'aktif', joinDate: '2024-02-01', notes: 'Volunteer luar' },
  ],
  assignments: [
    { id: 1, volunteerId: 1, eventId: 1, tanggal: '2025-07-06', waktu: '08:00', tempat: 'Gedung Utama', tugas: 'Memimpin pujian', catatan: '', status: 'assigned' },
  ],
  announcements: [
    { id: 1, judul: 'Ibadah Natal 2025', konten: 'Perayaan Natal akan diadakan pada tanggal 25 Desember 2025 pukul 18:00. Semua jemaat diundang untuk hadir.', tanggal: '2025-06-01', expiry: '2025-12-31', important: true, authorId: 1 },
    { id: 2, judul: 'Jadwal Doa Pagi', konten: 'Doa pagi dilaksanakan setiap hari Sabtu pukul 06:00 pagi di ruang doa.', tanggal: '2025-06-01', expiry: '2025-12-31', important: false, authorId: 1 },
  ],
  messages: [],
  activities: [
    { id: 1, type: 'member', action: 'Anggota baru ditambahkan', detail: 'Budi Santoso', timestamp: '2025-06-01T10:00:00Z' },
    { id: 2, type: 'member', action: 'Anggota baru ditambahkan', detail: 'Ani Wijaya', timestamp: '2025-06-01T11:00:00Z' },
    { id: 3, type: 'event', action: 'Event baru dibuat', detail: 'Ibadah Minggu', timestamp: '2025-06-15T09:00:00Z' },
  ],
  users: [
    { id: 1, nama: 'Super Admin', username: 'admin', email: 'admin@gereja.com', password: 'admin123', role: 'superadmin', status: 'aktif', avatar: null, lastLogin: '2025-07-04T00:00:00Z' },
    { id: 2, nama: 'Admin User', username: 'admin2', email: 'admin2@gereja.com', password: 'admin123', role: 'admin', status: 'aktif', avatar: null, lastLogin: null },
  ],
  pemasukan: [
    { id: 1, kategoriId: 1, jumlah: 5000000, tanggal: '2025-07-01', donaturId: 1, keterangan: 'Perpuluhan Juli', status: 'approved', approvedBy: 1, approvedAt: '2025-07-01T10:00:00Z' },
    { id: 2, kategoriId: 2, jumlah: 2000000, tanggal: '2025-07-02', donaturId: 2, keterangan: 'Persembahan', status: 'pending', approvedBy: null, approvedAt: null },
  ],
  pengeluaran: [
    { id: 1, kategoriId: 4, jumlah: 1500000, tanggal: '2025-07-03', keterangan: 'Listrik Juli', status: 'approved', approvedBy: 1, approvedAt: '2025-07-03T10:00:00Z' },
    { id: 2, kategoriId: 5, jumlah: 500000, tanggal: '2025-07-04', keterangan: 'ATK', status: 'pending', approvedBy: null, approvedAt: null },
  ],
  financeCategories: [
    { id: 1, nama: 'Perpuluhan', tipe: 'pemasukan', deskripsi: 'Perpuluhan jemaat' },
    { id: 2, nama: 'Persembahan', tipe: 'pemasukan', deskripsi: 'Persembahan ibadah' },
    { id: 3, nama: 'Donasi Khusus', tipe: 'pemasukan', deskripsi: 'Donasi untuk keperluan khusus' },
    { id: 4, nama: 'Operasional', tipe: 'pengeluaran', deskripsi: 'Biaya operasional gereja' },
    { id: 5, nama: 'Utilitas', tipe: 'pengeluaran', deskripsi: 'Listrik, air, internet' },
    { id: 6, nama: 'Pemeliharaan', tipe: 'pengeluaran', deskripsi: 'Perawatan gedung dan fasilitas' },
  ],
  donatur: [
    { id: 1, nama: 'Budi Santoso', telepon: '08123456789', email: 'budi@email.com', alamat: 'Jl. Mawar No. 1' },
    { id: 2, nama: 'Ani Wijaya', telepon: '08234567890', email: 'ani@email.com', alamat: 'Jl. Melati No. 5' },
  ],
  approvalHistory: [],
  finance: { saldoAwal: 0 },
  churchProfile: {
    nama: 'Gereja Kristen Jaya',
    alamat: 'Jl. Sudirman No. 123',
    kota: 'Jakarta',
    telepon: '021-1234567',
    email: 'info@gkjaya.org',
    pastor: 'Pdt. John Wijaya',
    website: 'www.gkjaya.org',
    denomination: 'Kristen Protestan',
    vision: 'Menjadi gereja yang berdampak bagi komunitas',
    mission: 'Memuridkan, Melayani, Mengasihi',
    logo: '',
    churchName: 'Gereja Kristen Jaya',
    pastorName: 'Pdt. John Wijaya',
    churchAddress: 'Jl. Sudirman No. 123, Jakarta',
    churchPhone: '021-1234567',
    churchEmail: 'info@gkjaya.org',
    showBirthdays: true,
    publicAccess: false,
  },
  deathRecords: [],
};

export function loadData(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge dengan default untuk field baru
      return { ...defaultData, ...parsed };
    }
  } catch (error) {
    console.error('Error loading data from localStorage:', error);
  }
  return { ...defaultData };
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error saving data to localStorage:', error);
  }
}

export function useAppData() {
  const [data, setData] = useState<AppData>(() => loadData());

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setData(prev => ({ ...prev, ...parsed }));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updateData = useCallback((updater: (prev: AppData) => AppData) => {
    setData(prev => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  const setDataDirect = useCallback((newData: AppData) => {
    saveData(newData);
    setData(newData);
  }, []);

  return { data, updateData, setData: setDataDirect };
}
