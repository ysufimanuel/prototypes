/**
 * Permissions & RBAC (Role-Based Access Control)
 * Pengecekan hak akses berdasarkan role user
 */

import type { User } from '@/types/models';

/**
 * Cek apakah user bisa mengedit data
 */
export function canEdit(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'superadmin' || user.role === 'admin';
}

/**
 * Cek apakah user bisa menghapus data
 */
export function canDelete(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'superadmin' || user.role === 'admin';
}

/**
 * Cek apakah user adalah superadmin
 */
export function isSuperAdmin(user: User | null): boolean {
  return user?.role === 'superadmin';
}

/**
 * Cek apakah user adalah admin (termasuk superadmin)
 */
export function isAdmin(user: User | null): boolean {
  return user?.role === 'superadmin' || user?.role === 'admin';
}

/**
 * Cek apakah user hanya view-only
 */
export function isViewOnly(user: User | null): boolean {
  return user?.role === 'user';
}

/**
 * Cek apakah user bisa mengapprove finance
 */
export function canApproveFinance(user: User | null): boolean {
  return user?.role === 'superadmin' || user?.role === 'admin';
}

/**
 * Cek apakah user bisa mengelola users
 */
export function canManageUsers(user: User | null): boolean {
  return user?.role === 'superadmin';
}

/**
 * Cek apakah user bisa mengelola church settings
 */
export function canManageChurch(user: User | null): boolean {
  return user?.role === 'superadmin';
}

/**
 * Cek apakah user bisa melihat data sensitif (email, telepon)
 */
export function canViewSensitive(user: User | null): boolean {
  return user?.role === 'superadmin' || user?.role === 'admin';
}

/**
 * Cek apakah user bisa export data
 */
export function canExport(user: User | null): boolean {
  return user?.role === 'superadmin' || user?.role === 'admin';
}

/**
 * Get display name untuk role
 */
export function getRoleDisplay(role: string | undefined): string {
  switch (role) {
    case 'superadmin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'user':
      return 'User (View Only)';
    default:
      return 'Unknown';
  }
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: string | undefined): string {
  switch (role) {
    case 'superadmin':
      return 'bg-red-500';
    case 'admin':
      return 'bg-blue-500';
    case 'user':
      return 'bg-gray-500';
    default:
      return 'bg-gray-400';
  }
}
