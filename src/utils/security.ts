/**
 * Security Utilities - Sanitasi dan proteksi XSS
 */

import DOMPurify from 'dompurify';

/**
 * Sanitasi HTML untuk mencegah XSS
 * Gunakan ini sebelum menginsert HTML ke DOM
 */
export function sanitizeHTML(html: string | undefined | null): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span'],
    ALLOWED_ATTR: ['class'],
  });
}

/**
 * Sanitasi plain text - menghapus semua tag HTML
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

/**
 * Escape HTML entities untuk mencegah XSS saat menggunakan innerHTML
 * Gunakan ini untuk text content, bukan sanitizeHTML
 */
export function escapeHTML(str: string | undefined | null): string {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Generate hash sederhana untuk password (tidak untuk produksi!)
 * Untuk produksi gunakan bcrypt atau Firebase Auth
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'church-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate random ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validasi file upload
 */
export function validateFileUpload(
  file: File,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const { maxSizeMB = 5, allowedTypes = ['image/jpeg', 'image/png', 'image/gif'] } = options;

  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `File terlalu besar. Maksimal ${maxSizeMB}MB` };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `Tipe file tidak diizinkan. Hanya: ${allowedTypes.join(', ')}` };
  }

  return { valid: true };
}
