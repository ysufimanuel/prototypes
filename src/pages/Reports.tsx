import { useState, useMemo } from 'react';
import { FileText, BarChart3, Users, ClipboardCheck, HandHeart, Printer } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { exportToCSV, formatRupiah, formatDate, cn } from '@/lib/utils';
import type { AppData, Language } from '@/types';

interface ReportsProps {
  data: AppData;
  lang: Language;
  t: (key: string) => string;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function Reports({ data, lang, t, showToast }: ReportsProps) {
  const [reportType, setReportType] = useState<'members' | 'attendance' | 'donations' | 'system'>('members');

  const stats = useMemo(() => {
    const active = data.members.filter(m => m.status === 'aktif').length;
    const inactive = data.members.filter(m => m.status === 'tidak-aktif').length;
    const male = data.members.filter(m => m.jk === 'Laki-laki').length;
    const female = data.members.filter(m => m.jk === 'Perempuan').length;
    const totalDonations = data.donations.reduce((s, d) => s + d.jumlah, 0);
    return { total: data.members.length, active, inactive, male, female, totalDonations };
  }, [data]);

  const handleExport = () => {
    let exportData: Record<string, any>[] = [];
    let filename = '';
    switch (reportType) {
      case 'members':
        exportData = data.members.map(m => ({ Nama: m.nama, Email: m.email, Telepon: m.telepon, Gender: m.jk, Status: m.status, Alamat: m.alamat, Kota: m.kota }));
        filename = 'laporan-jemaat'; break;
      case 'attendance':
        exportData = data.attendance.map(a => { const m = data.members.find(mem => mem.id === a.memberId); const e = data.events.find(ev => ev.id === a.eventId); return { Tanggal: a.tanggal, Acara: e?.nama || '-', Nama: m?.nama || '-', Waktu: a.waktu }; });
        filename = 'laporan-kehadiran'; break;
      case 'donations':
        exportData = data.donations.map(d => { const donor = data.members.find(m => m.id === d.donorId); return { Tanggal: d.tanggal, Donatur: donor?.nama || '-', Tipe: d.tipe, Jumlah: d.jumlah }; });
        filename = 'laporan-donasi'; break;
      case 'system':
        exportData = [{ Jemaat: data.members.length, Keluarga: data.families.length, Grup: data.groups.length, Acara: data.events.length, Relawan: data.volunteers.length, Donasi: data.donations.length }];
        filename = 'laporan-sistem'; break;
    }
    exportToCSV(exportData, filename);
    showToast(lang === 'id' ? 'Data diexport' : 'Data exported', 'success');
  };

  return (
    <div>
      <PageHeader title={t('reports')} onExport={handleExport} lang={lang} />

      {/* Report Type Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'members' as const, label: t('members'), icon: Users },
          { key: 'attendance' as const, label: t('attendance'), icon: ClipboardCheck },
          { key: 'donations' as const, label: t('donations'), icon: HandHeart },
          { key: 'system' as const, label: lang === 'id' ? 'Sistem' : 'System', icon: BarChart3 },
        ].map(r => (
          <button key={r.key} onClick={() => setReportType(r.key)} className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all', reportType === r.key ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent')}>
            <r.icon className="w-4 h-4" /> {r.label}
          </button>
        ))}
      </div>

      {reportType === 'members' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[{ label: t('members'), value: stats.total, color: 'text-white' }, { label: t('active'), value: stats.active, color: 'text-green-400' }, { label: t('inactive'), value: stats.inactive, color: 'text-gray-400' }, { label: lang === 'id' ? 'Laki-laki' : 'Male', value: stats.male, color: 'text-blue-400' }].map((s, i) => (
              <div key={i} className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 text-center">
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('name')}</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('email')}</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('gender')}</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('status')}</th>
                </tr></thead>
                <tbody>
                  {data.members.map(m => (
                    <tr key={m.id} className="border-b border-white/5">
                      <td className="py-3 px-4 text-sm text-white">{m.nama}</td>
                      <td className="py-3 px-4 text-sm text-gray-300">{m.email}</td>
                      <td className="py-3 px-4 text-sm text-gray-300">{m.jk}</td>
                      <td className="py-3 px-4"><span className={cn('text-xs px-2 py-0.5 rounded-full', m.status === 'aktif' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400')}>{m.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {reportType === 'attendance' && (
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('date')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('event')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('name')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('checkin-time')}</th>
              </tr></thead>
              <tbody>
                {data.attendance.map(a => {
                  const m = data.members.find(mem => mem.id === a.memberId);
                  const e = data.events.find(ev => ev.id === a.eventId);
                  return (
                    <tr key={a.id} className="border-b border-white/5">
                      <td className="py-3 px-4 text-sm text-gray-300">{a.tanggal}</td>
                      <td className="py-3 px-4 text-sm text-gray-300">{e?.nama || '-'}</td>
                      <td className="py-3 px-4 text-sm text-white">{m?.nama || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-300">{a.waktu}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === 'donations' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[{ label: lang === 'id' ? 'Total Donasi' : 'Total Donations', value: formatRupiah(stats.totalDonations), color: 'text-orange-400' }, { label: lang === 'id' ? 'Jumlah Donasi' : 'Donation Count', value: data.donations.length, color: 'text-green-400' }, { label: lang === 'id' ? 'Rata-rata' : 'Average', value: formatRupiah(data.donations.length > 0 ? Math.round(stats.totalDonations / data.donations.length) : 0), color: 'text-blue-400' }].map((s, i) => (
              <div key={i} className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 text-center">
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('date')}</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('donor')}</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('type')}</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('amount')}</th>
                </tr></thead>
                <tbody>
                  {data.donations.map(d => {
                    const donor = data.members.find(m => m.id === d.donorId);
                    return (
                      <tr key={d.id} className="border-b border-white/5">
                        <td className="py-3 px-4 text-sm text-gray-300">{d.tanggal}</td>
                        <td className="py-3 px-4 text-sm text-white">{donor?.nama || 'Anonymous'}</td>
                        <td className="py-3 px-4 text-sm text-gray-300">{d.tipe}</td>
                        <td className="py-3 px-4 text-sm text-orange-400 font-medium">{formatRupiah(d.jumlah)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {reportType === 'system' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[{ label: t('members'), value: data.members.length, color: 'text-orange-400' }, { label: t('families'), value: data.families.length, color: 'text-pink-400' }, { label: t('groups'), value: data.groups.length, color: 'text-blue-400' }, { label: t('events'), value: data.events.length, color: 'text-purple-400' }, { label: t('volunteers'), value: data.volunteers.length, color: 'text-teal-400' }, { label: lang === 'id' ? 'Pengguna' : 'Users', value: data.users.length, color: 'text-yellow-400' }].map((s, i) => (
            <div key={i} className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5 text-center">
              <p className={cn('text-3xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
