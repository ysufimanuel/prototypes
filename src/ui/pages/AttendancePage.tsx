/**
 * Attendance Page - Sistem check-in dan data kehadiran
 */

import { useState, useMemo, useEffect } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { formatDate } from '@/utils/formatters';
import { canEdit } from '@/auth/permissions';
import { subscribeToCollection, addDocument } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import type { Attendance } from '@/types/models';
import { ClipboardCheck, Search, Check, Calendar, Clock } from 'lucide-react';

type AttendanceTab = 'checkin' | 'data' | 'report';

export function AttendancePage() {
  const { attendance, events, members, currentUser } = useStoreSelector(s => ({
    attendance: s.attendance, events: s.events, members: s.members, currentUser: s.currentUser,
  }));

  const [activeTab, setActiveTab] = useState<AttendanceTab>('checkin');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [searchMember, setSearchMember] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const userCanEdit = canEdit(currentUser);

  useEffect(() => {
    const unsub1 = subscribeToCollection<Attendance>(DB_COLLECTIONS.ATTENDANCE, (data) => store.setCollection('attendance', data));
    return unsub1;
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayAttendance = useMemo(() => attendance.filter(a => a.tanggal === today), [attendance]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter(a => {
      const matchEvent = !selectedEvent || a.eventId === selectedEvent;
      const matchDate = !filterDate || a.tanggal === filterDate;
      return matchEvent && matchDate;
    }).sort((a, b) => new Date(b.tanggal + 'T' + b.waktu).getTime() - new Date(a.tanggal + 'T' + a.waktu).getTime());
  }, [attendance, selectedEvent, filterDate]);

  const getMemberName = (id: string) => members.find(m => m.id === id)?.nama || '-';
  const getEventName = (id: string) => events.find(e => e.id === id)?.nama || '-';

  const searchResults = useMemo(() => {
    if (!searchMember || searchMember.length < 2) return [];
    return members.filter(m =>
      m.nama?.toLowerCase().includes(searchMember.toLowerCase()) && m.status === 'aktif'
    ).slice(0, 5);
  }, [searchMember, members]);

  const handleCheckIn = async (memberId: string) => {
    if (!selectedEvent) { store.showToast('Pilih event terlebih dahulu', 'warning'); return; }
    store.setLoading(true);
    try {
      const now = new Date();
      await addDocument(DB_COLLECTIONS.ATTENDANCE, {
        eventId: selectedEvent,
        memberId,
        tanggal: today,
        waktu: now.toTimeString().slice(0, 5),
        status: 'hadir',
      });
      setSearchMember('');
      store.showToast('Check-in berhasil!', 'success');
    } catch { store.showToast('Gagal check-in', 'error'); }
    store.setLoading(false);
  };

  // Report data
  const reportData = useMemo(() => {
    const total = attendance.length;
    const eventCounts: Record<string, number> = {};
    attendance.forEach(a => { eventCounts[a.eventId] = (eventCounts[a.eventId] || 0) + 1; });
    const topEventId = Object.entries(eventCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { total, average: events.length ? Math.round(total / events.length) : 0, topEvent: topEventId ? getEventName(topEventId) : '-' };
  }, [attendance, events]);

  const tabs = [
    { key: 'checkin' as AttendanceTab, label: t('checkin') },
    { key: 'data' as AttendanceTab, label: t('attendance-data') },
    { key: 'report' as AttendanceTab, label: t('report') },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6"><h1 className="text-2xl font-bold text-white flex items-center gap-3"><ClipboardCheck className="w-7 h-7 text-orange-500" />{t('attendance')}</h1><p className="text-gray-400 text-sm mt-1">{t('attendance-system')}</p></div>

      <div className="flex gap-1 bg-[#141414] rounded-xl p-1 mb-6 border border-[#2a2a2a]">
        {tabs.map(tab => <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-orange-500/15 text-orange-400' : 'text-gray-400 hover:text-white'}`}>{tab.label}</button>)}
      </div>

      {activeTab === 'checkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Check className="w-5 h-5 text-orange-500" />{t('checkin-attendance')}</h3>
            <div className="space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('select-event')}</label><select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="">- Pilih Event -</option>{events.filter(e => e.status !== 'completed').map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}</select></div>
              {userCanEdit && (
                <div><label className="block text-sm text-gray-400 mb-1.5">{t('search-member')}</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" value={searchMember} onChange={e => setSearchMember(e.target.value)} placeholder="Ketik nama jemaat..." className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" />
                    {searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-xl z-10 overflow-hidden">
                        {searchResults.map(m => (
                          <button key={m.id} onClick={() => handleCheckIn(m.id)} className="w-full text-left px-4 py-2.5 text-gray-300 text-sm hover:bg-orange-500/10 hover:text-orange-400 transition-colors flex items-center justify-between">
                            <span>{m.nama}</span><Check className="w-4 h-4 text-green-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-orange-500" />{t('today-attendance')} ({todayAttendance.length})</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {todayAttendance.length === 0 ? <p className="text-gray-500 text-sm text-center py-8">Belum ada check-in hari ini</p> :
                todayAttendance.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-xl">
                    <div><p className="text-white text-sm font-medium">{getMemberName(a.memberId)}</p><p className="text-gray-500 text-xs">{getEventName(a.eventId)}</p></div>
                    <div className="flex items-center gap-1 text-gray-400 text-xs"><Clock className="w-3 h-3" />{a.waktu}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'data' && (
        <div>
          <div className="flex gap-3 mb-4">
            <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="px-3 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="">{t('all-events')}</option>{events.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}</select>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="px-3 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-[#2a2a2a]"><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('date')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('event')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('name')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('checkin-time')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('status')}</th></tr></thead>
                <tbody>
                  {filteredAttendance.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-gray-500">{t('no-data')}</td></tr> :
                    filteredAttendance.map(a => (
                      <tr key={a.id} className="border-b border-[#2a2a2a]/50"><td className="px-5 py-4 text-gray-400 text-sm">{formatDate(a.tanggal)}</td><td className="px-5 py-4 text-white text-sm">{getEventName(a.eventId)}</td><td className="px-5 py-4 text-white text-sm">{getMemberName(a.memberId)}</td><td className="px-5 py-4 text-gray-400 text-sm">{a.waktu}</td><td className="px-5 py-4"><span className="px-2 py-1 bg-green-500/10 text-green-400 rounded-full text-xs">{a.status}</span></td></tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'report' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6 text-center"><h4 className="text-gray-400 text-sm mb-2">{t('total-attendance')}</h4><p className="text-3xl font-bold text-white">{reportData.total}</p></div>
            <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6 text-center"><h4 className="text-gray-400 text-sm mb-2">{t('average')}</h4><p className="text-3xl font-bold text-white">{reportData.average}</p></div>
            <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6 text-center"><h4 className="text-gray-400 text-sm mb-2">{t('top-event')}</h4><p className="text-xl font-bold text-white truncate">{reportData.topEvent}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
