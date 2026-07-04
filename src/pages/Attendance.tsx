import { useState, useMemo } from 'react';
import { ClipboardCheck, Search, UserCheck, UserX, Clock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { cn, formatDate } from '@/lib/utils';
import type { AppData, Attendance, Language } from '@/types';

interface AttendanceProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

const attendanceStatuses = [
  { value: 'hadir', label: { id: 'Hadir', en: 'Present' }, color: 'text-green-400', bg: 'bg-green-500/10' },
  { value: 'izin', label: { id: 'Izin', en: 'Permission' }, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { value: 'sakit', label: { id: 'Sakit', en: 'Sick' }, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { value: 'alpha', label: { id: 'Alpha', en: 'Absent' }, color: 'text-red-400', bg: 'bg-red-500/10' },
];

export function Attendance({ data, updateData, lang, t, canEdit, showToast }: AttendanceProps) {
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    return data.attendance.filter(a => {
      const member = data.members.find(m => m.id === a.memberId);
      const matchesSearch = !search || member?.nama.toLowerCase().includes(search.toLowerCase());
      const matchesEvent = eventFilter === 'all' || a.eventId.toString() === eventFilter;
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchesSearch && matchesEvent && matchesStatus;
    });
  }, [data.attendance, data.members, search, eventFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const hadir = filtered.filter(a => a.status === 'hadir').length;
    const izin = filtered.filter(a => a.status === 'izin').length;
    const sakit = filtered.filter(a => a.status === 'sakit').length;
    const alpha = filtered.filter(a => a.status === 'alpha').length;
    return { total, hadir, izin, sakit, alpha };
  }, [filtered]);

  return (
    <div>
      <PageHeader title={t('attendance')} subtitle={`${filtered.length} ${lang === 'id' ? 'catatan' : 'records'}`} lang={lang} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { label: lang === 'id' ? 'Total' : 'Total', value: stats.total, color: 'text-white', bg: 'bg-[#1e1e1e]' },
          { label: t('present'), value: stats.hadir, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: t('permission'), value: stats.izin, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: t('sick'), value: stats.sakit, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: t('absent'), value: stats.alpha, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((s, i) => (
          <div key={i} className={cn(s.bg, 'border border-white/10 rounded-xl p-4 text-center')}>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50" />
          </div>
          <select value={eventFilter} onChange={e => setEventFilter(e.target.value)} className="bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="all">{t('all')} {t('event')}</option>
            {data.events.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="all">{t('all')} {t('status')}</option>
            {attendanceStatuses.map(s => <option key={s.value} value={s.value}>{s.label[lang]}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('name')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('event')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('date')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('checkin-time')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">{t('no-data')}</td></tr>
              ) : filtered.map(a => {
                const member = data.members.find(m => m.id === a.memberId);
                const event = data.events.find(e => e.id === a.eventId);
                const statusConfig = attendanceStatuses.find(s => s.value === a.status);
                return (
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{member?.nama.charAt(0) || '?'}</span>
                        </div>
                        <span className="text-sm text-white">{member?.nama || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">{event?.nama || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-300">{formatDate(a.tanggal, lang)}</td>
                    <td className="py-3 px-4 text-sm text-gray-300">{a.waktu}</td>
                    <td className="py-3 px-4">
                      <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', statusConfig?.bg, statusConfig?.color)}>
                        {statusConfig?.label[lang] || a.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
