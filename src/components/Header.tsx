import {
  Search, Bell, LogOut, Globe, UserPlus, CalendarPlus, ClipboardCheck,
  Moon, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CurrentUser } from '@/types';

interface HeaderProps {
  user: CurrentUser | null;
  lang: 'id' | 'en';
  t: (key: string) => string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onToggleLang: () => void;
  onLogout: () => void;
  onQuickAction: (action: string) => void;
  notificationCount?: number;
  onToggleNotifications?: () => void;
}

export function Header({
  user,
  lang,
  t,
  searchTerm,
  onSearchChange,
  onToggleLang,
  onLogout,
  onQuickAction,
  notificationCount = 0,
  onToggleNotifications,
}: HeaderProps) {
  return (
    <header className="h-16 bg-[#1e1e1e]/90 backdrop-blur-md border-b border-white/10 flex items-center px-6 gap-4 sticky top-0 z-30">
      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('search')}
          className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50 transition-colors"
        />
      </div>

      {/* Quick Actions */}
      <div className="hidden md:flex items-center gap-1">
        <button
          onClick={() => onQuickAction('member')}
          className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all"
          title={t('member-add')}
        >
          <UserPlus className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={() => onQuickAction('event')}
          className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all"
          title={t('event-add')}
        >
          <CalendarPlus className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={() => onQuickAction('checkin')}
          className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all"
          title={t('check-in')}
        >
          <ClipboardCheck className="w-[18px] h-[18px]" />
        </button>
      </div>

      <div className="w-px h-6 bg-white/10 hidden md:block" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Language */}
        <button
          onClick={onToggleLang}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          title={lang === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia'}
        >
          <Globe className="w-[18px] h-[18px]" />
        </button>

        {/* Theme */}
        <button className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
          <Moon className="w-[18px] h-[18px]" />
        </button>

        {/* Notifications */}
        <button
          onClick={onToggleNotifications}
          className="relative p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
        >
          <Bell className="w-[18px] h-[18px]" />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Role badge */}
        {user?.role && (
          <div className={cn(
            'hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
            user.role === 'superadmin' ? 'bg-red-500/10 text-red-400' :
            user.role === 'admin' ? 'bg-orange-500/10 text-orange-400' :
            'bg-blue-500/10 text-blue-400'
          )}>
            <Shield className="w-3 h-3" />
            <span className="capitalize">{user.role}</span>
          </div>
        )}

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* Logout */}
        <button
          onClick={onLogout}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
          title={t('logout')}
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
      </div>
    </header>
  );
}
