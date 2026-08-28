import { useState, useMemo } from 'react';
import { Handshake, Search, Pencil, Trash2, UserCheck } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ModalForm } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToCSV, formatDate, cn } from '@/lib/utils';
import type { AppData, Volunteer, Language } from '@/types';

interface VolunteersProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

const volunteerAreas = [
  { value: 'guru-sekolah-minggu', label: { id: 'Guru Sekolah Minggu', en: 'Sunday School Teacher' } },
  { value: 'singer', label: { id: 'Singer', en: 'Singer' } },
  { value: 'worship-leader', label: { id: 'Worship Leader', en: 'Worship Leader' } },
  { value: 'pemain-musik', label: { id: 'Pemain Musik', en: 'Musician' } },
  { value: 'multimedia', label: { id: 'Multimedia', en: 'Multimedia' } },
  { value: 'doa-syafaat', label: { id: 'Doa Syafaat', en: 'Intercession' } },
  { value: 'usher', label: { id: 'Usher', en: 'Usher' } },
  { value: 'lainnya', label: { id: 'Lainnya', en: 'Other' } },
];

export function Volunteers({ data, updateData, lang, t, canEdit, canDelete, showToast }: VolunteersProps) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [useExternal, setUseExternal] = useState(false);

  const [formData, setFormData] = useState<Partial<Volunteer>>({
    memberId: null, externalNama: '', externalTelepon: '', externalEmail: '',
    area: 'guru-sekolah-minggu', status: 'aktif', joinDate: new Date().toISOString().split('T')[0], notes: '',
  });

  const filtered = useMemo(() => {
    return data.volunteers.filter(v => {
      let name = '';
      if (v.memberId) { const m = data.members.find(mem => mem.id === v.memberId); name = m?.nama || ''; }
      else name = v.externalNama || '';
      return !search || name.toLowerCase().includes(search.toLowerCase());
    });
  }, [data.volunteers, data.members, search]);

  const resetForm = () => {
    setFormData({ memberId: null, externalNama: '', externalTelepon: '', externalEmail: '', area: 'guru-sekolah-minggu', status: 'aktif', joinDate: new Date().toISOString().split('T')[0], notes: '' });
    setEditingId(null); setUseExternal(false);
  };

  const openAdd = () => { resetForm(); setIsModalOpen(true); };
  const openEdit = (v: Volunteer) => {
    setFormData({ ...v });
    setEditingId(v.id);
    setUseExternal(!v.memberId);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateData(prev => {
      if (editingId) {
        const idx = prev.volunteers.findIndex(v => v.id === editingId);
        if (idx === -1) return prev;
        const updated = [...prev.volunteers];
        updated[idx] = { ...updated[idx], ...formData } as Volunteer;
        return { ...prev, volunteers: updated };
      } else {
        const newId = Math.max(...prev.volunteers.map(v => v.id), 0) + 1;
        return { ...prev, volunteers: [...prev.volunteers, { ...formData, id: newId } as Volunteer] };
      }
    });
    showToast(editingId ? (lang === 'id' ? 'Relawan diperbarui' : 'Volunteer updated') : (lang === 'id' ? 'Relawan ditambahkan' : 'Volunteer added'), 'success');
    setIsModalOpen(false); resetForm();
  };

  const handleDelete = (id: number) => {
    updateData(prev => ({ ...prev, volunteers: prev.volunteers.filter(v => v.id !== id) }));
    showToast(lang === 'id' ? 'Relawan dihapus' : 'Volunteer deleted', 'success');
    setConfirmDelete(null);
  };

  const handleExport = () => {
    exportToCSV(filtered.map(v => {
      let name = ''; let phone = '';
      if (v.memberId) { const m = data.members.find(mem => mem.id === v.memberId); name = m?.nama || ''; phone = m?.telepon || ''; }
      else { name = v.externalNama || ''; phone = v.externalTelepon || ''; }
      return { Nama: name, Telepon: phone, Area: v.area, Status: v.status };
    }), 'volunteers');
    showToast(lang === 'id' ? 'Data diexport' : 'Data exported', 'success');
  };

  const inputClass = "w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

  return (
    <div>
      <PageHeader title={t('volunteers')} subtitle={`${filtered.length} ${lang === 'id' ? 'relawan' : 'volunteers'}`} onAdd={canEdit ? openAdd : undefined} addLabel={t('add-volunteer')} onExport={handleExport} canEdit={canEdit} lang={lang} />
      
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 bg-[#1e1e1e] border border-white/10 rounded-xl">{t('no-data')}</div>
        ) : filtered.map(v => {
          let name = ''; let phone = ''; let email = '';
          if (v.memberId) { const m = data.members.find(mem => mem.id === v.memberId); name = m?.nama || ''; phone = m?.telepon || ''; email = m?.email || ''; }
          else { name = v.externalNama || ''; phone = v.externalTelepon || ''; email = v.externalEmail || ''; }
          const areaLabel = volunteerAreas.find(a => a.value === v.area);
          return (
            <div key={v.id} className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5 hover:border-orange-500/30 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                    <Handshake className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{name || 'Unknown'}</h4>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full', v.status === 'aktif' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400')}>{v.status === 'aktif' ? t('active') : t('inactive')}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 mb-4">
                <p className="text-xs text-orange-400">{areaLabel?.label[lang] || v.area}</p>
                <p className="text-xs text-gray-400">{phone}</p>
                <p className="text-xs text-gray-500">{formatDate(v.joinDate, lang)}</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && <button onClick={() => openEdit(v)} className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"><Pencil className="w-4 h-4" /></button>}
                {canDelete && <button onClick={() => setConfirmDelete(v.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          );
        })}
      </div>

      <ModalForm isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? (lang === 'id' ? 'Edit Relawan' : 'Edit Volunteer') : t('add-volunteer')} onSubmit={handleSubmit} lang={lang}>
        <div className="space-y-4">
          {!editingId && (
            <div className="flex gap-2">
              <button type="button" onClick={() => setUseExternal(false)} className={cn('flex-1 py-2 text-sm rounded-lg border transition-colors', !useExternal ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'border-white/10 text-gray-400 hover:text-white')}>
                <UserCheck className="w-4 h-4 inline mr-1" /> {lang === 'id' ? 'Dari Jemaat' : 'From Member'}
              </button>
              <button type="button" onClick={() => setUseExternal(true)} className={cn('flex-1 py-2 text-sm rounded-lg border transition-colors', useExternal ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'border-white/10 text-gray-400 hover:text-white')}>
                {lang === 'id' ? 'Eksternal' : 'External'}
              </button>
            </div>
          )}
          {useExternal ? (
            <>
              <div><label className={labelClass}>{lang === 'id' ? 'Nama' : 'Name'} *</label><input type="text" value={formData.externalNama || ''} onChange={e => setFormData(p => ({ ...p, externalNama: e.target.value, memberId: null }))} className={inputClass} required /></div>
              <div><label className={labelClass}>{t('phone')}</label><input type="tel" value={formData.externalTelepon || ''} onChange={e => setFormData(p => ({ ...p, externalTelepon: e.target.value }))} className={inputClass} /></div>
              <div><label className={labelClass}>{t('email')}</label><input type="email" value={formData.externalEmail || ''} onChange={e => setFormData(p => ({ ...p, externalEmail: e.target.value }))} className={inputClass} /></div>
            </>
          ) : (
            <div><label className={labelClass}>{t('member')} *</label>
              <select value={formData.memberId || ''} onChange={e => setFormData(p => ({ ...p, memberId: Number(e.target.value), externalNama: null, externalTelepon: null, externalEmail: null }))} className={inputClass} required={!useExternal}>
                <option value="">{t('select-member')}</option>
                {data.members.filter(m => m.status === 'aktif').map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
              </select>
            </div>
          )}
          <div><label className={labelClass}>{t('area')}</label>
            <select value={formData.area || 'guru-sekolah-minggu'} onChange={e => setFormData(p => ({ ...p, area: e.target.value }))} className={inputClass}>
              {volunteerAreas.map(a => <option key={a.value} value={a.value}>{a.label[lang]}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>{t('status')}</label>
            <select value={formData.status || 'aktif'} onChange={e => setFormData(p => ({ ...p, status: e.target.value as Volunteer['status'] }))} className={inputClass}>
              <option value="aktif">{t('active')}</option>
              <option value="nonaktif">{t('inactive')}</option>
            </select>
          </div>
          <div><label className={labelClass}>{t('notes')}</label><textarea value={formData.notes || ''} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className={cn(inputClass, 'h-20 resize-none')} /></div>
        </div>
      </ModalForm>

      <ConfirmDialog isOpen={confirmDelete !== null} title={t('confirm')} message={lang === 'id' ? 'Hapus relawan ini?' : 'Delete this volunteer?'} onConfirm={() => confirmDelete !== null && handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} lang={lang} />
    </div>
  );
}
