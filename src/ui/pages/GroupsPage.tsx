/**
 * Groups Page - Kelola grup dan pelayanan
 */

import { useState, useMemo, useEffect } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { canEdit, canDelete } from '@/auth/permissions';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import type { Group } from '@/types/models';
import { Group as GroupIcon, Search, Plus, Pencil, Trash2, X, Users } from 'lucide-react';

export function GroupsPage() {
  const { groups, members, currentUser } = useStoreSelector(s => ({ groups: s.groups, members: s.members, currentUser: s.currentUser }));
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState<Partial<Group>>({});

  const userCanEdit = canEdit(currentUser);
  const userCanDelete = canDelete(currentUser);

  useEffect(() => {
    const unsub = subscribeToCollection<Group>(DB_COLLECTIONS.GROUPS, (data) => store.setCollection('groups', data));
    return unsub;
  }, []);

  const filteredGroups = useMemo(() => {
    return groups.filter(g => !search || g.nama?.toLowerCase().includes(search.toLowerCase()));
  }, [groups, search]);

  const getMemberName = (id?: string) => {
    if (!id) return '-';
    const m = members.find(m => m.id === id);
    return m?.nama || '-';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    store.setLoading(true);
    try {
      if (editingGroup) {
        await updateDocument(DB_COLLECTIONS.GROUPS, editingGroup.id, formData);
      } else {
        await addDocument<Group>(DB_COLLECTIONS.GROUPS, { ...formData, anggota: formData.anggota || [], showPhone: formData.showPhone ?? true } as Group);
      }
      store.showToast(t('save-success'), 'success');
      setShowModal(false);
      setFormData({});
    } catch { store.showToast(t('save-error'), 'error'); }
    store.setLoading(false);
  };

  const handleDelete = async (group: Group) => {
    if (!window.confirm(t('confirm-delete'))) return;
    store.setLoading(true);
    try { await deleteDocument(DB_COLLECTIONS.GROUPS, group.id); store.showToast(t('delete-success'), 'success'); }
    catch { store.showToast(t('delete-error'), 'error'); }
    store.setLoading(false);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><GroupIcon className="w-7 h-7 text-orange-500" />{t('groups')}</h1>
        <p className="text-gray-400 text-sm mt-1">{t('manage-groups')}</p>
      </div>
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder={t('search-groups')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" />
        </div>
        {userCanEdit && <button onClick={() => { setEditingGroup(null); setFormData({ showPhone: true, anggota: [] }); setShowModal(true); }} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />{t('add-group')}</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGroups.length === 0 ? <div className="col-span-2 text-center py-12 text-gray-500 bg-[#141414] rounded-2xl border border-[#2a2a2a]">{t('no-data')}</div> :
          filteredGroups.map(group => (
            <div key={group.id} className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-5 hover:border-orange-500/20 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div><h3 className="text-white font-semibold">{group.nama}</h3><p className="text-gray-400 text-xs mt-1">{group.deskripsi}</p></div>
                <div className="flex gap-1">
                  {userCanEdit && <button onClick={() => { setEditingGroup(group); setFormData({ ...group }); setShowModal(true); }} className="p-1.5 rounded-lg text-gray-500 hover:text-orange-400"><Pencil className="w-4 h-4" /></button>}
                  {userCanDelete && <button onClick={() => handleDelete(group)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-400">{t('leader')}: <span className="text-white">{getMemberName(group.leaderId)}</span></p>
                <p className="text-gray-400">{t('meeting-schedule')}: <span className="text-white">{group.jadwal || '-'}</span></p>
                <div className="flex items-center gap-2 text-gray-400"><Users className="w-4 h-4" />{group.anggota?.length || 0} anggota</div>
              </div>
            </div>
          ))}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]"><h3 className="text-white font-semibold text-lg">{editingGroup ? t('edit') : t('add-group')}</h3><button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('group-name')} *</label><input type="text" required value={formData.nama || ''} onChange={e => setFormData({ ...formData, nama: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('leader')}</label><select value={formData.leaderId || ''} onChange={e => setFormData({ ...formData, leaderId: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="">-</option>{members.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}</select></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('meeting-schedule')}</label><input type="text" value={formData.jadwal || ''} onChange={e => setFormData({ ...formData, jadwal: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('description')}</label><textarea value={formData.deskripsi || ''} onChange={e => setFormData({ ...formData, deskripsi: e.target.value })} rows={2} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500 resize-none" /></div>
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm">{t('cancel')}</button><button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium">{t('save')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
