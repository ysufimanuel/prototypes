/**
 * UTILITY FUNCTIONS
 * ====================================================================
 * Helper functions untuk format, perhitungan, dan validasi
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ── Tailwind Merge ──────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Currency ────────────────────────────────────────────────────
export function formatRupiah(angka: number | undefined | null): string {
  if (angka === undefined || angka === null || isNaN(angka)) return 'Rp 0';
  return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ── Date & Time ─────────────────────────────────────────────────
export function formatDate(dateString: string | undefined | null, lang: 'id' | 'en' = 'id'): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateFull(dateString: string | undefined | null, lang: 'id' | 'en' = 'id'): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTime(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    if (dateString.includes(':')) return dateString;
    return '-';
  }
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeAgo(timestamp: string, lang: 'id' | 'en' = 'id'): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diff = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diff < 60) return lang === 'id' ? 'Baru saja' : 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} ${lang === 'id' ? 'menit lalu' : 'min ago'}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${lang === 'id' ? 'jam lalu' : 'hr ago'}`;
  return `${Math.floor(diff / 86400)} ${lang === 'id' ? 'hari lalu' : 'days ago'}`;
}

// ── Age Calculation ─────────────────────────────────────────────
export function calculateAge(birthDate: string | undefined | null): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function getBirthdayText(birthDate: string | undefined | null, lang: 'id' | 'en' = 'id'): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  const now = new Date();
  const birthThisYear = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  const diff = Math.ceil((birthThisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return lang === 'id' ? 'Hari ini!' : 'Today!';
  if (diff === 1) return lang === 'id' ? 'Besok' : 'Tomorrow';
  if (diff < 0) {
    const birthNextYear = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
    const diffNext = Math.ceil((birthNextYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffNext + ` ${lang === 'id' ? 'hari lagi' : 'days'}`;
  }
  return diff + ` ${lang === 'id' ? 'hari lagi' : 'days'}`;
}

// ── Export Helpers ──────────────────────────────────────────────
export function exportToCSV(data: Record<string, any>[], filename: string): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    '\uFEFF' + headers.join(','),
    ...data.map(row =>
      headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToXLSX(data: Record<string, any>[], filename: string): void {
  try {
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      console.error('XLSX library not loaded');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } catch (e) {
    console.error('XLSX export error:', e);
  }
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Validation ──────────────────────────────────────────────────
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  return /^[+]?[\d\s-]{8,}$/.test(phone);
}

// ── String ──────────────────────────────────────────────────────
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

// ── Array ───────────────────────────────────────────────────────
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) result[groupKey] = [];
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

// ── Date Helpers ────────────────────────────────────────────────
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function getCurrentYear(): string {
  return String(new Date().getFullYear());
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isSameDay(date1: string, date2: string): boolean {
  return date1 === date2;
}

export function isThisMonth(dateString: string): boolean {
  return dateString.startsWith(getCurrentMonth());
}

export function isThisYear(dateString: string): boolean {
  return dateString.startsWith(getCurrentYear());
}
