/**
 * Formatters - Helper untuk memformat data tampilan
 */

/**
 * Format angka ke format Rupiah
 */
export function formatRupiah(angka: number | string | undefined | null): string {
  const num = typeof angka === 'string' ? parseFloat(angka) : (angka ?? 0);
  if (isNaN(num)) return 'Rp 0';
  return 'Rp ' + num.toLocaleString('id-ID');
}

/**
 * Format tanggal ke format Indonesia
 */
export function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

/**
 * Format tanggal singkat (DD/MM/YYYY)
 */
export function formatDateShort(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

/**
 * Format tanggal ke YYYY-MM-DD untuk input
 */
export function formatDateInput(date: Date | undefined | null): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Format waktu relatif (time ago)
 */
export function timeAgo(timestamp: string | Date | undefined | null): string {
  if (!timestamp) return '-';
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    if (isNaN(date.getTime())) return '-';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    if (diffDay < 7) return `${diffDay} hari lalu`;
    return formatDateShort(date);
  } catch {
    return '-';
  }
}

/**
 * Format angka dengan separator ribuan
 */
export function formatNumber(num: number | string | undefined | null): string {
  const n = typeof num === 'string' ? parseFloat(num) : (num ?? 0);
  if (isNaN(n)) return '0';
  return n.toLocaleString('id-ID');
}

/**
 * Hitung umur dari tanggal lahir
 */
export function calculateAge(tglLahir: string | Date | undefined | null): number {
  if (!tglLahir) return 0;
  try {
    const birth = typeof tglLahir === 'string' ? new Date(tglLahir) : tglLahir;
    if (isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  } catch {
    return 0;
  }
}

/**
 * Format nama bulan
 */
export function getMonthName(monthIndex: number): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  return months[monthIndex] ?? '';
}

/**
 * Format nama hari
 */
export function getDayName(dayIndex: number): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[dayIndex] ?? '';
}

/**
 * Truncate text dengan ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '...';
}

/**
 * Format status dengan kapitalisasi
 */
export function formatStatus(status: string | undefined | null): string {
  if (!status) return '-';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/**
 * Format nomor telepon Indonesia
 */
export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return '-';
  // Jika dimulai dengan 0, ganti dengan +62
  if (phone.startsWith('0')) {
    return '+62' + phone.substring(1);
  }
  return phone;
}
