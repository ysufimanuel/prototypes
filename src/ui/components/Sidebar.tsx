/**
 * Sidebar Component - Navigasi samping
 */

import { NavLink } from 'react-router-dom';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { canManageUsers } from '@/auth/permissions';
import {
  LayoutDashboard,
  Users,
  Home,
  Group,
  Calendar,
  ClipboardCheck,
  HeartHandshake,
  Banknote,
  HandHelping,
  MessageSquare,
  BarChart3,
  Shield,
  Cross,
  Church,
  LogOut,
  X,
} from 'lucide-react';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'dashboard' },
  { path: '/members', icon: Users, label: 'members' },
  { path: '/families', icon: Home, label: 'families' },
  { path: '/groups', icon: Group, label: 'groups' },
  { path: '/events', icon: Calendar, label: 'events' },
  { path: '/attendance', icon: ClipboardCheck, label: 'attendance' },
  { path: '/donations', icon: HeartHandshake, label: 'donations' },
  { path: '/finance', icon: Banknote, label: 'finance' },
  { path: '/volunteers', icon: HandHelping, label: 'volunteers' },
  { path: '/communication', icon: MessageSquare, label: 'communication' },
  { path: '/reports', icon: BarChart3, label: 'reports' },
  { path: '/deaths', icon: Cross, label: 'deaths' },
];

export function Sidebar() {
  const { sidebarOpen, churchName, currentUser } = useStoreSelector(s => ({
    sidebarOpen: s.sidebarOpen,
    churchName: s.churchName,
    currentUser: s.currentUser,
  }));

  const showUsersMenu = canManageUsers(currentUser);

  return (
    <>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[998] lg:hidden"
          onClick={() => store.set({ sidebarOpen: false })}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[280px] bg-[#141414] border-r border-[#2a2a2a] z-[999] flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-6 border-b border-[#2a2a2a]">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Church className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-base truncate">{t('cms-title')}</h3>
            <span className="text-gray-500 text-xs truncate block">{churchName}</span>
          </div>
          <button
            onClick={() => store.set({ sidebarOpen: false })}
            className="lg:hidden text-gray-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-1 px-3">
            {menuItems.map(item => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      store.set({ sidebarOpen: false });
                    }
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500/15 to-orange-500/5 text-orange-400 border-l-[3px] border-orange-500'
                        : 'text-gray-400 hover:bg-orange-500/8 hover:text-orange-400'
                    }`
                  }
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span>{t(item.label)}</span>
                </NavLink>
              </li>
            ))}

            {/* Users Management - Superadmin only */}
            {showUsersMenu && (
              <li>
                <NavLink
                  to="/users"
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      store.set({ sidebarOpen: false });
                    }
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500/15 to-orange-500/5 text-orange-400 border-l-[3px] border-orange-500'
                        : 'text-gray-400 hover:bg-orange-500/8 hover:text-orange-400'
                    }`
                  }
                >
                  <Shield className="w-[18px] h-[18px]" />
                  <span>{t('user-management')}</span>
                </NavLink>
              </li>
            )}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-[#2a2a2a]">
          <button
            onClick={() => {
              import('@/auth/auth').then(m => m.logoutUser());
            }}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-[#2a2a2a] text-gray-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all duration-200 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
