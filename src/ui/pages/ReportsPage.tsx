/**
 * Reports Page - Laporan dan manajemen data
 */

import { useMemo, useEffect, useState } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { formatRupiah } from '@/utils/formatters';
import { exportCSV, exportXLS, exportPDF, exportDOCX, exportTXT, backupData, restoreData } from '@/utils/exporters';
import { subscribeToCollection } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import type { Member, Attendance, Donation } from '@/types/models';
import { BarChart3, Users, ClipboardCheck, HeartHandshake, Download, Upload, Trash2, FileText } from 'lucide-react';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';

export function ReportsPage() {
  const { members, attendance, donations, events, groups, volunteers } = useStoreSelector(s => ({
    members: s.members, attendance: s.attendance, donations: s.donations, events: s.events,
    groups: s.groups, volunteers: s.volunteers,
  }));
  const [showClearDialog, setShowClearDialog] = useState(false);

  useEffect(() => {
    const unsub1 = subscribeToCollection<Member>(DB_COLLECTIONS.MEMBERS, (data) => store.setCollection('members', data));
    const unsub2 = subscribeToCollection<Attendance>(DB_COLLECTIONS.ATTENDANCE, (data) => store.setCollection('attendance', data));
    const unsub3 = subscribeToCollection<Donation>(DB_COLLECTIONS.DONATIONS, (data) => store.setCollection('donations', data));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const stats = useMemo(() => ({
    totalMembers: members.length,
    activeMembers: members.filter(m => m.status === 'aktif').length,
    totalAttendance: attendance.length,
    totalDonations: donations.reduce((s, d) => s + (d.jumlah || 0), 0),
    totalEvents: events.length,
    totalGroups: groups.length,
    totalVolunteers: volunteers.length,
    maleCount: members.filter(m => m.jk === 'Laki-laki').length,
    femaleCount: members.filter(m => m.jk === 'Perempuan').length,
  }), [members, attendance, donations, events, groups, volunteers]);

  const handleBackup = () => {
    const data = { members, attendance, donations, events, groups, volunteers, exportDate: new Date().toISOString() };
    backupData(data);
    store.showToast('Backup berhasil diunduh!', 'success');
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    store.setLoading(true);
    try {
      await restoreData(file);
      store.showToast('Data berhasil direstore!', 'success');
    } catch {
      store.showToast('File tidak valid', 'error');
    }
    store.setLoading(false);
  };

  const handleClearData = () => {
    setShowClearDialog(true);
  };

  const confirmClearData = () => {
    store.showToast('Data dihapus (simulasi)', 'warning');
    setShowClearDialog(false);
  };

  const generateReportData = (type: string) => {
    switch (type) {
      case 'members': return members.map(m => ({ Nama: m.nama, Email: m.email || '-', Telepon: m.telepon || '-', 'Jenis Kelamin': m.jk || '-', Status: m.status, Alamat: m.alamat || '-' }));
      case 'attendance': return attendance.map(a => ({ Tanggal: a.tanggal, Event: events.find(e => e.id === a.eventId)?.nama || '-', Nama: members.find(m => m.id === a.memberId)?.nama || '-', Waktu: a.waktu, Status: a.status }));
      case 'donations': return donations.map(d => ({ Tanggal: d.tanggal, Donatur: d.donorId, Tipe: d.tipe, Jumlah: d.jumlah, Keterangan: d.keterangan || '-' }));
      default: return [];
    }
  };

  const exportReport = (type: string, format: string) => {
    const data = generateReportData(type);
    const title = `${type}-report`;
    switch (format) {
      case 'csv': exportCSV(data, title); break;
      case 'xls': exportXLS(data, title); break;
      case 'pdf': exportPDF(data, title); break;
      case 'docx': exportDOCX(data, title); break;
      case 'txt': exportTXT(data, title); break;
    }
  };

  const reportCards = [
    { type: 'members', icon: Users, title: t('members-report'), desc: t('members-stats'), color: 'bg-blue-500' },
    { type: 'attendance', icon: ClipboardCheck, title: t('attendance-report'), desc: t('attendance-data-report'), color: 'bg-green-500' },
    { type: 'donations', icon: HeartHandshake, title: t('donations-report'), desc: t('donations-summary'), color: 'bg-orange-500' },
    { type: 'system', icon: BarChart3, title: t('system-stats'), desc: t('system-overview'), color: 'bg-purple-500' },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6"><h1 className="text-2xl font-bold text-white flex items-center gap-3"><BarChart3 className="w-7 h-7 text-orange-500" />{t('reports')}</h1><p className="text-gray-400 text-sm mt-1">{t('reports-system')}</p></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {reportCards.map(card => (
          <div key={card.type} className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6 hover:border-orange-500/20 transition-all cursor-pointer group">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center text-white`}><card.icon className="w-6 h-6" /></div>
              <div className="flex-1"><h3 className="text-white font-semibold group-hover:text-orange-400 transition-colors">{card.title}</h3><p className="text-gray-400 text-sm mt-1">{card.desc}</p></div>
            </div>
            <div className="flex gap-2 mt-4">
              {['csv', 'xls', 'pdf'].map(fmt => (
                <button key={fmt} onClick={() => exportReport(card.type, fmt)} className="px-3 py-1.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-gray-400 text-xs hover:text-orange-400 hover:border-orange-500/30 transition-all capitalize">{fmt}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-orange-500" />Ringkasan Sistem</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatBox label="Total Jemaat" value={stats.totalMembers} />
          <StatBox label="Jemaat Aktif" value={stats.activeMembers} />
          <StatBox label="Total Kehadiran" value={stats.totalAttendance} />
          <StatBox label="Total Donasi" value={formatRupiah(stats.totalDonations)} />
          <StatBox label="Total Event" value={stats.totalEvents} />
          <StatBox label="Total Grup" value={stats.totalGroups} />
          <StatBox label="Total Relawan" value={stats.totalVolunteers} />
          <StatBox label="Laki-laki / Perempuan" value={`${stats.maleCount} / ${stats.femaleCount}`} />
        </div>

        <h3 className="text-lg font-semibold text-orange-400 mb-4 mt-8">Manajemen Data</h3>
        <div className="flex gap-3 flex-wrap">
          <button onClick={handleBackup} className="px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-sm font-medium flex items-center gap-2 hover:bg-blue-500/20 transition-colors"><Download className="w-4 h-4" />{t('backup-data')}</button>
          <label className="px-4 py-2.5 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm font-medium flex items-center gap-2 hover:bg-green-500/20 transition-colors cursor-pointer"><Upload className="w-4 h-4" />{t('restore-data')}<input type="file" accept=".json" onChange={handleRestore} className="hidden" /></label>
          <button onClick={handleClearData} className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium flex items-center gap-2 hover:bg-red-500/20 transition-colors"><Trash2 className="w-4 h-4" />{t('clear-all-data')}</button>
        </div>
      </div>
      <ConfirmDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        onConfirm={confirmClearData}
        title="Hapus Semua Data"
        description="Yakin ingin menghapus SEMUA data? Tindakan ini tidak bisa dibatalkan!"
        confirmText="Hapus Semua"
        cancelText="Batal"
        destructive
      />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#2a2a2a]">
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-white text-lg font-semibold mt-1">{value}</p>
    </div>
  );
}
