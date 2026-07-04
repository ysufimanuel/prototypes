/**
 * Volunteers Page - Kelola relawan dan jadwal pelayanan
 */

import { useState, useMemo, useEffect } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { canEdit, canDelete } from '@/auth/permissions';
import { subscribeToCollection, addDocument, deleteDocument } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import type { Volunteer, Assignment } from '@/types/models';
import { HandHelping, Search, Plus, Pencil, Trash2, X, Calendar } from 'lucide-react';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';

type VolunteerTab = 'list' | 'schedule' | 'assignment';

export function VolunteersPage() {
  const { volunteers, members, events, assignments, currentUser } = useStoreSelector(s => ({
    volunteers: s.volunteers, members: s.members, events: s.events, assignments: s.assignments, currentUser: s.currentUser,
  }));
  const [activeTab, setActiveTab] = useState<VolunteerTab>('list');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'volunteer' | 'assignment'>('volunteer');
  const [formData, setFormData] = useState<Record<string, any>>({});

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; coll: string } | null>(null);
  const userCanEdit = canEdit(currentUser);
  const userCanDelete = canDelete(currentUser);

  useEffect(() => {
    const unsub1 = subscribeToCollection<Volunteer>(DB_COLLECTIONS.VOLUNTEERS, (data) => store.setCollection('volunteers', data));
    const unsub2 = subscribeToCollection<Assignment>(DB_COLLECTIONS.ASSIGNMENTS, (data) => store.setCollection('assignments', data));
    return () => { unsub1(); unsub2(); };
  }, []);

  const filteredVolunteers = useMemo(() => {
    return volunteers.filter(v => {
      const name = v.memberId ? members.find(m => m.id === v.memberId)?.nama : v.externalNama;
      return !search || name?.toLowerCase().includes(search.toLowerCase());
    });
  }, [volunteers, members, search]);

  const getVolunteerName = (v: Volunteer) => v.memberId ? members.find(m => m.id === v.memberId)?.nama : v.externalNama || 'External';
  const getEventName = (id: string) => events.find(e => e.id === id)?.nama || '-';

  const serviceAreas: Record<string, string> = {
    'sunday-school-teacher': t('sunday-school-teacher'), 'singer': t('singer'), 'worship-leader': t('worship-leader'),
    'musician': t('musician'), 'dancer': t('dancer'), 'collection': t('collection'), 'intercession': t('intercession'),
    'speaker': t('speaker'), 'multimedia': t('multimedia'), 'lighting-sound': t('lighting-sound'), 'usher': t('usher'),
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    store.setLoading(true);
    try {
      if (modalType === 'volunteer') {
        await addDocument<Volunteer>(DB_COLLECTIONS.VOLUNTEERS, { ...formData, status: 'aktif', jadwal: formData.jadwal || [] } as Volunteer);
      } else {
        await addDocument<Assignment>(DB_COLLECTIONS.ASSIGNMENTS, formData as Assignment);
      }
      store.showToast(t('save-success'), 'success'); setShowModal(false);
    } catch { store.showToast(t('save-error'), 'error'); }
    store.setLoading(false);
  };

  const handleDelete = (id: string, coll: string) => {
    setDeleteTarget({ id, coll });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    store.setLoading(true);
    try { await deleteDocument(deleteTarget.coll, deleteTarget.id); store.showToast(t('delete-success'), 'success'); }
    catch { store.showToast(t('delete-error'), 'error'); }
    store.setLoading(false);
    setDeleteTarget(null);
  };

  const tabs = [
    { key: 'list' as VolunteerTab, label: t('volunteer-list') },
    { key: 'schedule' as VolunteerTab, label: t('service-schedule') },
    { key: 'assignment' as VolunteerTab, label: t('assignments') },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6"><h1 className="text-2xl font-bold text-white flex items-center gap-3"><HandHelping className="w-7 h-7 text-orange-500" />{t('volunteers')}</h1><p className="text-gray-400 text-sm mt-1">{t('manage-volunteers')}</p></div>
      <div className="flex gap-1 bg-[#141414] rounded-xl p-1 mb-6 border border-[#2a2a2a]">
        {tabs.map(tab => <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-orange-500/15 text-orange-400' : 'text-gray-400 hover:text-white'}`}>{tab.label}</button>)}
      </div>

      {activeTab === 'list' && (
        <>
          <div className="flex flex-col lg:flex-row gap-3 mb-6">
            <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" placeholder={t('search-volunteers')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
            {userCanEdit && <button onClick={() => { setModalType('volunteer'); setFormData({ area: 'usher', jadwal: [] }); setShowModal(true); }} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />{t('add-volunteer')}</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVolunteers.map(v => (
              <div key={v.id} className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-5 hover:border-orange-500/20 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center text-orange-400 font-bold border border-orange-500/20">{getVolunteerName(v)?.charAt(0)}</div>
                    <div><h4 className="text-white font-medium">{getVolunteerName(v)}</h4><p className="text-orange-400 text-xs">{serviceAreas[v.area] || v.area}</p></div>
                  </div>
                  <div className="flex gap-1">{userCanEdit && <button onClick={() => { setModalType('volunteer'); setFormData({ ...v }); setShowModal(true); }} className="p-1.5 rounded-lg text-gray-500 hover:text-orange-400"><Pencil className="w-4 h-4" /></button>}{userCanDelete && <button onClick={() => handleDelete(v.id, DB_COLLECTIONS.VOLUNTEERS)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}</div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(v.jadwal || []).map(j => <span key={j} className="px-2 py-1 bg-[#0a0a0a] rounded-lg text-gray-400 text-xs">{j}</span>)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'schedule' && (
        <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6">
          <h3 className="text-white font-semibold mb-4">{t('service-schedule')}</h3>
          <div className="space-y-4">
            {(['minggu-pagi', 'minggu-sore', 'sabtu', 'hari-kerja'] as const).map(schedule => (
              <div key={schedule} className="border border-[#2a2a2a] rounded-xl p-4">
                <h4 className="text-orange-400 font-medium text-sm mb-3 capitalize">{schedule}</h4>
                <div className="flex flex-wrap gap-2">
                  {filteredVolunteers.filter(v => v.jadwal?.includes(schedule as any)).map(v => (
                    <span key={v.id} className="px-3 py-1.5 bg-[#0a0a0a] rounded-lg text-gray-300 text-xs flex items-center gap-1.5">
                      <HandHelping className="w-3 h-3 text-orange-400" />{getVolunteerName(v)} - {serviceAreas[v.area]}
                    </span>
                  ))}
                  {filteredVolunteers.filter(v => v.jadwal?.includes(schedule as any)).length === 0 && <span className="text-gray-600 text-xs">Tidak ada jadwal</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'assignment' && (
        <>
          {userCanEdit && <div className="flex justify-end mb-4"><button onClick={() => { setModalType('assignment'); setFormData({ status: 'assigned' }); setShowModal(true); }} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />{t('add-assignment')}</button></div>}
          <div className="space-y-3">
            {assignments.map(a => (
              <div key={a.id} className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400"><Calendar className="w-5 h-5" /></div>
                  <div><h4 className="text-white font-medium text-sm">{getEventName(a.eventId)}</h4><p className="text-gray-500 text-xs mt-1">{a.tanggal} | {a.waktu} | {a.tempat}</p><p className="text-gray-400 text-xs mt-0.5">{a.tugas}</p></div>
                </div>
                <div className="flex gap-1"><button onClick={() => handleDelete(a.id, DB_COLLECTIONS.ASSIGNMENTS)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]"><h3 className="text-white font-semibold text-lg">{modalType === 'volunteer' ? t('add-volunteer') : t('add-assignment')}</h3><button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {modalType === 'volunteer' ? (
                <>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('volunteer-source')}</label><select value={formData.memberId !== undefined ? (formData.memberId ? 'member' : 'external') : ''} onChange={e => setFormData({ ...formData, memberId: e.target.value === 'member' ? '' : null, externalNama: e.target.value === 'external' ? '' : null })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="">-</option><option value="member">{t('from-member')}</option><option value="external">{t('external')}</option></select></div>
                  {formData.memberId !== undefined && (formData.memberId !== null ? (
                    <div><label className="block text-sm text-gray-400 mb-1.5">{t('select-member')}</label><select required value={formData.memberId || ''} onChange={e => setFormData({ ...formData, memberId: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="">-</option>{members.filter(m => m.status === 'aktif').map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}</select></div>
                  ) : (
                    <div><label className="block text-sm text-gray-400 mb-1.5">{t('name')}</label><input type="text" required value={formData.externalNama || ''} onChange={e => setFormData({ ...formData, externalNama: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
                  ))}
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('service-area')}</label><select value={formData.area || ''} onChange={e => setFormData({ ...formData, area: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500">{Object.entries(serviceAreas).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('available-schedule')}</label><div className="flex flex-wrap gap-2">{['minggu-pagi', 'minggu-sore', 'sabtu', 'hari-kerja'].map(s => (
                    <label key={s} className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0a] rounded-lg text-gray-300 text-sm cursor-pointer"><input type="checkbox" checked={(formData.jadwal || []).includes(s)} onChange={e => { const jadwal = formData.jadwal || []; setFormData({ ...formData, jadwal: e.target.checked ? [...jadwal, s] : jadwal.filter((j: string) => j !== s) }); }} className="accent-orange-500" />{s}</label>
                  ))}</div></div>
                </>
              ) : (
                <>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('select-volunteer')}</label><select required value={formData.volunteerId || ''} onChange={e => setFormData({ ...formData, volunteerId: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="">-</option>{volunteers.map(v => <option key={v.id} value={v.id}>{getVolunteerName(v)}</option>)}</select></div>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('select-event')}</label><select required value={formData.eventId || ''} onChange={e => setFormData({ ...formData, eventId: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="">-</option>{events.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}</select></div>
                  <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm text-gray-400 mb-1.5">{t('date')}</label><input type="date" value={formData.tanggal || ''} onChange={e => setFormData({ ...formData, tanggal: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div><div><label className="block text-sm text-gray-400 mb-1.5">{t('assignment-time')}</label><input type="time" value={formData.waktu || ''} onChange={e => setFormData({ ...formData, waktu: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div></div>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('location')}</label><input type="text" value={formData.tempat || ''} onChange={e => setFormData({ ...formData, tempat: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('task')}</label><input type="text" value={formData.tugas || ''} onChange={e => setFormData({ ...formData, tugas: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('notes')}</label><textarea value={formData.catatan || ''} onChange={e => setFormData({ ...formData, catatan: e.target.value })} rows={2} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500 resize-none" /></div>
                </>
              )}
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm">{t('cancel')}</button><button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium">{t('save')}</button></div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
        title="Hapus Data Relawan"
        description="Yakin ingin menghapus data ini?"
        confirmText="Hapus"
        cancelText="Batal"
        destructive
      />
    </div>
  );
}
