import { useState, useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, Search, Pencil, Trash2, Check, X, PieChart } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ModalForm } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToCSV, formatRupiah, formatDate, cn } from '@/lib/utils';
import type { AppData, Pemasukan, Pengeluaran, FinanceCategory, Language } from '@/types';

interface FinanceProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function Finance({ data, updateData, lang, t, canEdit, canDelete, canApprove, showToast }: FinanceProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pemasukan' | 'pengeluaran' | 'kategori' | 'approval'>('dashboard');
  const [search, setSearch] = useState('');
  const [isPemasukanModal, setIsPemasukanModal] = useState(false);
  const [isPengeluaranModal, setIsPengeluaranModal] = useState(false);
  const [isKategoriModal, setIsKategoriModal] = useState(false);
  const [editingPemasukan, setEditingPemasukan] = useState<number | null>(null);
  const [editingPengeluaran, setEditingPengeluaran] = useState<number | null>(null);
  const [editingKategori, setEditingKategori] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: number } | null>(null);

  const [pemasukanForm, setPemasukanForm] = useState<Partial<Pemasukan>>({ kategoriId: undefined, jumlah: 0, tanggal: new Date().toISOString().split('T')[0], donaturId: undefined, keterangan: '', status: 'pending' });
  const [pengeluaranForm, setPengeluaranForm] = useState<Partial<Pengeluaran>>({ kategoriId: undefined, jumlah: 0, tanggal: new Date().toISOString().split('T')[0], keterangan: '', status: 'pending' });
  const [kategoriForm, setKategoriForm] = useState<Partial<FinanceCategory>>({ nama: '', tipe: 'pemasukan', deskripsi: '' });

  const pemasukan = data.pemasukan || [];
  const pengeluaran = data.pengeluaran || [];
  const categories = data.financeCategories || [];

  const totalPemasukan = pemasukan.filter(p => p.status === 'approved').reduce((s, p) => s + p.jumlah, 0);
  const totalPengeluaran = pengeluaran.filter(p => p.status === 'approved').reduce((s, p) => s + p.jumlah, 0);
  const saldo = (data.finance?.saldoAwal || 0) + totalPemasukan - totalPengeluaran;

  const filteredPemasukan = useMemo(() => {
    return pemasukan.filter(p => !search || p.keterangan?.toLowerCase().includes(search.toLowerCase())).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [pemasukan, search]);

  const filteredPengeluaran = useMemo(() => {
    return pengeluaran.filter(p => !search || p.keterangan?.toLowerCase().includes(search.toLowerCase())).sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [pengeluaran, search]);

  const pendingItems = [...pemasukan.filter(p => p.status === 'pending').map(p => ({ ...p, tipe: 'pemasukan' as const })), ...pengeluaran.filter(p => p.status === 'pending').map(p => ({ ...p, tipe: 'pengeluaran' as const }))];

  const inputClass = "w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

  const resetPemasukanForm = () => { setPemasukanForm({ kategoriId: undefined, jumlah: 0, tanggal: new Date().toISOString().split('T')[0], donaturId: undefined, keterangan: '', status: 'pending' }); setEditingPemasukan(null); };
  const resetPengeluaranForm = () => { setPengeluaranForm({ kategoriId: undefined, jumlah: 0, tanggal: new Date().toISOString().split('T')[0], keterangan: '', status: 'pending' }); setEditingPengeluaran(null); };
  const resetKategoriForm = () => { setKategoriForm({ nama: '', tipe: 'pemasukan', deskripsi: '' }); setEditingKategori(null); };

  const handleSavePemasukan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pemasukanForm.kategoriId || !pemasukanForm.jumlah) { showToast(lang === 'id' ? 'Kategori dan jumlah wajib diisi' : 'Category and amount are required', 'error'); return; }
    updateData(prev => {
      if (editingPemasukan) { const idx = prev.pemasukan.findIndex(p => p.id === editingPemasukan); if (idx === -1) return prev; const updated = [...prev.pemasukan]; updated[idx] = { ...updated[idx], ...pemasukanForm } as Pemasukan; return { ...prev, pemasukan: updated }; }
      else { const newId = prev.pemasukan.length > 0 ? Math.max(...prev.pemasukan.map(p => p.id)) + 1 : 1; return { ...prev, pemasukan: [...prev.pemasukan, { ...pemasukanForm, id: newId, status: 'pending', approvedBy: null, approvedAt: null } as Pemasukan] }; }
    });
    showToast(editingPemasukan ? (lang === 'id' ? 'Pemasukan diperbarui' : 'Income updated') : (lang === 'id' ? 'Pemasukan ditambahkan' : 'Income added'), 'success');
    setIsPemasukanModal(false); resetPemasukanForm();
  };

  const handleSavePengeluaran = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pengeluaranForm.kategoriId || !pengeluaranForm.jumlah) { showToast(lang === 'id' ? 'Kategori dan jumlah wajib diisi' : 'Category and amount are required', 'error'); return; }
    updateData(prev => {
      if (editingPengeluaran) { const idx = prev.pengeluaran.findIndex(p => p.id === editingPengeluaran); if (idx === -1) return prev; const updated = [...prev.pengeluaran]; updated[idx] = { ...updated[idx], ...pengeluaranForm } as Pengeluaran; return { ...prev, pengeluaran: updated }; }
      else { const newId = prev.pengeluaran.length > 0 ? Math.max(...prev.pengeluaran.map(p => p.id)) + 1 : 1; return { ...prev, pengeluaran: [...prev.pengeluaran, { ...pengeluaranForm, id: newId, status: 'pending', approvedBy: null, approvedAt: null } as Pengeluaran] }; }
    });
    showToast(editingPengeluaran ? (lang === 'id' ? 'Pengeluaran diperbarui' : 'Expense updated') : (lang === 'id' ? 'Pengeluaran ditambahkan' : 'Expense added'), 'success');
    setIsPengeluaranModal(false); resetPengeluaranForm();
  };

  const handleSaveKategori = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kategoriForm.nama) { showToast(lang === 'id' ? 'Nama kategori wajib diisi' : 'Category name is required', 'error'); return; }
    updateData(prev => {
      if (editingKategori) { const idx = prev.financeCategories.findIndex(k => k.id === editingKategori); if (idx === -1) return prev; const updated = [...prev.financeCategories]; updated[idx] = { ...updated[idx], ...kategoriForm } as FinanceCategory; return { ...prev, financeCategories: updated }; }
      else { const newId = prev.financeCategories.length > 0 ? Math.max(...prev.financeCategories.map(k => k.id)) + 1 : 1; return { ...prev, financeCategories: [...prev.financeCategories, { ...kategoriForm, id: newId } as FinanceCategory] }; }
    });
    showToast(editingKategori ? (lang === 'id' ? 'Kategori diperbarui' : 'Category updated') : (lang === 'id' ? 'Kategori ditambahkan' : 'Category added'), 'success');
    setIsKategoriModal(false); resetKategoriForm();
  };

  const handleDelete = (type: string, id: number) => {
    updateData(prev => {
      if (type === 'pemasukan') return { ...prev, pemasukan: prev.pemasukan.filter(p => p.id !== id) };
      if (type === 'pengeluaran') return { ...prev, pengeluaran: prev.pengeluaran.filter(p => p.id !== id) };
      if (type === 'kategori') return { ...prev, financeCategories: prev.financeCategories.filter(k => k.id !== id) };
      return prev;
    });
    showToast(lang === 'id' ? 'Data dihapus' : 'Data deleted', 'success');
    setConfirmDelete(null);
  };

  const handleApprove = (type: 'pemasukan' | 'pengeluaran', id: number, action: 'approved' | 'rejected') => {
    updateData(prev => {
      if (type === 'pemasukan') { const idx = prev.pemasukan.findIndex(p => p.id === id); if (idx === -1) return prev; const updated = [...prev.pemasukan]; updated[idx] = { ...updated[idx], status: action, approvedBy: 1, approvedAt: new Date().toISOString() }; return { ...prev, pemasukan: updated }; }
      else { const idx = prev.pengeluaran.findIndex(p => p.id === id); if (idx === -1) return prev; const updated = [...prev.pengeluaran]; updated[idx] = { ...updated[idx], status: action, approvedBy: 1, approvedAt: new Date().toISOString() }; return { ...prev, pengeluaran: updated }; }
    });
    showToast(action === 'approved' ? (lang === 'id' ? 'Disetujui' : 'Approved') : (lang === 'id' ? 'Ditolak' : 'Rejected'), 'success');
  };

  const tabs = [
    { key: 'dashboard', label: lang === 'id' ? 'Dashboard' : 'Dashboard' },
    { key: 'pemasukan', label: t('income') },
    { key: 'pengeluaran', label: t('expense') },
    { key: 'kategori', label: t('category') },
    { key: 'approval', label: t('approve') },
  ];

  return (
    <div>
      <PageHeader title={t('finance')} lang={lang} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center"><Wallet className="w-5 h-5 text-orange-400" /></div>
            <div><p className="text-xs text-gray-400">{t('balance')}</p><p className="text-xl font-bold text-white">{formatRupiah(saldo)}</p></div>
          </div>
        </div>
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-400" /></div>
            <div><p className="text-xs text-gray-400">{t('total-income')}</p><p className="text-xl font-bold text-green-400">{formatRupiah(totalPemasukan)}</p></div>
          </div>
        </div>
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-400" /></div>
            <div><p className="text-xs text-gray-400">{t('total-expense')}</p><p className="text-xl font-bold text-red-400">{formatRupiah(totalPengeluaran)}</p></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/10 pb-1 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={cn('px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap', activeTab === tab.key ? 'text-orange-400 bg-orange-500/10 border-b-2 border-orange-500' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {(activeTab === 'pemasukan' || activeTab === 'pengeluaran') && (
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 mb-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50" />
            </div>
            {canEdit && (
              <button onClick={() => activeTab === 'pemasukan' ? (resetPemasukanForm(), setIsPemasukanModal(true)) : (resetPengeluaranForm(), setIsPengeluaranModal(true))} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-medium rounded-lg transition-colors">
                {activeTab === 'pemasukan' ? t('add-income') : t('add-expense')}
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4">{lang === 'id' ? 'Ringkasan Keuangan' : 'Financial Summary'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-green-400 mb-3">{t('income')} - {lang === 'id' ? 'Bulan Ini' : 'This Month'}</h4>
              <div className="space-y-2">
                {categories.filter(c => c.tipe === 'pemasukan').map(c => {
                  const total = pemasukan.filter(p => p.kategoriId === c.id && p.status === 'approved').reduce((s, p) => s + p.jumlah, 0);
                  return total > 0 ? <div key={c.id} className="flex justify-between text-sm"><span className="text-gray-300">{c.nama}</span><span className="text-green-400 font-medium">{formatRupiah(total)}</span></div> : null;
                })}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-red-400 mb-3">{t('expense')} - {lang === 'id' ? 'Bulan Ini' : 'This Month'}</h4>
              <div className="space-y-2">
                {categories.filter(c => c.tipe === 'pengeluaran').map(c => {
                  const total = pengeluaran.filter(p => p.kategoriId === c.id && p.status === 'approved').reduce((s, p) => s + p.jumlah, 0);
                  return total > 0 ? <div key={c.id} className="flex justify-between text-sm"><span className="text-gray-300">{c.nama}</span><span className="text-red-400 font-medium">{formatRupiah(total)}</span></div> : null;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pemasukan' && (
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('date')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('category')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('description')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('amount')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('status')}</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('actions')}</th>
              </tr></thead>
              <tbody>
                {filteredPemasukan.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-gray-500">{t('no-data')}</td></tr> : filteredPemasukan.map(p => {
                  const cat = categories.find(c => c.id === p.kategoriId);
                  return (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-sm text-gray-300">{formatDate(p.tanggal, lang)}</td>
                      <td className="py-3 px-4 text-sm text-gray-300">{cat?.nama || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-300">{p.keterangan || '-'}</td>
                      <td className="py-3 px-4 text-sm text-green-400 font-medium">{formatRupiah(p.jumlah)}</td>
                      <td className="py-3 px-4"><span className={cn('text-xs px-2 py-0.5 rounded-full', p.status === 'approved' ? 'bg-green-500/10 text-green-400' : p.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400')}>{p.status}</span></td>
                      <td className="py-3 px-4"><div className="flex items-center justify-end gap-1">{canEdit && <button onClick={() => { setPemasukanForm(p); setEditingPemasukan(p.id); setIsPemasukanModal(true); }} className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded"><Pencil className="w-4 h-4" /></button>}{canDelete && <button onClick={() => setConfirmDelete({ type: 'pemasukan', id: p.id })} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"><Trash2 className="w-4 h-4" /></button>}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pengeluaran' && (
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('date')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('category')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('description')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('amount')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('status')}</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('actions')}</th>
              </tr></thead>
              <tbody>
                {filteredPengeluaran.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-gray-500">{t('no-data')}</td></tr> : filteredPengeluaran.map(p => {
                  const cat = categories.find(c => c.id === p.kategoriId);
                  return (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-sm text-gray-300">{formatDate(p.tanggal, lang)}</td>
                      <td className="py-3 px-4 text-sm text-gray-300">{cat?.nama || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-300">{p.keterangan || '-'}</td>
                      <td className="py-3 px-4 text-sm text-red-400 font-medium">{formatRupiah(p.jumlah)}</td>
                      <td className="py-3 px-4"><span className={cn('text-xs px-2 py-0.5 rounded-full', p.status === 'approved' ? 'bg-green-500/10 text-green-400' : p.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400')}>{p.status}</span></td>
                      <td className="py-3 px-4"><div className="flex items-center justify-end gap-1">{canEdit && <button onClick={() => { setPengeluaranForm(p); setEditingPengeluaran(p.id); setIsPengeluaranModal(true); }} className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded"><Pencil className="w-4 h-4" /></button>}{canDelete && <button onClick={() => setConfirmDelete({ type: 'pengeluaran', id: p.id })} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"><Trash2 className="w-4 h-4" /></button>}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'kategori' && (
        <div>
          {canEdit && <div className="mb-4"><button onClick={() => { resetKategoriForm(); setIsKategoriModal(true); }} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-medium rounded-lg transition-colors">{t('add-category')}</button></div>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.length === 0 ? <div className="col-span-full text-center py-12 text-gray-500 bg-[#1e1e1e] border border-white/10 rounded-xl">{t('no-data')}</div> : categories.map(c => (
              <div key={c.id} className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5 hover:border-orange-500/30 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white">{c.nama}</h4>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', c.tipe === 'pemasukan' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>{c.tipe === 'pemasukan' ? t('income') : t('expense')}</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">{c.deskripsi || '-'}</p>
                <div className="flex items-center gap-2">
                  {canEdit && <button onClick={() => { setKategoriForm(c); setEditingKategori(c.id); setIsKategoriModal(true); }} className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded"><Pencil className="w-4 h-4" /></button>}
                  {canDelete && <button onClick={() => setConfirmDelete({ type: 'kategori', id: c.id })} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'approval' && (
        <div>
          <h3 className="text-base font-semibold text-white mb-4">{t('pending')} ({pendingItems.length})</h3>
          {pendingItems.length === 0 ? <div className="text-center py-12 text-gray-500 bg-[#1e1e1e] border border-white/10 rounded-xl">{t('no-data')}</div> : (
            <div className="space-y-3">
              {pendingItems.map(item => {
                const cat = categories.find(c => c.id === item.kategoriId);
                return (
                  <div key={`${item.tipe}-${item.id}`} className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', item.tipe === 'pemasukan' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>{item.tipe === 'pemasukan' ? t('income') : t('expense')}</span>
                        <span className="text-sm font-medium text-white">{cat?.nama || '-'}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{item.keterangan || '-'}</p>
                      <p className={cn('text-sm font-medium mt-1', item.tipe === 'pemasukan' ? 'text-green-400' : 'text-red-400')}>{formatRupiah(item.jumlah)}</p>
                    </div>
                    {canApprove && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleApprove(item.tipe as 'pemasukan' | 'pengeluaran', item.id, 'approved')} className="p-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"><Check className="w-4 h-4" /></button>
                        <button onClick={() => handleApprove(item.tipe as 'pemasukan' | 'pengeluaran', item.id, 'rejected')} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ModalForm isOpen={isPemasukanModal} onClose={() => { setIsPemasukanModal(false); resetPemasukanForm(); }} title={editingPemasukan ? (lang === 'id' ? 'Edit Pemasukan' : 'Edit Income') : t('add-income')} onSubmit={handleSavePemasukan} lang={lang}>
        <div className="space-y-4">
          <div><label className={labelClass}>{t('category')} *</label><select value={pemasukanForm.kategoriId || ''} onChange={e => setPemasukanForm(p => ({ ...p, kategoriId: Number(e.target.value) }))} className={inputClass} required><option value="">{t('select')}</option>{categories.filter(c => c.tipe === 'pemasukan').map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}</select></div>
          <div><label className={labelClass}>{t('amount')} *</label><input type="number" value={pemasukanForm.jumlah || ''} onChange={e => setPemasukanForm(p => ({ ...p, jumlah: Number(e.target.value) }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{t('date')}</label><input type="date" value={pemasukanForm.tanggal || ''} onChange={e => setPemasukanForm(p => ({ ...p, tanggal: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>{t('description')}</label><input type="text" value={pemasukanForm.keterangan || ''} onChange={e => setPemasukanForm(p => ({ ...p, keterangan: e.target.value }))} className={inputClass} /></div>
        </div>
      </ModalForm>

      <ModalForm isOpen={isPengeluaranModal} onClose={() => { setIsPengeluaranModal(false); resetPengeluaranForm(); }} title={editingPengeluaran ? (lang === 'id' ? 'Edit Pengeluaran' : 'Edit Expense') : t('add-expense')} onSubmit={handleSavePengeluaran} lang={lang}>
        <div className="space-y-4">
          <div><label className={labelClass}>{t('category')} *</label><select value={pengeluaranForm.kategoriId || ''} onChange={e => setPengeluaranForm(p => ({ ...p, kategoriId: Number(e.target.value) }))} className={inputClass} required><option value="">{t('select')}</option>{categories.filter(c => c.tipe === 'pengeluaran').map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}</select></div>
          <div><label className={labelClass}>{t('amount')} *</label><input type="number" value={pengeluaranForm.jumlah || ''} onChange={e => setPengeluaranForm(p => ({ ...p, jumlah: Number(e.target.value) }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{t('date')}</label><input type="date" value={pengeluaranForm.tanggal || ''} onChange={e => setPengeluaranForm(p => ({ ...p, tanggal: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>{t('description')}</label><input type="text" value={pengeluaranForm.keterangan || ''} onChange={e => setPengeluaranForm(p => ({ ...p, keterangan: e.target.value }))} className={inputClass} /></div>
        </div>
      </ModalForm>

      <ModalForm isOpen={isKategoriModal} onClose={() => { setIsKategoriModal(false); resetKategoriForm(); }} title={editingKategori ? (lang === 'id' ? 'Edit Kategori' : 'Edit Category') : t('add-category')} onSubmit={handleSaveKategori} lang={lang}>
        <div className="space-y-4">
          <div><label className={labelClass}>{t('name')} *</label><input type="text" value={kategoriForm.nama || ''} onChange={e => setKategoriForm(p => ({ ...p, nama: e.target.value }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{t('type')}</label><select value={kategoriForm.tipe || 'pemasukan'} onChange={e => setKategoriForm(p => ({ ...p, tipe: e.target.value as 'pemasukan' | 'pengeluaran' }))} className={inputClass}><option value="pemasukan">{t('income')}</option><option value="pengeluaran">{t('expense')}</option></select></div>
          <div><label className={labelClass}>{t('description')}</label><input type="text" value={kategoriForm.deskripsi || ''} onChange={e => setKategoriForm(p => ({ ...p, deskripsi: e.target.value }))} className={inputClass} /></div>
        </div>
      </ModalForm>

      <ConfirmDialog isOpen={confirmDelete !== null} title={t('confirm')} message={lang === 'id' ? 'Hapus data ini?' : 'Delete this data?'} onConfirm={() => confirmDelete && handleDelete(confirmDelete.type, confirmDelete.id)} onCancel={() => setConfirmDelete(null)} lang={lang} />
    </div>
  );
}
