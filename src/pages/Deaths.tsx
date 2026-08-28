import { useState, useEffect } from 'react';
import { Skull, Plus, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { cn, formatDate } from '@/lib/utils';
import { getAllDocuments, addDocument } from '@/lib/firebase';
import type { AppData, DeathRecord, Language } from '@/types';

interface DeathsProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function Deaths({ data, updateData, lang, t, canEdit, showToast }: DeathsProps) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<DeathRecord[]>(data.deathRecords || []);
  const [formData, setFormData] = useState<Partial<DeathRecord>>({
    nama: '', tglLahir: '', tglWafat: '', riwayatPenyakit: '', penyebab: '', tempat: '', waktu: '',
  });

  useEffect(() => {
    setRecords(data.deathRecords || []);
  }, [data.deathRecords]);

  const filtered = records.filter(r =>
    !search || r.nama.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || !formData.tglWafat) {
      showToast(lang === 'id' ? 'Nama dan tanggal wafat wajib diisi' : 'Name and death date are required', 'error');
      return;
    }

    const newRecord: DeathRecord = {
      ...formData as DeathRecord,
      id: Date.now().toString(),
    };

    // Try Firebase first
    try {
      const result = await addDocument('deaths', newRecord);
      if (result) {
        showToast(lang === 'id' ? 'Data kematian berhasil disimpan' : 'Death record saved', 'success');
      }
    } catch {
      // Fallback to localStorage
    }

    updateData(prev => ({
      ...prev,
      deathRecords: [...(prev.deathRecords || []), newRecord],
    }));

    setFormData({ nama: '', tglLahir: '', tglWafat: '', riwayatPenyakit: '', penyebab: '', tempat: '', waktu: '' });
    setShowForm(false);
    showToast(lang === 'id' ? 'Data kematian berhasil disimpan' : 'Death record saved', 'success');
  };

  const inputClass = "w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

  return (
    <div>
      <PageHeader title={t('deaths')} subtitle={`${filtered.length} ${lang === 'id' ? 'catatan' : 'records'}`} onAdd={canEdit ? () => setShowForm(!showForm) : undefined} addLabel={lang === 'id' ? 'Tambah Data' : 'Add Record'} canEdit={canEdit} lang={lang} />

      {/* Search */}
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50" />
        </div>
      </div>

      {/* Form */}
      {showForm && canEdit && (
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-6 mb-6 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">{lang === 'id' ? 'Form Data Kematian' : 'Death Record Form'}</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelClass}>{t('name')} *</label><input type="text" value={formData.nama || ''} onChange={e => setFormData(p => ({ ...p, nama: e.target.value }))} className={inputClass} required /></div>
              <div><label className={labelClass}>{t('birth-date')}</label><input type="date" value={formData.tglLahir || ''} onChange={e => setFormData(p => ({ ...p, tglLahir: e.target.value }))} className={inputClass} /></div>
              <div><label className={labelClass}>{lang === 'id' ? 'Tanggal Wafat' : 'Death Date'} *</label><input type="date" value={formData.tglWafat || ''} onChange={e => setFormData(p => ({ ...p, tglWafat: e.target.value }))} className={inputClass} required /></div>
              <div><label className={labelClass}>{lang === 'id' ? 'Riwayat Penyakit' : 'Medical History'}</label><input type="text" value={formData.riwayatPenyakit || ''} onChange={e => setFormData(p => ({ ...p, riwayatPenyakit: e.target.value }))} className={inputClass} /></div>
              <div><label className={labelClass}>{lang === 'id' ? 'Penyebab' : 'Cause'}</label><input type="text" value={formData.penyebab || ''} onChange={e => setFormData(p => ({ ...p, penyebab: e.target.value }))} className={inputClass} /></div>
              <div><label className={labelClass}>{t('location')}</label><input type="text" value={formData.tempat || ''} onChange={e => setFormData(p => ({ ...p, tempat: e.target.value }))} className={inputClass} /></div>
              <div><label className={labelClass}>{t('time')}</label><input type="time" value={formData.waktu || ''} onChange={e => setFormData(p => ({ ...p, waktu: e.target.value }))} className={inputClass} /></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4 inline mr-2" />{t('save')}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-300 border border-white/20 rounded-lg hover:bg-white/5">{t('cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Records */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-[#1e1e1e] border border-white/10 rounded-xl">{t('no-data')}</div>
        ) : filtered.sort((a, b) => new Date(b.tglWafat).getTime() - new Date(a.tglWafat).getTime()).map((r, i) => (
          <div key={i} className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5 hover:border-orange-500/30 transition-all">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center flex-shrink-0">
                <Skull className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">{r.nama}</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {r.tglLahir && <p className="text-xs text-gray-400">{lang === 'id' ? 'Lahir' : 'Born'}: {formatDate(r.tglLahir, lang)}</p>}
                  <p className="text-xs text-gray-400">{lang === 'id' ? 'Wafat' : 'Died'}: {formatDate(r.tglWafat, lang)}</p>
                  {r.penyebab && <p className="text-xs text-gray-400">{lang === 'id' ? 'Penyebab' : 'Cause'}: {r.penyebab}</p>}
                  {r.tempat && <p className="text-xs text-gray-400">{t('location')}: {r.tempat}</p>}
                  {r.waktu && <p className="text-xs text-gray-400">{t('time')}: {r.waktu}</p>}
                  {r.riwayatPenyakit && <p className="text-xs text-gray-400">{lang === 'id' ? 'Riwayat' : 'History'}: {r.riwayatPenyakit}</p>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
