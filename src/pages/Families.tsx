import { useState, useMemo } from 'react';
import { Heart, Search, Eye, Pencil, Trash2, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ModalForm } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToCSV } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { AppData, Family, Language } from '@/types';

interface FamiliesProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function Families({ data, updateData, lang, t, canEdit, canDelete, showToast }: FamiliesProps) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailFamily, setDetailFamily] = useState<Family | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const [formData, setFormData] = useState<Partial<Family>>({ nama: '', kepalaId: null, anggota: [], alamat: '', kota: '' });

  const filtered = useMemo(() => {
    return data.families.filter(f =>
      !search || f.nama.toLowerCase().includes(search.toLowerCase()) || f.alamat.toLowerCase().includes(search.toLowerCase())
    );
  }, [data.families, search]);

  const resetForm = () => {
    setFormData({ nama: '', kepalaId: null, anggota: [], alamat: '', kota: '' });
    setEditingId(null);
  };

  const openAdd = () => { resetForm(); setIsModalOpen(true); };
  const openEdit = (f: Family) => { setFormData({ ...f }); setEditingId(f.id); setIsModalOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama) { showToast(lang === 'id' ? 'Nama keluarga wajib diisi' : 'Family name is required', 'error'); return; }

    updateData(prev => {
      if (editingId) {
        const idx = prev.families.findIndex(f => f.id === editingId);
        if (idx === -1) return prev;
        const updated = [...prev.families];
        updated[idx] = { ...updated[idx], ...formData } as Family;
        return { ...prev, families: updated };
      } else {
        const newId = Math.max(...prev.families.map(f => f.id), 0) + 1;
        return { ...prev, families: [...prev.families, { ...formData, id: newId } as Family] };
      }
    });
    showToast(editingId ? (lang === 'id' ? 'Keluarga diperbarui' : 'Family updated') : (lang === 'id' ? 'Keluarga ditambahkan' : 'Family added'), 'success');
    setIsModalOpen(false); resetForm();
  };

  const handleDelete = (id: number) => {
    updateData(prev => ({ ...prev, families: prev.families.filter(f => f.id !== id) }));
    showToast(lang === 'id' ? 'Keluarga dihapus' : 'Family deleted', 'success');
    setConfirmDelete(null);
  };

  const handleExport = () => {
    exportToCSV(filtered.map(f => ({ Nama: f.nama, Alamat: f.alamat, Kota: f.kota, Anggota: f.anggota.length })), 'families');
    showToast(lang === 'id' ? 'Data diexport' : 'Data exported', 'success');
  };

  const inputClass = "w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

  return (
    <div>
      <PageHeader title={t('families')} subtitle={`${filtered.length} ${lang === 'id' ? 'keluarga' : 'families'}`} onAdd={canEdit ? openAdd : undefined} addLabel={t('add-family')} onExport={handleExport} canEdit={canEdit} lang={lang} />
      
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 bg-[#1e1e1e] border border-white/10 rounded-xl">{t('no-data')}</div>
        ) : filtered.map(f => {
          const kepala = data.members.find(m => m.id === f.kepalaId);
          const anggotaList = f.anggota.map(id => data.members.find(m => m.id === id)).filter(Boolean);
          return (
            <div key={f.id} className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5 hover:border-orange-500/30 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{f.nama}</h4>
                    <p className="text-xs text-gray-400">{anggotaList.length} {lang === 'id' ? 'anggota' : 'members'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 mb-4">
                <p className="text-xs text-gray-400 flex items-center gap-2"><Users className="w-3 h-3" /> {t('head-family')}: {kepala?.nama || '-'}</p>
                <p className="text-xs text-gray-400">{f.alamat}, {f.kota}</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && <button onClick={() => openEdit(f)} className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"><Pencil className="w-4 h-4" /></button>}
                {canDelete && <button onClick={() => setConfirmDelete(f.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>}
                <button onClick={() => setDetailFamily(f)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"><Eye className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>

      <ModalForm isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? (lang === 'id' ? 'Edit Keluarga' : 'Edit Family') : t('add-family')} onSubmit={handleSubmit} lang={lang}>
        <div className="space-y-4">
          <div><label className={labelClass}>{t('name')} *</label><input type="text" value={formData.nama || ''} onChange={e => setFormData(p => ({ ...p, nama: e.target.value }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{t('head-family')}</label>
            <select value={formData.kepalaId || ''} onChange={e => setFormData(p => ({ ...p, kepalaId: e.target.value ? Number(e.target.value) : null }))} className={inputClass}>
              <option value="">{t('select')}</option>
              {data.members.filter(m => m.status === 'aktif').map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>{t('address')}</label><input type="text" value={formData.alamat || ''} onChange={e => setFormData(p => ({ ...p, alamat: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>{t('city')}</label><input type="text" value={formData.kota || ''} onChange={e => setFormData(p => ({ ...p, kota: e.target.value }))} className={inputClass} /></div>
        </div>
      </ModalForm>

      {detailFamily && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setDetailFamily(null)}>
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">{detailFamily.nama}</h3>
              <button onClick={() => setDetailFamily(null)} className="text-gray-400 hover:text-white">x</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#2a2a2a] rounded-lg p-3"><p className="text-xs text-gray-500">{t('head-family')}</p><p className="text-sm text-white">{data.members.find(m => m.id === detailFamily.kepalaId)?.nama || '-'}</p></div>
                <div className="bg-[#2a2a2a] rounded-lg p-3"><p className="text-xs text-gray-500">{t('address')}</p><p className="text-sm text-white">{detailFamily.alamat}, {detailFamily.kota}</p></div>
              </div>
              <h4 className="text-sm font-medium text-white">{t('family-members')}</h4>
              <div className="space-y-2">
                {detailFamily.anggota.map(id => {
                  const m = data.members.find(mem => mem.id === id);
                  if (!m) return null;
                  return (
                    <div key={id} className="flex items-center gap-3 p-2 rounded-lg bg-[#2a2a2a]">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center"><span className="text-white text-xs font-bold">{m.nama.charAt(0)}</span></div>
                      <div><p className="text-sm text-white">{m.nama} {m.id === detailFamily.kepalaId && <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">{t('head-family')}</span>}</p><p className="text-xs text-gray-400">{m.jk} &bull; {m.telepon}</p></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={confirmDelete !== null} title={t('confirm')} message={lang === 'id' ? 'Hapus keluarga ini?' : 'Delete this family?'} onConfirm={() => confirmDelete !== null && handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} lang={lang} />
    </div>
  );
}
