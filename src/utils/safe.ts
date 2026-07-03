/**
 * Defensive Programming Helpers
 * Mencegah crash dengan safe access dan null checking
 */

/**
 * Mengambil nilai dari objek bersarang dengan aman
 * @param obj - Objek target
 * @param path - Path properti (contoh: "members.0.nama")
 * @param fallback - Nilai default jika path tidak ditemukan
 */
export function safeGet<T = any>(obj: any, path: string, fallback: T | null = null): T | null {
  try {
    const result = path.split('.').reduce((acc, key) => {
      if (acc === null || acc === undefined) return undefined;
      return acc[key];
    }, obj);
    return result !== undefined ? result : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safe array access - mengembalikan array kosong jika undefined
 */
export function safeArray<T>(arr: T[] | undefined | null): T[] {
  return Array.isArray(arr) ? arr : [];
}

/**
 * Safe string access - mengembalikan string kosong jika undefined/null
 */
export function safeString(str: string | undefined | null): string {
  return typeof str === 'string' ? str : '';
}

/**
 * Safe number access - mengembalikan 0 jika undefined/null/NaN
 */
export function safeNumber(num: number | string | undefined | null): number {
  if (num === null || num === undefined) return 0;
  const parsed = typeof num === 'string' ? parseFloat(num) : num;
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Safe boolean access
 */
export function safeBool(val: boolean | undefined | null, fallback = false): boolean {
  return typeof val === 'boolean' ? val : fallback;
}

/**
 * Guard clause untuk view-only users
 */
export function isViewOnly(role: string | undefined): boolean {
  return role === 'user';
}

/**
 * Memastikan objek memiliki semua property yang diperlukan
 */
export function ensureDefaults<T extends Record<string, any>>(
  obj: Partial<T>,
  defaults: T
): T {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    if (obj[key] !== undefined && obj[key] !== null) {
      (result as any)[key] = obj[key];
    }
  }
  return result;
}
