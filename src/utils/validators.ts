/**
 * Validators - Fungsi validasi input form
 */

/**
 * Validasi email
 */
export function validateEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validasi nomor telepon (Indonesia)
 */
export function validatePhone(phone: string | undefined | null): boolean {
  if (!phone) return true; // Optional
  const regex = /^(\+62|62|0)[0-9]{9,13}$/;
  return regex.test(phone);
}

/**
 * Validasi tanggal (YYYY-MM-DD)
 */
export function validateDate(dateStr: string | undefined | null): boolean {
  if (!dateStr) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validasi angka positif
 */
export function validatePositiveNumber(num: string | number | undefined | null): boolean {
  if (num === undefined || num === null || num === '') return false;
  const parsed = typeof num === 'string' ? parseFloat(num) : num;
  return !isNaN(parsed) && parsed > 0;
}

/**
 * Validasi angka (bisa nol atau positif)
 */
export function validateNumber(num: string | number | undefined | null): boolean {
  if (num === undefined || num === null || num === '') return false;
  const parsed = typeof num === 'string' ? parseFloat(num) : num;
  return !isNaN(parsed) && parsed >= 0;
}

/**
 * Validasi required field
 */
export function validateRequired(value: string | undefined | null): boolean {
  return value !== undefined && value !== null && value.trim().length > 0;
}

/**
 * Validasi minimal panjang
 */
export function validateMinLength(value: string | undefined | null, min: number): boolean {
  if (!value) return false;
  return value.trim().length >= min;
}

/**
 * Validasi password (minimal 6 karakter)
 */
export function validatePassword(password: string | undefined | null): boolean {
  return validateMinLength(password, 6);
}

/**
 * Validasi username (alphanumeric, underscore, minimal 3 karakter)
 */
export function validateUsername(username: string | undefined | null): boolean {
  if (!username) return false;
  const regex = /^[a-zA-Z0-9_]{3,}$/;
  return regex.test(username);
}

/**
 * Validasi URL
 */
export function validateURL(url: string | undefined | null): boolean {
  if (!url) return true; // Optional
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validasi NIK (Nomor Induk Kependudukan) - 16 digit
 */
export function validateNIK(nik: string | undefined | null): boolean {
  if (!nik) return true; // Optional
  const regex = /^\d{16}$/;
  return regex.test(nik);
}

// Interface untuk hasil validasi form
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validasi form member
 */
export function validateMemberForm(data: {
  nama?: string;
  email?: string;
  telepon?: string;
  tglLahir?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!validateRequired(data.nama)) {
    errors.nama = 'Nama lengkap wajib diisi';
  }

  if (data.email && !validateEmail(data.email)) {
    errors.email = 'Format email tidak valid';
  }

  if (data.telepon && !validatePhone(data.telepon)) {
    errors.telepon = 'Format nomor telepon tidak valid';
  }

  if (data.tglLahir && !validateDate(data.tglLahir)) {
    errors.tglLahir = 'Format tanggal tidak valid (YYYY-MM-DD)';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validasi form user
 */
export function validateUserForm(data: {
  nama?: string;
  username?: string;
  email?: string;
  password?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!validateRequired(data.nama)) {
    errors.nama = 'Nama wajib diisi';
  }

  if (!validateUsername(data.username)) {
    errors.username = 'Username minimal 3 karakter (alphanumeric & underscore)';
  }

  if (!validateEmail(data.email)) {
    errors.email = 'Format email tidak valid';
  }

  if (!validatePassword(data.password)) {
    errors.password = 'Password minimal 6 karakter';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validasi form donation
 */
export function validateDonationForm(data: {
  donorId?: string;
  jumlah?: string | number;
  tanggal?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!validateRequired(data.donorId)) {
    errors.donorId = 'Pilih donor';
  }

  if (!validatePositiveNumber(data.jumlah)) {
    errors.jumlah = 'Jumlah harus lebih dari 0';
  }

  if (!validateDate(data.tanggal)) {
    errors.tanggal = 'Tanggal tidak valid';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
