import { useState, useMemo } from 'react';
import { Calendar, Search, Eye, Pencil, Trash2, Clock, MapPin, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ModalForm } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToCSV, formatDate, cn } from '@/lib/utils';
import type { AppData, Event, Language } from '@/types';

interface EventsProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

const eventTypes = [
  { value: 'ibadah', label: { id: 'Ibadah', en: 'Worship' } },
  { value: 'doa', label: { id: 'Doa', en: 'Prayer' } },
  { value: 'pemuda', label: { id: 'Pemuda', en: 'Youth' } },
  { value: 'anak', label: { id: 'Anak', en: 'Children' } },
  { value: 'perayaan', label: { id: 'Perayaan', en: 'Celebration' } },
  { value: 'lainnya', label: { id: 'Lainnya', en: 'Other' } },
];

const eventStatuses = [
  { value: 'upcoming', label: { id: 'Mendatang', en: 'Upcoming' } },
  { value: 'ongoing', label: { id: 'Berlangsung', en: 'Ongoing' } },
  { value: 'completed', label: { id: 'Selesai', en: 'Completed' } },
  { value: 'cancelled', label: { id: 'Dibatalkan', en: 'Cancelled' } },
];

export function Events({ data, updateData, lang, t, canEdit, canDelete, showToast }: EventsProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const [formData, setFormData] = useState<Partial<Event>>({
    nama: '', tipe: 'ibadah', start: '', end: '', tempat: '', deskripsi: '', status: 'upcoming', participants: [],
  });

  const filtered = useMemo(() => {
    return data.events.filter(e => {
      const matchesSearch = !search || e.nama.toLowerCase().includes(search.toLowerCase()) || e.tempat.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data.events, search, statusFilter]);

  const resetForm = () => {
    setFormData({ nama: '', tipe: 'ibadah', start: '', end: '', tempat: '', deskripsi: '', status: 'upcoming', participants: [] });
    setEditingId(null);
  };
  const openAdd = () => { resetForm(); setIsModalOpen(true); };
  const openEdit = (e: Event) => { setFormData({ ...e }); setEditingId(e.id); setIsModalOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || !formData.start) { showToast(lang === 'id' ? 'Nama dan waktu mulai wajib diisi' : 'Name and start time are required', 'error'); return; }
    updateData(prev => {
      if (editingId) {
        const idx = prev.events.findIndex(ev => ev.id === editingId);
        if (idx === -1) return prev;
        const updated = [...prev.events];
        updated[idx] = { ...updated[idx], ...formData } as Event;
        return { ...prev, events: updated };
      } else {
        const newId = Math.max(...prev.events.map(ev => ev.id), 0) + 1;
        return { ...prev, events: [...prev.events, { ...formData, id: newId } as Event] };
      }
    });
    showToast(editingId ? (lang === 'id' ? 'Acara diperbarui' : 'Event updated') : (lang === 'id' ? 'Acara ditambahkan' : 'Event added'), 'success');
    setIsModalOpen(false); resetForm();
  };

  const handleDelete = (id: number) => {
    updateData(prev => ({ ...prev, events: prev.events.filter(e => e.id !== id) }));
    showToast(lang === 'id' ? 'Acara dihapus' : 'Event deleted', 'success');
    setConfirmDelete(null);
  };

  const handleExport = () => {
    exportToCSV(filtered.map(e => ({ Nama: e.nama, Tipe: e.tipe, Mulai: e.start, Tempat: e.tempat, Status: e.status })), 'events');
    showToast(lang === 'id' ? 'Data diexport' : 'Data exported', 'success');
  };

  const inputClass = "w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

  return (
    <div>
      <PageHeader title={t('events')} subtitle={`${filtered.length} ${lang === 'id' ? 'acara' : 'events'}`} onAdd={canEdit ? openAdd : undefined} addLabel={t('add-event')} onExport={handleExport} canEdit={canEdit} lang={lang} />
      
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="all">{t('all')}</option>
            {eventStatuses.map(s => <option key={s.value} value={s.value}>{s.label[lang]}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-[#1e1e1e] border border-white/10 rounded-xl">{t('no-data')}</div>
        ) : filtered.map(ev => (
          <div key={ev.id} className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5 hover:border-orange-500/30 transition-all">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', ev.status === 'upcoming' ? 'bg-blue-500/10' : ev.status === 'ongoing' ? 'bg-green-500/10' : ev.status === 'completed' ? 'bg-gray-500/10' : 'bg-red-500/10')}>
                  <Calendar className={cn('w-6 h-6', ev.status === 'upcoming' ? 'text-blue-400' : ev.status === 'ongoing' ? 'text-green-400' : ev.status === 'completed' ? 'text-gray-400' : 'text-red-400')} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">{ev.nama}</h4>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', ev.status === 'upcoming' ? 'bg-blue-500/10 text-blue-400' : ev.status === 'ongoing' ? 'bg-green-500/10 text-green-400' : ev.status === 'completed' ? 'bg-gray-500/10 text-gray-400' : 'bg-red-500/10 text-red-400')}>{ev.status}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(ev.start, lang)}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {ev.tempat}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {ev.participants?.length || 0} {lang === 'id' ? 'peserta' : 'participants'}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{ev.deskripsi}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setDetailEvent(ev)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"><Eye className="w-4 h-4" /></button>
                {canEdit && <button onClick={() => openEdit(ev)} className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"><Pencil className="w-4 h-4" /></button>}
                {canDelete && <button onClick={() => setConfirmDelete(ev.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ModalForm isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? (lang === 'id' ? 'Edit Acara' : 'Edit Event') : t('add-event')} onSubmit={handleSubmit} lang={lang} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={labelClass}>{t('name')} *</label><input type="text" value={formData.nama || ''} onChange={e => setFormData(p => ({ ...p, nama: e.target.value }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{t('type')}</label>
            <select value={formData.tipe || 'ibadah'} onChange={e => setFormData(p => ({ ...p, tipe: e.target.value as Event['tipe'] }))} className={inputClass}>
              {eventTypes.map(t => <option key={t.value} value={t.value}>{t.label[lang]}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>{t('start')} *</label><input type="datetime-local" value={formData.start || ''} onChange={e => setFormData(p => ({ ...p, start: e.target.value }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{t('end')}</label><input type="datetime-local" value={formData.end || ''} onChange={e => setFormData(p => ({ ...p, end: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>{t('location')}</label><input type="text" value={formData.tempat || ''} onChange={e => setFormData(p => ({ ...p, tempat: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>{t('status')}</label>
            <select value={formData.status || 'upcoming'} onChange={e => setFormData(p => ({ ...p, status: e.target.value as Event['status'] }))} className={inputClass}>
              {eventStatuses.map(s => <option key={s.value} value={s.value}>{s.label[lang]}</option>)}
            </select>
          </div>
          <div className="md:col-span-2"><label className={labelClass}>{t('description')}</label><textarea value={formData.deskripsi || ''} onChange={e => setFormData(p => ({ ...p, deskripsi: e.target.value }))} className={cn(inputClass, 'h-20 resize-none')} /></div>
        </div>
      </ModalForm>

      {detailEvent && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setDetailEvent(null)}>
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">{detailEvent.nama}</h3>
              <button onClick={() => setDetailEvent(null)} className="text-gray-400 hover:text-white">x</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t('type'), value: detailEvent.tipe },
                  { label: t('status'), value: detailEvent.status },
                  { label: t('start'), value: formatDate(detailEvent.start, lang) },
                  { label: t('location'), value: detailEvent.tempat },
                ].map((item, i) => (
                  <div key={i} className="bg-[#2a2a2a] rounded-lg p-3"><p className="text-xs text-gray-500">{item.label}</p><p className="text-sm text-white">{item.value}</p></div>
                ))}
              </div>
              <p className="text-sm text-gray-300">{detailEvent.deskripsi}</p>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={confirmDelete !== null} title={t('confirm')} message={lang === 'id' ? 'Hapus acara ini?' : 'Delete this event?'} onConfirm={() => confirmDelete !== null && handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} lang={lang} />
    </div>
  );
}
