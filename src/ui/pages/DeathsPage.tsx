/**
 * Deaths Page - Data kematian jemaat
 */

import { useState, useMemo, useEffect } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { formatDate } from '@/utils/formatters';
import { canEdit, canDelete } from '@/auth/permissions';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import type { Death } from '@/types/models';
import { Cross, Search, Plus, Pencil, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';

export function DeathsPage() {
  const { deaths, members, currentUser } = useStoreSelector(s => ({ deaths: s.deaths, members: s.members, currentUser: s.currentUser }));
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDeath, setEditingDeath] = useState<Death | null>(null);
  const [formData, setFormData] = useState<Partial<Death>>({});
  const [deathToDelete, setDeathToDelete] = useState<Death | null>(null);

  const userCanEdit = canEdit(currentUser);
  const userCanDelete = canDelete(currentUser);

  useEffect(() => {
    const unsub = subscribeToCollection<Death>(DB_COLLECTIONS.DEATHS, (data) => store.setCollection('deaths', data));
    return unsub;
  }, []);

  const filteredDeaths = useMemo(() => {
    return deaths.filter(d => {
      const member = members.find(m => m.id === d.memberId);
      return !search || d.nama?.toLowerCase().includes(search.toLowerCase()) || member?.nama?.toLowerCase().includes(search.toLowerCase());
    }).sort((a, b) => new Date(b.tglMeninggal).getTime() - new Date(a.tglMeninggal).getTime());
  }, [deaths, members, search]);

  const getMemberName = (id?: string) => {
    if (!id) return '-';
    return members.find(m => m.id === id)?.nama || id;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    store.setLoading(true);
    try {
      if (editingDeath) {
        await updateDocument(DB_COLLECTIONS.DEATHS, editingDeath.id, formData);
      } else {
        await addDocument<Death>(DB_COLLECTIONS.DEATHS, formData as Death);
      }
      store.showToast(t('save-success'), 'success');
      setShowModal(false);
      setEditingDeath(null);
      setFormData({});
    } catch { store.showToast(t('save-error'), 'error'); }
    store.setLoading(false);
  };

  const handleDelete = (d: Death) => {
    setDeathToDelete(d);
  };

  const confirmDelete = async () => {
    if (!deathToDelete) return;
    store.setLoading(true);
    try { await deleteDocument(DB_COLLECTIONS.DEATHS, deathToDelete.id); store.showToast(t('delete-success'), 'success'); }
    catch { store.showToast(t('delete-error'), 'error'); }
    store.setLoading(false);
    setDeathToDelete(null);
  };

  const openAdd = () => {
    setEditingDeath(null);
    setFormData({ status: 'pending' });
    setShowModal(true);
  };

  const openEdit = (d: Death) => {
    setEditingDeath(d);
    setFormData({ ...d });
    setShowModal(true);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6"><h1 className="text-2xl font-bold text-white flex items-center gap-3"><Cross className="w-7 h-7 text-orange-500" />{t('deaths')}</h1><p className="text-gray-400 text-sm mt-1">{t('manage-deaths')}</p></div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Cari data kematian..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" />
        </div>
        {userCanEdit && <button onClick={openAdd} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />{t('add-death')}</button>}
      </div>

      <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[#2a2a2a]"><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('name')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('death-date')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('death-place')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('cause')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('status')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('action')}</th></tr></thead>
            <tbody>
              {filteredDeaths.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-gray-500">{t('no-data')}</td></tr> :
                filteredDeaths.map(d => (
                  <tr key={d.id} className="border-b border-[#2a2a2a]/50 hover:bg-[#0a0a0a]/50">
                    <td className="px-5 py-4 text-white text-sm font-medium">{d.nama || getMemberName(d.memberId)}</td>
                    <td className="px-5 py-4 text-gray-400 text-sm">{formatDate(d.tglMeninggal)}</td>
                    <td className="px-5 py-4 text-gray-400 text-sm">{d.tempatMeninggal || '-'}</td>
                    <td className="px-5 py-4 text-gray-400 text-sm">{d.penyebab || '-'}</td>
                    <td className="px-5 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${d.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{d.status}</span></td>
                    <td className="px-5 py-4"><div className="flex gap-1">{userCanEdit && <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg text-gray-500 hover:text-orange-400"><Pencil className="w-4 h-4" /></button>}{userCanDelete && <button onClick={() => handleDelete(d)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}</div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!deathToDelete}
        onOpenChange={(open) => { if (!open) setDeathToDelete(null); }}
        onConfirm={confirmDelete}
        title="Hapus Data Kematian"
        description={`Yakin ingin menghapus data kematian ${deathToDelete?.nama || ''}?`}
        confirmText="Hapus"
        cancelText="Batal"
        destructive
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]"><h3 className="text-white font-semibold text-lg">{editingDeath ? t('edit') : t('add-death')}</h3><button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('select-member')}</label><select value={formData.memberId || ''} onChange={e => { const m = members.find(mem => mem.id === e.target.value); setFormData({ ...formData, memberId: e.target.value, nama: m?.nama }); }} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="">-</option>{members.filter(m => m.status === 'aktif').map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}</select></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('death-date')} *</label><input type="date" required value={formData.tglMeninggal || ''} onChange={e => setFormData({ ...formData, tglMeninggal: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('death-place')}</label><input type="text" value={formData.tempatMeninggal || ''} onChange={e => setFormData({ ...formData, tempatMeninggal: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('cause')}</label><input type="text" value={formData.penyebab || ''} onChange={e => setFormData({ ...formData, penyebab: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm">{t('cancel')}</button><button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium">{t('save')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
