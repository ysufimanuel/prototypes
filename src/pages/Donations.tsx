import { useState, useMemo } from 'react';
import { HandHeart, Search, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ModalForm } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToCSV, formatRupiah, formatDate } from '@/lib/utils';
import type { AppData, Donation, Language } from '@/types';

interface DonationsProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

const donationTypes = [
  { value: 'perpuluhan', label: { id: 'Perpuluhan', en: 'Tithe' } },
  { value: 'persembahan', label: { id: 'Persembahan', en: 'Offering' } },
  { value: 'khusus', label: { id: 'Khusus', en: 'Special' } },
  { value: 'lainnya', label: { id: 'Lainnya', en: 'Other' } },
];

export function Donations({ data, updateData, lang, t, canEdit, canDelete, showToast }: DonationsProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const [formData, setFormData] = useState<Partial<Donation>>({ donorId: null, jumlah: 0, tipe: 'perpuluhan', tanggal: new Date().toISOString().split('T')[0], keterangan: '', eventId: null });

  const filtered = useMemo(() => {
    return data.donations.filter(d => {
      const donor = data.members.find(m => m.id === d.donorId);
      const matchesSearch = !search || donor?.nama.toLowerCase().includes(search.toLowerCase()) || d.keterangan.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || d.tipe === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [data.donations, data.members, search, typeFilter]);

  const total = useMemo(() => filtered.reduce((sum, d) => sum + d.jumlah, 0), [filtered]);

  const resetForm = () => { setFormData({ donorId: null, jumlah: 0, tipe: 'perpuluhan', tanggal: new Date().toISOString().split('T')[0], keterangan: '', eventId: null }); setEditingId(null); };
  const openAdd = () => { resetForm(); setIsModalOpen(true); };
  const openEdit = (d: Donation) => { setFormData({ ...d }); setEditingId(d.id); setIsModalOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.donorId || !formData.jumlah) { showToast(lang === 'id' ? 'Donatur dan jumlah wajib diisi' : 'Donor and amount are required', 'error'); return; }
    updateData(prev => {
      if (editingId) {
        const idx = prev.donations.findIndex(d => d.id === editingId);
        if (idx === -1) return prev;
        const updated = [...prev.donations];
        updated[idx] = { ...updated[idx], ...formData } as Donation;
        return { ...prev, donations: updated };
      } else {
        const newId = Math.max(...prev.donations.map(d => d.id), 0) + 1;
        return { ...prev, donations: [...prev.donations, { ...formData, id: newId } as Donation] };
      }
    });
    showToast(editingId ? (lang === 'id' ? 'Donasi diperbarui' : 'Donation updated') : (lang === 'id' ? 'Donasi ditambahkan' : 'Donation added'), 'success');
    setIsModalOpen(false); resetForm();
  };

  const handleDelete = (id: number) => {
    updateData(prev => ({ ...prev, donations: prev.donations.filter(d => d.id !== id) }));
    showToast(lang === 'id' ? 'Donasi dihapus' : 'Donation deleted', 'success');
    setConfirmDelete(null);
  };

  const handleExport = () => {
    exportToCSV(filtered.map(d => {
      const donor = data.members.find(m => m.id === d.donorId);
      return { Tanggal: d.tanggal, Donatur: donor?.nama || '-', Tipe: d.tipe, Jumlah: d.jumlah, Keterangan: d.keterangan };
    }), 'donations');
    showToast(lang === 'id' ? 'Data diexport' : 'Data exported', 'success');
  };

  const inputClass = "w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

  return (
    <div>
      <PageHeader title={t('donations')} subtitle={`${filtered.length} ${lang === 'id' ? 'donasi' : 'donations'} - Total: ${formatRupiah(total)}`} onAdd={canEdit ? openAdd : undefined} addLabel={t('add-donation')} onExport={handleExport} canEdit={canEdit} lang={lang} />
      
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="all">{t('all')} {t('type')}</option>
            {donationTypes.map(t => <option key={t.value} value={t.value}>{t.label[lang]}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('date')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('donor')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('type')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('amount')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('description')}</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500">{t('no-data')}</td></tr>
              ) : filtered.map(d => {
                const donor = data.members.find(m => m.id === d.donorId);
                const typeLabel = donationTypes.find(t => t.value === d.tipe);
                return (
                  <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-300">{formatDate(d.tanggal, lang)}</td>
                    <td className="py-3 px-4 text-sm text-white font-medium">{donor?.nama || 'Anonymous'}</td>
                    <td className="py-3 px-4 text-sm text-gray-300">{typeLabel?.label[lang] || d.tipe}</td>
                    <td className="py-3 px-4 text-sm text-orange-400 font-medium">{formatRupiah(d.jumlah)}</td>
                    <td className="py-3 px-4 text-sm text-gray-300">{d.keterangan}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"><Pencil className="w-4 h-4" /></button>}
                        {canDelete && <button onClick={() => setConfirmDelete(d.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ModalForm isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? (lang === 'id' ? 'Edit Donasi' : 'Edit Donation') : t('add-donation')} onSubmit={handleSubmit} lang={lang}>
        <div className="space-y-4">
          <div><label className={labelClass}>{t('donor')} *</label>
            <select value={formData.donorId || ''} onChange={e => setFormData(p => ({ ...p, donorId: Number(e.target.value) }))} className={inputClass} required>
              <option value="">{t('select')}</option>
              {data.members.filter(m => m.status === 'aktif').map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>{t('type')}</label>
            <select value={formData.tipe || 'perpuluhan'} onChange={e => setFormData(p => ({ ...p, tipe: e.target.value as Donation['tipe'] }))} className={inputClass}>
              {donationTypes.map(t => <option key={t.value} value={t.value}>{t.label[lang]}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>{t('amount')} *</label><input type="number" value={formData.jumlah || ''} onChange={e => setFormData(p => ({ ...p, jumlah: Number(e.target.value) }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{t('date')}</label><input type="date" value={formData.tanggal || ''} onChange={e => setFormData(p => ({ ...p, tanggal: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>{t('description')}</label><input type="text" value={formData.keterangan || ''} onChange={e => setFormData(p => ({ ...p, keterangan: e.target.value }))} className={inputClass} /></div>
        </div>
      </ModalForm>

      <ConfirmDialog isOpen={confirmDelete !== null} title={t('confirm')} message={lang === 'id' ? 'Hapus donasi ini?' : 'Delete this donation?'} onConfirm={() => confirmDelete !== null && handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} lang={lang} />
    </div>
  );
}
