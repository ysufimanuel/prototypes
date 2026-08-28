import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Heart, Group, Calendar, ClipboardCheck,
  HandHeart, Wallet, Handshake, MessageSquare, FileText, UserCog,
  Settings, Skull, ChevronLeft, ChevronRight, Church
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CurrentUser } from '@/types';

interface SidebarProps {
  user: CurrentUser | null;
  lang: 'id' | 'en';
  t: (key: string) => string;
  onCollapse?: (collapsed: boolean) => void;
}

const menuItems = [
  { key: 'dashboard', icon: LayoutDashboard, path: '/', label: 'dashboard' },
  { key: 'members', icon: Users, path: '/members', label: 'members' },
  { key: 'families', icon: Heart, path: '/families', label: 'families' },
  { key: 'groups', icon: Group, path: '/groups', label: 'groups' },
  { key: 'events', icon: Calendar, path: '/events', label: 'events' },
  { key: 'attendance', icon: ClipboardCheck, path: '/attendance', label: 'attendance' },
  { key: 'donations', icon: HandHeart, path: '/donations', label: 'donations' },
  { key: 'finance', icon: Wallet, path: '/finance', label: 'finance' },
  { key: 'volunteers', icon: Handshake, path: '/volunteers', label: 'volunteers' },
  { key: 'communication', icon: MessageSquare, path: '/communication', label: 'communication' },
  { key: 'reports', icon: FileText, path: '/reports', label: 'reports' },
  { key: 'users', icon: UserCog, path: '/users', label: 'users' },
  { key: 'deaths', icon: Skull, path: '/deaths', label: 'deaths' },
  { key: 'settings', icon: Settings, path: '/settings', label: 'settings' },
];

export function Sidebar({ user, lang, t, onCollapse }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    onCollapse?.(next);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const roleColor = user?.role === 'superadmin' ? 'text-red-400' : user?.role === 'admin' ? 'text-orange-400' : 'text-blue-400';

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 bg-[#1e1e1e] border border-white/10 rounded-lg flex items-center justify-center text-white"
      >
        {mobileOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      <aside
        className={cn(
          'fixed left-0 top-0 h-screen bg-[#121212] border-r border-white/10 z-40 transition-all duration-300 flex flex-col',
          collapsed ? 'w-[70px]' : 'w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-3 px-4 h-16 border-b border-white/10 flex-shrink-0',
          collapsed && 'justify-center px-2'
        )}>
          <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Church className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-white truncate">CMS</h1>
              <p className="text-[10px] text-gray-500 truncate">V6.0.0</p>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.key}
                onClick={() => handleNavigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group',
                  isActive
                    ? 'bg-gradient-to-r from-orange-500/20 to-transparent text-orange-400 border-l-2 border-orange-500'
                    : 'text-gray-400 hover:text-white hover:bg-white/5',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? t(item.label) : undefined}
              >
                <Icon className={cn(
                  'w-[18px] h-[18px] flex-shrink-0',
                  isActive && 'text-orange-400'
                )} />
                {!collapsed && <span className="truncate">{t(item.label)}</span>}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-white/10 p-3 flex-shrink-0">
          <div className={cn(
            'flex items-center gap-3',
            collapsed && 'justify-center'
          )}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user?.nama?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            {!collapsed && (
              <div className="overflow-hidden min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.nama || 'User'}</p>
                <p className={cn('text-xs capitalize', roleColor)}>
                  {user?.role || 'user'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="hidden lg:flex items-center justify-center h-10 border-t border-white/10 text-gray-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    </>
  );
}
