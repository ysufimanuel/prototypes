import { useState, useMemo } from 'react';
import { Group, Search, Eye, Pencil, Trash2, Users, UserPlus, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ModalForm } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToCSV } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { AppData, Group as GroupType, Language } from '@/types';

interface GroupsProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function Groups({ data, updateData, lang, t, canEdit, canDelete, showToast }: GroupsProps) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [manageGroup, setManageGroup] = useState<number | null>(null);
  const [detailGroup, setDetailGroup] = useState<GroupType | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [newMemberId, setNewMemberId] = useState('');

  const [formData, setFormData] = useState<Partial<GroupType>>({ nama: '', deskripsi: '', leaderId: null, jadwal: '', showPhone: true, anggota: [] });

  const filtered = useMemo(() => {
    return data.groups.filter(g => !search || g.nama.toLowerCase().includes(search.toLowerCase()) || g.deskripsi.toLowerCase().includes(search.toLowerCase()));
  }, [data.groups, search]);

  const resetForm = () => { setFormData({ nama: '', deskripsi: '', leaderId: null, jadwal: '', showPhone: true, anggota: [] }); setEditingId(null); };
  const openAdd = () => { resetForm(); setIsModalOpen(true); };
  const openEdit = (g: GroupType) => { setFormData({ ...g }); setEditingId(g.id); setIsModalOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama) { showToast(lang === 'id' ? 'Nama grup wajib diisi' : 'Group name is required', 'error'); return; }
    updateData(prev => {
      if (editingId) {
        const idx = prev.groups.findIndex(g => g.id === editingId);
        if (idx === -1) return prev;
        const updated = [...prev.groups];
        updated[idx] = { ...updated[idx], ...formData } as GroupType;
        return { ...prev, groups: updated };
      } else {
        const newId = Math.max(...prev.groups.map(g => g.id), 0) + 1;
        return { ...prev, groups: [...prev.groups, { ...formData, id: newId, anggota: [], createdAt: new Date().toISOString() } as GroupType] };
      }
    });
    showToast(editingId ? (lang === 'id' ? 'Grup diperbarui' : 'Group updated') : (lang === 'id' ? 'Grup ditambahkan' : 'Group added'), 'success');
    setIsModalOpen(false); resetForm();
  };

  const handleDelete = (id: number) => {
    updateData(prev => ({ ...prev, groups: prev.groups.filter(g => g.id !== id) }));
    showToast(lang === 'id' ? 'Grup dihapus' : 'Group deleted', 'success');
    setConfirmDelete(null);
  };

  const addMemberToGroup = () => {
    if (!newMemberId || !manageGroup) return;
    const mid = Number(newMemberId);
    updateData(prev => {
      const idx = prev.groups.findIndex(g => g.id === manageGroup);
      if (idx === -1) return prev;
      const group = prev.groups[idx];
      if (group.anggota.includes(mid)) { showToast(lang === 'id' ? 'Sudah menjadi anggota' : 'Already a member', 'error'); return prev; }
      const updated = [...prev.groups];
      updated[idx] = { ...group, anggota: [...group.anggota, mid] };
      return { ...prev, groups: updated };
    });
    setNewMemberId('');
    showToast(lang === 'id' ? 'Anggota ditambahkan' : 'Member added', 'success');
  };

  const removeMemberFromGroup = (memberId: number) => {
    if (!manageGroup) return;
    updateData(prev => {
      const idx = prev.groups.findIndex(g => g.id === manageGroup);
      if (idx === -1) return prev;
      const group = prev.groups[idx];
      const updated = [...prev.groups];
      updated[idx] = { ...group, anggota: group.anggota.filter(id => id !== memberId), leaderId: group.leaderId === memberId ? null : group.leaderId };
      return { ...prev, groups: updated };
    });
    showToast(lang === 'id' ? 'Anggota dihapus' : 'Member removed', 'success');
  };

  const handleExport = () => {
    exportToCSV(filtered.map(g => ({ Nama: g.nama, Deskripsi: g.deskripsi, Jadwal: g.jadwal, Anggota: g.anggota.length })), 'groups');
    showToast(lang === 'id' ? 'Data diexport' : 'Data exported', 'success');
  };

  const inputClass = "w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";
  const currentManageGroup = data.groups.find(g => g.id === manageGroup);

  return (
    <div>
      <PageHeader title={t('groups')} subtitle={`${filtered.length} ${lang === 'id' ? 'grup' : 'groups'}`} onAdd={canEdit ? openAdd : undefined} addLabel={t('add-group')} onExport={handleExport} canEdit={canEdit} lang={lang} />
      
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 bg-[#1e1e1e] border border-white/10 rounded-xl">{t('no-data')}</div>
        ) : filtered.map(g => {
          const leader = data.members.find(m => m.id === g.leaderId);
          return (
            <div key={g.id} className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5 hover:border-orange-500/30 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <Group className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{g.nama}</h4>
                    <p className="text-xs text-gray-400">{g.anggota.length} {lang === 'id' ? 'anggota' : 'members'}</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-3">{g.deskripsi}</p>
              <div className="space-y-1.5 mb-4">
                <p className="text-xs text-gray-400">{t('leader')}: {leader?.nama || '-'}</p>
                <p className="text-xs text-gray-400">{g.jadwal}</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && <button onClick={() => openEdit(g)} className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"><Pencil className="w-4 h-4" /></button>}
                {canDelete && <button onClick={() => setConfirmDelete(g.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>}
                <button onClick={() => setDetailGroup(g)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"><Eye className="w-4 h-4" /></button>
                {canEdit && <button onClick={() => setManageGroup(g.id)} className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"><Users className="w-4 h-4" /></button>}
              </div>
            </div>
          );
        })}
      </div>

      <ModalForm isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? (lang === 'id' ? 'Edit Grup' : 'Edit Group') : t('add-group')} onSubmit={handleSubmit} lang={lang}>
        <div className="space-y-4">
          <div><label className={labelClass}>{t('name')} *</label><input type="text" value={formData.nama || ''} onChange={e => setFormData(p => ({ ...p, nama: e.target.value }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{t('description')}</label><textarea value={formData.deskripsi || ''} onChange={e => setFormData(p => ({ ...p, deskripsi: e.target.value }))} className={cn(inputClass, 'h-20 resize-none')} /></div>
          <div><label className={labelClass}>{t('leader')}</label>
            <select value={formData.leaderId || ''} onChange={e => setFormData(p => ({ ...p, leaderId: e.target.value ? Number(e.target.value) : null }))} className={inputClass}>
              <option value="">{t('select')}</option>
              {data.members.filter(m => m.status === 'aktif').map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>{t('schedule')}</label><input type="text" value={formData.jadwal || ''} onChange={e => setFormData(p => ({ ...p, jadwal: e.target.value }))} className={inputClass} placeholder={lang === 'id' ? 'Contoh: Setiap Sabtu 16:00' : 'Example: Every Saturday 4 PM'} /></div>
        </div>
      </ModalForm>

      {/* Manage Members Modal */}
      {currentManageGroup && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setManageGroup(null)}>
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">{currentManageGroup.nama} - {t('members')}</h3>
              <button onClick={() => setManageGroup(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {canEdit && (
                <div className="flex gap-2">
                  <select value={newMemberId} onChange={e => setNewMemberId(e.target.value)} className="flex-1 bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                    <option value="">{t('select-member')}</option>
                    {data.members.filter(m => m.status === 'aktif' && !currentManageGroup.anggota.includes(m.id)).map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                  </select>
                  <button onClick={addMemberToGroup} className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"><UserPlus className="w-4 h-4" /></button>
                </div>
              )}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {currentManageGroup.anggota.length === 0 ? <p className="text-gray-500 text-sm text-center py-4">{t('no-data')}</p> : currentManageGroup.anggota.map(id => {
                  const m = data.members.find(mem => mem.id === id);
                  if (!m) return null;
                  const isLeader = currentManageGroup.leaderId === id;
                  return (
                    <div key={id} className="flex items-center gap-3 p-2 rounded-lg bg-[#2a2a2a]">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center"><span className="text-white text-xs font-bold">{m.nama.charAt(0)}</span></div>
                      <div className="flex-1"><p className="text-sm text-white">{m.nama} {isLeader && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">{t('leader')}</span>}</p><p className="text-xs text-gray-400">{m.email}</p></div>
                      {canEdit && <button onClick={() => removeMemberFromGroup(id)} className="p-1 text-gray-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {detailGroup && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setDetailGroup(null)}>
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">{detailGroup.nama}</h3>
              <button onClick={() => setDetailGroup(null)} className="text-gray-400 hover:text-white">x</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-300">{detailGroup.deskripsi}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#2a2a2a] rounded-lg p-3"><p className="text-xs text-gray-500">{t('leader')}</p><p className="text-sm text-white">{data.members.find(m => m.id === detailGroup.leaderId)?.nama || '-'}</p></div>
                <div className="bg-[#2a2a2a] rounded-lg p-3"><p className="text-xs text-gray-500">{t('schedule')}</p><p className="text-sm text-white">{detailGroup.jadwal}</p></div>
              </div>
              <h4 className="text-sm font-medium text-white">{t('members')} ({detailGroup.anggota.length})</h4>
              <div className="space-y-2">
                {detailGroup.anggota.map(id => {
                  const m = data.members.find(mem => mem.id === id);
                  if (!m) return null;
                  return (
                    <div key={id} className="flex items-center gap-3 p-2 rounded-lg bg-[#2a2a2a]">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center"><span className="text-white text-xs font-bold">{m.nama.charAt(0)}</span></div>
                      <div><p className="text-sm text-white">{m.nama}</p></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={confirmDelete !== null} title={t('confirm')} message={lang === 'id' ? 'Hapus grup ini?' : 'Delete this group?'} onConfirm={() => confirmDelete !== null && handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} lang={lang} />
    </div>
  );
}
