/**
 * AUTHENTICATION HOOK
 * ====================================================================
 * Hook untuk manajemen autentikasi user dan role-based access
 */
import { useState, useCallback, useEffect } from 'react';
import type { User, CurrentUser } from '@/types';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    const stored = sessionStorage.getItem('currentUser');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem('currentUser');
    }
  }, [currentUser]);

  const login = useCallback((users: User[], username: string, password: string): boolean => {
    const user = users.find(
      u => u.username === username && u.password === password && u.status === 'aktif'
    );
    if (user) {
      const current: CurrentUser = {
        id: user.id,
        nama: user.nama,
        username: user.username,
        email: user.email,
        role: user.role,
      };
      setCurrentUser(current);
      // Update last login
      user.lastLogin = new Date().toISOString();
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('currentUser');
  }, []);

  const isSuperAdmin = useCallback((): boolean => {
    return currentUser?.role === 'superadmin';
  }, [currentUser]);

  const isAdmin = useCallback((): boolean => {
    return currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  }, [currentUser]);

  const isViewOnly = useCallback((): boolean => {
    return currentUser?.role === 'user';
  }, [currentUser]);

  const canEdit = useCallback((): boolean => {
    return currentUser?.role !== 'user';
  }, [currentUser]);

  const canDelete = useCallback((): boolean => {
    return currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
  }, [currentUser]);

  const canApprove = useCallback((): boolean => {
    return currentUser?.role === 'superadmin';
  }, [currentUser]);

  return {
    currentUser,
    login,
    logout,
    isSuperAdmin,
    isAdmin,
    isViewOnly,
    canEdit,
    canDelete,
    canApprove,
  };
}
