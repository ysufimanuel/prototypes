import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Heart, Group, Calendar, HandHeart, Wallet,
  Handshake, FileText, Bell, UserPlus, CalendarPlus, ClipboardCheck
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { cn, formatDate, getBirthdayText, calculateAge } from '@/lib/utils';
import type { AppData, Language } from '@/types';

interface DashboardProps {
  data: AppData;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
}

export function Dashboard({ data, lang, t, canEdit }: DashboardProps) {
  const navigate = useNavigate();

  const stats = useMemo(() => [
    { icon: Users, label: t('members'), value: data.members.length, color: 'orange' as const, path: '/members' },
    { icon: Heart, label: t('families'), value: data.families.length, color: 'green' as const, path: '/families' },
    { icon: Group, label: t('groups'), value: data.groups.length, color: 'blue' as const, path: '/groups' },
    { icon: Calendar, label: t('events'), value: data.events.length, color: 'purple' as const, path: '/events' },
    { icon: HandHeart, label: t('donations'), value: data.donations.length, color: 'red' as const, path: '/donations' },
    { icon: Wallet, label: t('finance'), value: data.pemasukan?.filter(p => p.status === 'approved').reduce((s, p) => s + p.jumlah, 0) || 0, color: 'yellow' as const, path: '/finance', isCurrency: true },
    { icon: Handshake, label: t('volunteers'), value: data.volunteers.length, color: 'orange' as const, path: '/volunteers' },
    { icon: FileText, label: t('reports'), value: '-', color: 'green' as const, path: '/reports' },
  ], [data, t]);

  const upcomingEvents = useMemo(() => {
    return [...data.events]
      .filter(e => e.status === 'upcoming' || e.status === 'ongoing')
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 5);
  }, [data.events]);

  const recentActivities = useMemo(() => {
    return [...(data.activities || [])]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [data.activities]);

  const todayBirthdays = useMemo(() => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDate = today.getDate();

    return data.members.filter(m => {
      if (!m.tglLahir || m.status !== 'aktif') return false;
      const birth = new Date(m.tglLahir);
      return birth.getMonth() + 1 === todayMonth && birth.getDate() === todayDate;
    });
  }, [data.members]);

  const weekBirthdays = useMemo(() => {
    const today = new Date();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    return data.members.filter(m => {
      if (!m.tglLahir || m.status !== 'aktif') return false;
      const birth = new Date(m.tglLahir);
      const birthThisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
      const diff = birthThisYear.getTime() - today.getTime();
      return diff > 0 && diff <= weekMs;
    });
  }, [data.members]);

  const quickActions = [
    { icon: UserPlus, label: t('member-add'), action: () => navigate('/members', { state: { openAdd: true } }), color: 'text-orange-400' },
    { icon: CalendarPlus, label: t('event-add'), action: () => navigate('/events', { state: { openAdd: true } }), color: 'text-blue-400' },
    { icon: ClipboardCheck, label: t('check-in'), action: () => navigate('/attendance'), color: 'text-green-400' },
    { icon: Bell, label: t('notifications'), action: () => {}, color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-6">
        <h1 className="text-xl font-semibold text-white">
          {t('welcome-back')}, <span className="text-orange-400">Admin</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {lang === 'id'
            ? `Hari ini ${formatDate(new Date().toISOString(), lang)}. Ada ${todayBirthdays.length} ulang tahun hari ini.`
            : `Today is ${formatDate(new Date().toISOString(), lang)}. There are ${todayBirthdays.length} birthdays today.`
          }
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        {quickActions.map((qa, i) => (
          <button
            key={i}
            onClick={qa.action}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e1e] border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-[#2a2a2a] hover:text-white transition-all"
          >
            <qa.icon className={cn('w-4 h-4', qa.color)} />
            {qa.label}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <StatCard
            key={i}
            icon={stat.icon}
            label={stat.label}
            value={stat.isCurrency ? 'Rp ' + (stat.value as number).toLocaleString('id-ID') : stat.value}
            color={stat.color}
            onClick={() => navigate(stat.path)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Events */}
        <div className="lg:col-span-2 bg-[#1e1e1e] border border-white/10 rounded-xl p-5">
          <h3 className="text-base font-semibold text-white mb-4">{t('upcoming-events')}</h3>
          {upcomingEvents.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">{t('no-data')}</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map(event => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-[#2a2a2a]/50 hover:bg-[#2a2a2a] transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{event.nama}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(event.start, lang)} &bull; {event.tempat}
                    </p>
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full capitalize',
                    event.status === 'upcoming' ? 'bg-blue-500/10 text-blue-400' :
                    event.status === 'ongoing' ? 'bg-green-500/10 text-green-400' :
                    'bg-gray-500/10 text-gray-400'
                  )}>
                    {event.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Birthday & Activities */}
        <div className="space-y-6">
          {/* Today's Birthdays */}
          {(todayBirthdays.length > 0 || weekBirthdays.length > 0) && (
            <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5">
              <h3 className="text-base font-semibold text-white mb-4">{t('birthday')}</h3>
              <div className="space-y-2">
                {todayBirthdays.map(m => (
                  <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{m.nama.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{m.nama}</p>
                      <p className="text-xs text-green-400">{calculateAge(m.tglLahir)} {lang === 'id' ? 'tahun' : 'years'} - {t('today')}!</p>
                    </div>
                  </div>
                ))}
                {weekBirthdays.slice(0, 3).map(m => (
                  <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#2a2a2a]/50">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{m.nama.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{m.nama}</p>
                      <p className="text-xs text-gray-400">{getBirthdayText(m.tglLahir, lang)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activities */}
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5">
            <h3 className="text-base font-semibold text-white mb-4">{t('recent-activities')}</h3>
            {recentActivities.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">{t('no-data')}</p>
            ) : (
              <div className="space-y-2">
                {recentActivities.map((act, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 border-b border-white/5 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-300">{act.action}</p>
                      <p className="text-xs text-gray-500">{act.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
