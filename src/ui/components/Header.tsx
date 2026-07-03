/**
 * Header Component - Top bar dengan quick actions, notifikasi, dan user info
 */

import { useState, useEffect, useRef } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import {
  Menu,
  UserPlus,
  CalendarPlus,
  QrCode,
  Bell,
  Trash2,
  Check,
  CheckCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@/types/models';
import { subscribeToCollection, updateDocument, deleteDocument } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';

export function Header() {
  const navigate = useNavigate();
  const { currentUser, notifications } = useStoreSelector(s => ({
    currentUser: s.currentUser,
    notifications: s.notifications,
  }));

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Subscribe to notifications
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToCollection<Notification>(
      DB_COLLECTIONS.NOTIFICATIONS,
      (data) => {
        store.setCollection('notifications', data);
      }
    );
    return unsub;
  }, [currentUser]);

  // Close notif dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAsRead = async (id: string) => {
    await updateDocument(DB_COLLECTIONS.NOTIFICATIONS, id, { read: true });
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await updateDocument(DB_COLLECTIONS.NOTIFICATIONS, n.id, { read: true });
    }
  };

  const deleteNotif = async (id: string) => {
    await deleteDocument(DB_COLLECTIONS.NOTIFICATIONS, id);
  };

  return (
    <header className="sticky top-0 z-[100] h-[70px] bg-[#141414] border-b border-[#2a2a2a] flex items-center justify-between px-6">
      {/* Left: Menu toggle */}
      <button
        onClick={() => store.toggleSidebar()}
        className="lg:hidden text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Center: Quick Actions */}
      <div className="hidden md:flex flex-1 justify-center">
        <div className="flex gap-2.5">
          <button
            onClick={() => navigate('/members?action=add')}
            className="w-[42px] h-[42px] bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl flex items-center justify-center text-gray-400 hover:text-orange-400 hover:border-orange-500/50 transition-all"
            title={t('quick-add-member')}
          >
            <UserPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/events?action=add')}
            className="w-[42px] h-[42px] bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl flex items-center justify-center text-gray-400 hover:text-orange-400 hover:border-orange-500/50 transition-all"
            title={t('quick-add-event')}
          >
            <CalendarPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/attendance')}
            className="w-[42px] h-[42px] bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl flex items-center justify-center text-gray-400 hover:text-orange-400 hover:border-orange-500/50 transition-all"
            title={t('quick-checkin')}
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Notifications + User */}
      <div className="flex items-center gap-5">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-[42px] h-[42px] bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl flex items-center justify-center text-gray-400 hover:text-orange-400 hover:border-orange-500/50 transition-all"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-[11px] font-bold text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {notifOpen && (
            <div className="absolute top-[55px] right-0 w-[360px] max-h-[480px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl z-[200] flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
                <h4 className="text-white font-semibold text-sm">{t('notifications')}</h4>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-orange-400 text-xs hover:text-orange-300 flex items-center gap-1 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    {t('mark-all-read')}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto max-h-[360px]">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                    <Bell className="w-8 h-8 mb-3 opacity-40" />
                    <p className="text-sm">{t('no-notifications')}</p>
                  </div>
                ) : (
                  notifications
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map(notif => (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 px-5 py-3.5 border-b border-[#2a2a2a]/50 hover:bg-[#0a0a0a] transition-colors ${
                          !notif.read ? 'bg-orange-500/5 border-l-[3px] border-l-orange-500' : 'opacity-70'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 flex-shrink-0 mt-0.5">
                          <Bell className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{notif.title}</p>
                          <p className="text-gray-400 text-xs truncate mt-0.5">{notif.message}</p>
                          <p className="text-gray-600 text-[11px] mt-1">
                            {new Date(notif.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {!notif.read && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="text-gray-500 hover:text-green-400 p-1 transition-colors"
                              title={t('mark-read')}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotif(notif.id)}
                            className="text-gray-500 hover:text-red-400 p-1 transition-colors"
                            title={t('delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="block text-white text-sm font-semibold">
              {currentUser?.nama || 'Admin'}
            </span>
            <small className="text-gray-500 text-xs">
              {currentUser?.role === 'superadmin'
                ? 'Super Admin'
                : currentUser?.role === 'admin'
                ? 'Admin'
                : 'User'}
            </small>
          </div>
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-500">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                currentUser?.nama || 'Admin'
              )}&background=ff6b00&color=fff&size=64`}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
