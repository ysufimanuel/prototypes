/**
 * Events Page - Kelola event dan kegiatan gereja
 */

import { useState, useMemo, useEffect } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { formatDate } from '@/utils/formatters';
import { canEdit, canDelete } from '@/auth/permissions';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import type { Event } from '@/types/models';
import { Calendar, Search, Plus, Pencil, Trash2, X, MapPin, Users } from 'lucide-react';

export function EventsPage() {
  const { events, currentUser } = useStoreSelector(s => ({ events: s.events, currentUser: s.currentUser }));
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<Partial<Event>>({});

  const userCanEdit = canEdit(currentUser);
  const userCanDelete = canDelete(currentUser);

  useEffect(() => {
    const unsub = subscribeToCollection<Event>(DB_COLLECTIONS.EVENTS, (data) => store.setCollection('events', data));
    return unsub;
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchSearch = !search || e.nama?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || e.status === filterStatus;
      return matchSearch && matchStatus;
    }).sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }, [events, search, filterStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'ongoing': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'completed': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    store.setLoading(true);
    try {
      if (editingEvent) {
        await updateDocument(DB_COLLECTIONS.EVENTS, editingEvent.id, formData);
      } else {
        await addDocument<Event>(DB_COLLECTIONS.EVENTS, { ...formData, participants: [] } as Event);
      }
      store.showToast(t('save-success'), 'success');
      setShowModal(false);
      setFormData({});
    } catch { store.showToast(t('save-error'), 'error'); }
    store.setLoading(false);
  };

  const handleDelete = async (evt: Event) => {
    if (!window.confirm(t('confirm-delete'))) return;
    store.setLoading(true);
    try { await deleteDocument(DB_COLLECTIONS.EVENTS, evt.id); store.showToast(t('delete-success'), 'success'); }
    catch { store.showToast(t('delete-error'), 'error'); }
    store.setLoading(false);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6"><h1 className="text-2xl font-bold text-white flex items-center gap-3"><Calendar className="w-7 h-7 text-orange-500" />{t('events')}</h1><p className="text-gray-400 text-sm mt-1">{t('manage-events')}</p></div>
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder={t('search-events')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500">
          <option value="">{t('all-status')}</option>
          <option value="upcoming">{t('upcoming')}</option>
          <option value="ongoing">{t('ongoing')}</option>
          <option value="completed">{t('completed')}</option>
        </select>
        {userCanEdit && <button onClick={() => { setEditingEvent(null); setFormData({ status: 'upcoming', tipe: 'ibadah', participants: [] }); setShowModal(true); }} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />{t('add-event')}</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredEvents.length === 0 ? <div className="col-span-2 text-center py-12 text-gray-500 bg-[#141414] rounded-2xl border border-[#2a2a2a]">{t('no-data')}</div> :
          filteredEvents.map(evt => (
            <div key={evt.id} className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-5 hover:border-orange-500/20 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(evt.status)}`}>{evt.status}</span>
                </div>
                <div className="flex gap-1">
                  {userCanEdit && <button onClick={() => { setEditingEvent(evt); setFormData({ ...evt }); setShowModal(true); }} className="p-1.5 rounded-lg text-gray-500 hover:text-orange-400"><Pencil className="w-4 h-4" /></button>}
                  {userCanDelete && <button onClick={() => handleDelete(evt)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
              <h3 className="text-white font-semibold mb-2">{evt.nama}</h3>
              <div className="space-y-1.5 text-sm text-gray-400">
                <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-orange-400" />{formatDate(evt.start)} - {formatDate(evt.end)}</p>
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-400" />{evt.lokasi || '-'}</p>
                <p className="flex items-center gap-2"><Users className="w-4 h-4 text-orange-400" />{evt.participants?.length || 0} / {evt.kapasitas || '-'} peserta</p>
              </div>
              {evt.deskripsi && <p className="text-gray-500 text-xs mt-3 line-clamp-2">{evt.deskripsi}</p>}
            </div>
          ))}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]"><h3 className="text-white font-semibold text-lg">{editingEvent ? t('edit') : t('add-event')}</h3><button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('event-name')} *</label><input type="text" required value={formData.nama || ''} onChange={e => setFormData({ ...formData, nama: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('event-type')}</label><select value={formData.tipe || 'ibadah'} onChange={e => setFormData({ ...formData, tipe: e.target.value as any })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="ibadah">{t('worship')}</option><option value="seminar">{t('seminar')}</option><option value="retret">{t('retreat')}</option><option value="sosial">{t('social-activity')}</option><option value="lainnya">{t('other')}</option></select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-gray-400 mb-1.5">{t('start-date')}</label><input type="datetime-local" value={formData.start || ''} onChange={e => setFormData({ ...formData, start: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
                <div><label className="block text-sm text-gray-400 mb-1.5">{t('end-date')}</label><input type="datetime-local" value={formData.end || ''} onChange={e => setFormData({ ...formData, end: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              </div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('location')}</label><input type="text" value={formData.lokasi || ''} onChange={e => setFormData({ ...formData, lokasi: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('capacity')}</label><input type="number" value={formData.kapasitas || ''} onChange={e => setFormData({ ...formData, kapasitas: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('event-status')}</label><select value={formData.status || 'upcoming'} onChange={e => setFormData({ ...formData, status: e.target.value as any })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="upcoming">{t('upcoming')}</option><option value="ongoing">{t('ongoing')}</option><option value="completed">{t('completed')}</option></select></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('description')}</label><textarea value={formData.deskripsi || ''} onChange={e => setFormData({ ...formData, deskripsi: e.target.value })} rows={2} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500 resize-none" /></div>
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm">{t('cancel')}</button><button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium">{t('save')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
