/**
 * TYPE DEFINITIONS
 * ====================================================================
 * TypeScript interfaces untuk semua entitas dalam Church Management System
 */

// ── Core User ───────────────────────────────────────────────────
export interface User {
  id: number;
  nama: string;
  username: string;
  email: string;
  password: string;
  role: 'superadmin' | 'admin' | 'user';
  status: 'aktif' | 'nonaktif';
  avatar: string | null;
  lastLogin: string | null;
}

export interface CurrentUser {
  id: number;
  nama: string;
  username: string;
  email: string;
  role: 'superadmin' | 'admin' | 'user';
}

// ── Member ──────────────────────────────────────────────────────
export interface Member {
  id: number;
  nama: string;
  email: string;
  telepon: string;
  jk: 'Laki-laki' | 'Perempuan';
  tempatLahir: string;
  tglLahir: string;
  alamat: string;
  kota: string;
  kodepos: string;
  status: 'aktif' | 'tidak-aktif';
  groupId?: number | null;
  joinDate: string;
  avatar: string | null;
}

// ── Family ──────────────────────────────────────────────────────
export interface Family {
  id: number;
  nama: string;
  kepalaId?: number | null;
  anggota: number[];
  alamat: string;
  kota: string;
}

// ── Group ───────────────────────────────────────────────────────
export interface Group {
  id: number;
  nama: string;
  deskripsi: string;
  leaderId?: number | null;
  jadwal: string;
  anggota: number[];
  showPhone: boolean;
  createdAt?: string;
}

// ── Event ───────────────────────────────────────────────────────
export interface Event {
  id: number;
  nama: string;
  tipe: 'ibadah' | 'doa' | 'pemuda' | 'anak' | 'perayaan' | 'lainnya';
  customTipe?: string;
  start: string;
  end: string;
  tempat: string;
  deskripsi: string;
  participants: number[];
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  penanggungJawab?: string;
  budget?: number;
  catatan?: string;
}

// ── Attendance ──────────────────────────────────────────────────
export interface Attendance {
  id: number;
  memberId: number;
  eventId: number;
  tanggal: string;
  waktu: string;
  status: 'hadir' | 'izin' | 'sakit' | 'alpha';
  catatan?: string;
}

// ── Donation ────────────────────────────────────────────────────
export interface Donation {
  id: number;
  donorId?: number | null;
  jumlah: number;
  tipe: 'perpuluhan' | 'persembahan' | 'khusus' | 'lainnya';
  tanggal: string;
  keterangan: string;
  eventId?: number | null;
}

// ── Volunteer ───────────────────────────────────────────────────
export interface Volunteer {
  id: number;
  memberId?: number | null;
  externalNama?: string | null;
  externalTelepon?: string | null;
  externalEmail?: string | null;
  area: string;
  customArea?: string;
  status: 'aktif' | 'nonaktif';
  joinDate: string;
  notes?: string;
}

// ── Assignment ──────────────────────────────────────────────────
export interface Assignment {
  id: number;
  volunteerId: number;
  eventId: number;
  tanggal: string;
  waktu: string;
  tempat: string;
  tugas: string;
  catatan: string;
  status: string;
}

// ── Announcement ────────────────────────────────────────────────
export interface Announcement {
  id: number;
  judul: string;
  konten: string;
  tanggal: string;
  expiry: string;
  important: boolean;
  authorId: number;
}

// ── Message ─────────────────────────────────────────────────────
export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  timestamp: string;
  read: boolean;
}

// ── Activity ────────────────────────────────────────────────────
export interface Activity {
  id: number;
  type: string;
  action: string;
  detail: string;
  timestamp: string;
}

// ── Church Profile ──────────────────────────────────────────────
export interface ChurchProfile {
  nama: string;
  alamat: string;
  kota: string;
  telepon: string;
  email: string;
  pastor: string;
  website: string;
  denomination: string;
  vision: string;
  mission: string;
  logo: string;
  churchName: string;
  pastorName: string;
  churchAddress: string;
  churchPhone: string;
  churchEmail: string;
  showBirthdays: boolean;
  publicAccess: boolean;
}

// ── Finance ─────────────────────────────────────────────────────
export interface Pemasukan {
  id: number;
  kategoriId: number;
  jumlah: number;
  tanggal: string;
  donaturId?: number | null;
  keterangan: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy: number | null;
  approvedAt: string | null;
}

export interface Pengeluaran {
  id: number;
  kategoriId: number;
  jumlah: number;
  tanggal: string;
  keterangan: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy: number | null;
  approvedAt: string | null;
}

export interface FinanceCategory {
  id: number;
  nama: string;
  tipe: 'pemasukan' | 'pengeluaran';
  deskripsi: string;
}

export interface Donatur {
  id: number;
  nama: string;
  telepon: string;
  email: string;
  alamat: string;
}

export interface ApprovalHistory {
  id: number;
  tipe: 'pemasukan' | 'pengeluaran';
  itemId: number;
  action: 'approved' | 'rejected';
  by: number;
  timestamp: string;
}

export interface FinanceSettings {
  saldoAwal: number;
}

// ── Death Record ────────────────────────────────────────────────
export interface DeathRecord {
  id?: string;
  nama: string;
  tglLahir: string;
  tglWafat: string;
  riwayatPenyakit: string;
  penyebab: string;
  tempat: string;
  waktu: string;
}

// ── App Data (Complete State) ───────────────────────────────────
export interface AppData {
  members: Member[];
  families: Family[];
  groups: Group[];
  events: Event[];
  attendance: Attendance[];
  donations: Donation[];
  volunteers: Volunteer[];
  assignments: Assignment[];
  announcements: Announcement[];
  messages: Message[];
  activities: Activity[];
  users: User[];
  pemasukan: Pemasukan[];
  pengeluaran: Pengeluaran[];
  financeCategories: FinanceCategory[];
  donatur: Donatur[];
  approvalHistory: ApprovalHistory[];
  finance: FinanceSettings;
  churchProfile: ChurchProfile;
  deathRecords: DeathRecord[];
}

// ── Language ────────────────────────────────────────────────────
export type Language = 'id' | 'en';

// ── Notification ────────────────────────────────────────────────
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  userId: number | null;
  timestamp: string;
  read: boolean;
}

// ── Theme ───────────────────────────────────────────────────────
export type ThemeMode = 'dark';
