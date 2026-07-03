/**
 * TypeScript Type Definitions
 * Semua interface dan type untuk aplikasi
 */

// =========================================================
// BASE ENTITY
// =========================================================

export interface BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

// =========================================================
// AUTH & USER
// =========================================================

export interface User extends BaseEntity {
  uid?: string;
  nama: string;
  username: string;
  email: string;
  password?: string; // Only for registration, never stored
  role: 'superadmin' | 'admin' | 'user';
  avatar?: string | null;
  status: 'aktif' | 'tidak-aktif';
  churchId?: string;
  lastLogin?: string | null;
}

// =========================================================
// MEMBER
// =========================================================

export interface Member extends BaseEntity {
  nama: string;
  email?: string;
  telepon?: string;
  jk?: 'Laki-laki' | 'Perempuan';
  tempatLahir?: string;
  tglLahir?: string; // YYYY-MM-DD
  alamat?: string;
  kota?: string;
  kodepos?: string;
  status: 'aktif' | 'tidak-aktif';
  groupId?: string | null;
  joinDate?: string;
  avatar?: string | null;
}

// =========================================================
// FAMILY
// =========================================================

export interface Family extends BaseEntity {
  nama: string;
  kepalaId?: string;
  anggota: string[]; // Array of member IDs
  alamat?: string;
  kota?: string;
}

// =========================================================
// GROUP
// =========================================================

export interface Group extends BaseEntity {
  nama: string;
  deskripsi?: string;
  leaderId?: string;
  jadwal?: string;
  anggota: string[];
  showPhone: boolean;
}

// =========================================================
// EVENT
// =========================================================

export type EventType = 'ibadah' | 'seminar' | 'retret' | 'sosial' | 'lainnya';
export type EventStatus = 'upcoming' | 'ongoing' | 'completed';

export interface EventParticipant {
  memberId: string;
  nama: string;
  registeredAt: string;
}

export interface Event extends BaseEntity {
  nama: string;
  tipe: EventType;
  customType?: string | null;
  start: string; // ISO datetime
  end: string; // ISO datetime
  lokasi?: string;
  deskripsi?: string;
  kapasitas?: number;
  status: EventStatus;
  participants: EventParticipant[];
}

// =========================================================
// ATTENDANCE
// =========================================================

export interface Attendance extends BaseEntity {
  eventId: string;
  memberId: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string; // HH:mm
  status: 'hadir' | 'izin' | 'alpha';
}

// =========================================================
// DONATION
// =========================================================

export type DonationType = 'perpuluhan' | 'persembahan' | 'pembangunan' | 'sosial';

export interface Donation extends BaseEntity {
  donorId: string;
  tipe: DonationType;
  jumlah: number;
  tanggal: string;
  keterangan?: string;
}

export interface Donor extends BaseEntity {
  nama: string;
  email?: string;
  telepon?: string;
  totalDonasi?: number;
  terakhirDonasi?: string;
}

// =========================================================
// VOLUNTEER
// =========================================================

export type ServiceArea =
  | 'sunday-school-teacher'
  | 'singer'
  | 'worship-leader'
  | 'musician'
  | 'dancer'
  | 'collection'
  | 'intercession'
  | 'speaker'
  | 'multimedia'
  | 'lighting-sound'
  | 'usher';

export type ScheduleDay = 'minggu-pagi' | 'minggu-sore' | 'sabtu' | 'hari-kerja';

export interface Volunteer extends BaseEntity {
  memberId?: string | null;
  externalNama?: string | null;
  externalEmail?: string | null;
  externalTelepon?: string | null;
  area: ServiceArea;
  jadwal: ScheduleDay[];
  status: 'aktif' | 'tidak-aktif';
}

export interface Assignment extends BaseEntity {
  volunteerId: string;
  eventId: string;
  tanggal: string;
  waktu: string;
  tempat?: string;
  tugas?: string;
  catatan?: string;
  status: 'assigned' | 'completed' | 'cancelled';
}

// =========================================================
// ANNOUNCEMENT
// =========================================================

export interface Announcement extends BaseEntity {
  judul: string;
  konten: string;
  tanggal: string;
  expiry?: string;
  important: boolean;
  authorId?: string;
}

// =========================================================
// FINANCE
// =========================================================

export interface FinanceCategory extends BaseEntity {
  nama: string;
  tipe: 'pemasukan' | 'pengeluaran';
  deskripsi?: string;
}

export interface FinanceConfig {
  saldoAwal: number;
  saldoAkhir?: number;
}

export interface Pemasukan extends BaseEntity {
  kategoriId: string;
  jumlah: number;
  tanggal: string;
  keterangan?: string;
  donaturId?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
}

export interface Pengeluaran extends BaseEntity {
  kategoriId: string;
  jumlah: number;
  tanggal: string;
  keterangan?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
}

export interface ApprovalHistory extends BaseEntity {
  tipe: 'pemasukan' | 'pengeluaran';
  itemId: string;
  action: 'approved' | 'rejected';
  by: string;
  timestamp: string;
}

// =========================================================
// NOTIFICATION
// =========================================================

export interface Notification extends BaseEntity {
  title: string;
  message: string;
  type: 'event' | 'donation' | 'member' | 'birthday' | 'system';
  read: boolean;
  timestamp: string;
  memberId?: string;
  date?: string;
}

// =========================================================
// DEATH
// =========================================================

export interface Death extends BaseEntity {
  memberId: string;
  nama: string;
  tglMeninggal: string;
  tempatMeninggal?: string;
  penyebab?: string;
  status: 'pending' | 'approved';
}

// =========================================================
// MESSAGE
// =========================================================

export interface Message extends BaseEntity {
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

// =========================================================
// CHURCH PROFILE
// =========================================================

export interface ChurchProfile {
  id?: string;
  nama: string;
  alamat?: string;
  kota?: string;
  telepon?: string;
  email?: string;
  website?: string;
  superadminUid?: string;
  subscription?: {
    status: string;
    plan: string;
    trialEndsAt?: string;
    expiresAt?: string | null;
  };
}
