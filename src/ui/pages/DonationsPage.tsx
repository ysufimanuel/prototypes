/**
 * Donations Page - Kelola donasi dan keuangan gereja
 */

import { useState, useMemo, useEffect } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { formatRupiah, formatDate } from '@/utils/formatters';
import { canEdit, canDelete } from '@/auth/permissions';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import type { Donation } from '@/types/models';
import { HeartHandshake, Search, Plus, Pencil, Trash2, X, TrendingUp, Users, BarChart3 } from 'lucide-react';

export function DonationsPage() {
  const { donations, donors, currentUser } = useStoreSelector(s => ({ donations: s.donations, donors: s.donors, currentUser: s.currentUser }));
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [formData, setFormData] = useState<Partial<Donation>>({});

  const userCanEdit = canEdit(currentUser);
  const userCanDelete = canDelete(currentUser);

  useEffect(() => {
    const unsub = subscribeToCollection<Donation>(DB_COLLECTIONS.DONATIONS, (data) => store.setCollection('donations', data));
    return unsub;
  }, []);

  const filteredDonations = useMemo(() => {
    return donations.filter(d => {
      const donor = donors.find(don => don.id === d.donorId);
      const matchSearch = !search || donor?.nama?.toLowerCase().includes(search.toLowerCase());
      const matchType = !filterType || d.tipe === filterType;
      const matchMonth = !filterMonth || d.tanggal?.startsWith(filterMonth);
      return matchSearch && matchType && matchMonth;
    }).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [donations, donors, search, filterType, filterMonth]);

  const stats = useMemo(() => ({
    total: donations.reduce((s, d) => s + (d.jumlah || 0), 0),
    count: donations.length,
    avg: donations.length ? Math.round(donations.reduce((s, d) => s + (d.jumlah || 0), 0) / donations.length) : 0,
  }), [donations]);

  const getDonorName = (id: string) => donors.find(d => d.id === id)?.nama || '-';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    store.setLoading(true);
    try {
      if (editingDonation) { await updateDocument(DB_COLLECTIONS.DONATIONS, editingDonation.id, formData); }
      else { await addDocument<Donation>(DB_COLLECTIONS.DONATIONS, formData as Donation); }
      store.showToast(t('save-success'), 'success'); setShowModal(false); setFormData({});
    } catch { store.showToast(t('save-error'), 'error'); }
    store.setLoading(false);
  };

  const handleDelete = async (don: Donation) => {
    if (!window.confirm(t('confirm-delete'))) return;
    store.setLoading(true);
    try { await deleteDocument(DB_COLLECTIONS.DONATIONS, don.id); store.showToast(t('delete-success'), 'success'); }
    catch { store.showToast(t('delete-error'), 'error'); }
    store.setLoading(false);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6"><h1 className="text-2xl font-bold text-white flex items-center gap-3"><HeartHandshake className="w-7 h-7 text-orange-500" />{t('donations')}</h1><p className="text-gray-400 text-sm mt-1">{t('manage-donations')}</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-5 flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white"><TrendingUp className="w-6 h-6" /></div><div><h3 className="text-2xl font-bold text-white">{formatRupiah(stats.total)}</h3><p className="text-gray-400 text-sm">{t('total-donations')}</p></div></div>
        <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-5 flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white"><Users className="w-6 h-6" /></div><div><h3 className="text-2xl font-bold text-white">{stats.count}</h3><p className="text-gray-400 text-sm">{t('total-donors')}</p></div></div>
        <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-5 flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white"><BarChart3 className="w-6 h-6" /></div><div><h3 className="text-2xl font-bold text-white">{formatRupiah(stats.avg)}</h3><p className="text-gray-400 text-sm">{t('average-donation')}</p></div></div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="flex gap-2">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="">{t('all-types')}</option><option value="perpuluhan">{t('tithe')}</option><option value="persembahan">{t('offering')}</option><option value="pembangunan">{t('building')}</option><option value="sosial">{t('social')}</option></select>
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="px-3 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
        {userCanEdit && <button onClick={() => { setEditingDonation(null); setFormData({ tanggal: new Date().toISOString().split('T')[0] }); setShowModal(true); }} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />{t('add-donation')}</button>}
      </div>

      <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[#2a2a2a]"><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('date')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('donor')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('type')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('description')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('amount')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('action')}</th></tr></thead>
            <tbody>
              {filteredDonations.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-gray-500">{t('no-data')}</td></tr> :
                filteredDonations.map(d => (
                  <tr key={d.id} className="border-b border-[#2a2a2a]/50 hover:bg-[#0a0a0a]/50">
                    <td className="px-5 py-4 text-gray-400 text-sm">{formatDate(d.tanggal)}</td>
                    <td className="px-5 py-4 text-white text-sm">{getDonorName(d.donorId)}</td>
                    <td className="px-5 py-4"><span className="px-2 py-1 bg-orange-500/10 text-orange-400 rounded-full text-xs">{d.tipe}</span></td>
                    <td className="px-5 py-4 text-gray-400 text-sm">{d.keterangan || '-'}</td>
                    <td className="px-5 py-4 text-white text-sm font-medium">{formatRupiah(d.jumlah)}</td>
                    <td className="px-5 py-4"><div className="flex gap-1">{userCanEdit && <button onClick={() => { setEditingDonation(d); setFormData({ ...d }); setShowModal(true); }} className="p-1.5 rounded-lg text-gray-500 hover:text-orange-400"><Pencil className="w-4 h-4" /></button>}{userCanDelete && <button onClick={() => handleDelete(d)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}</div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]"><h3 className="text-white font-semibold text-lg">{editingDonation ? t('edit') : t('add-donation')}</h3><button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('select-donor')} *</label><select required value={formData.donorId || ''} onChange={e => setFormData({ ...formData, donorId: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="">-</option>{donors.map(d => <option key={d.id} value={d.id}>{d.nama}</option>)}</select></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('donation-type')}</label><select value={formData.tipe || 'perpuluhan'} onChange={e => setFormData({ ...formData, tipe: e.target.value as any })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="perpuluhan">{t('tithe')}</option><option value="persembahan">{t('offering')}</option><option value="pembangunan">{t('building')}</option><option value="sosial">{t('social')}</option></select></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('amount')} *</label><input type="number" required value={formData.jumlah || ''} onChange={e => setFormData({ ...formData, jumlah: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('date')}</label><input type="date" value={formData.tanggal || ''} onChange={e => setFormData({ ...formData, tanggal: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('description')}</label><textarea value={formData.keterangan || ''} onChange={e => setFormData({ ...formData, keterangan: e.target.value })} rows={2} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500 resize-none" /></div>
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm">{t('cancel')}</button><button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium">{t('save')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
