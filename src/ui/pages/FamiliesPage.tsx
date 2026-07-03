/**
 * Families Page - Kelola data keluarga
 */

import { useState, useMemo, useEffect } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { canEdit, canDelete } from '@/auth/permissions';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import type { Family } from '@/types/models';
import { Home, Search, Plus, Pencil, Trash2, X, Users } from 'lucide-react';

export function FamiliesPage() {
  const { families, members, currentUser } = useStoreSelector(s => ({
    families: s.families,
    members: s.members,
    currentUser: s.currentUser,
  }));

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [formData, setFormData] = useState<Partial<Family>>({});

  const userCanEdit = canEdit(currentUser);
  const userCanDelete = canDelete(currentUser);

  useEffect(() => {
    const unsub = subscribeToCollection<Family>(DB_COLLECTIONS.FAMILIES, (data) => {
      store.setCollection('families', data);
    });
    return unsub;
  }, []);

  const filteredFamilies = useMemo(() => {
    return families.filter(f => {
      if (!search) return true;
      const headName = getMemberName(f.kepalaId);
      return f.nama?.toLowerCase().includes(search.toLowerCase()) ||
        headName.toLowerCase().includes(search.toLowerCase());
    });
  }, [families, search]);

  const getMemberName = (id?: string) => {
    if (!id) return '-';
    const m = members.find(m => m.id === id);
    return m?.nama || '-';
  };

  const getFamilyMembers = (memberIds: string[]) => {
    return members.filter(m => memberIds.includes(m.id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    store.setLoading(true);
    try {
      if (editingFamily) {
        await updateDocument(DB_COLLECTIONS.FAMILIES, editingFamily.id, formData);
      } else {
        await addDocument<Family>(DB_COLLECTIONS.FAMILIES, {
          ...formData,
          anggota: formData.anggota || [],
        } as Family);
      }
      store.showToast(t('save-success'), 'success');
      setShowModal(false);
      setEditingFamily(null);
      setFormData({});
    } catch {
      store.showToast(t('save-error'), 'error');
    }
    store.setLoading(false);
  };

  const handleDelete = async (family: Family) => {
    if (!window.confirm(t('confirm-delete'))) return;
    store.setLoading(true);
    try {
      await deleteDocument(DB_COLLECTIONS.FAMILIES, family.id);
      store.showToast(t('delete-success'), 'success');
    } catch {
      store.showToast(t('delete-error'), 'error');
    }
    store.setLoading(false);
  };

  const openAdd = () => {
    setEditingFamily(null);
    setFormData({ anggota: [] });
    setShowModal(true);
  };

  const openEdit = (family: Family) => {
    setEditingFamily(family);
    setFormData({ ...family });
    setShowModal(true);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Home className="w-7 h-7 text-orange-500" />
          {t('families')}
        </h1>
        <p className="text-gray-400 text-sm mt-1">{t('manage-families')}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder={t('search-families')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
        {userCanEdit && (
          <button
            onClick={openAdd}
            className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium hover:shadow-lg hover:shadow-orange-500/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('add-family')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFamilies.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-gray-500 bg-[#141414] rounded-2xl border border-[#2a2a2a]">
            {t('no-data')}
          </div>
        ) : (
          filteredFamilies.map(family => (
            <div key={family.id} className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-5 hover:border-orange-500/20 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold">{family.nama}</h3>
                  <p className="text-gray-400 text-xs mt-1">{family.alamat}, {family.kota}</p>
                </div>
                <div className="flex gap-1">
                  {userCanEdit && (
                    <button onClick={() => openEdit(family)} className="p-1.5 rounded-lg text-gray-500 hover:text-orange-400 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {userCanDelete && (
                    <button onClick={() => handleDelete(family)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-400">{t('head-family')}: <span className="text-white">{getMemberName(family.kepalaId)}</span></span>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-gray-500">{t('family-members')} ({family.anggota?.length || 0}):</p>
                <div className="flex flex-wrap gap-1.5">
                  {getFamilyMembers(family.anggota || []).map(m => (
                    <span key={m.id} className="px-2 py-1 bg-[#0a0a0a] rounded-lg text-gray-300 text-xs">{m.nama}</span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
              <h3 className="text-white font-semibold text-lg">{editingFamily ? t('edit') : t('add-family')}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{t('family-name')} *</label>
                <input type="text" required value={formData.nama || ''} onChange={e => setFormData({ ...formData, nama: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{t('head-family')}</label>
                <select value={formData.kepalaId || ''} onChange={e => setFormData({ ...formData, kepalaId: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500">
                  <option value="">-</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{t('address')}</label>
                <input type="text" value={formData.alamat || ''} onChange={e => setFormData({ ...formData, alamat: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{t('city')}</label>
                <input type="text" value={formData.kota || ''} onChange={e => setFormData({ ...formData, kota: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm">{t('cancel')}</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
