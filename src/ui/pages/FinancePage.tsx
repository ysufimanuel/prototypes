/**
 * Finance Page - Kelola keuangan gereja (income, expense, categories)
 */

import { useState, useMemo, useEffect } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { formatRupiah, formatDate } from '@/utils/formatters';
import { canEdit, canApproveFinance } from '@/auth/permissions';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import type { Pemasukan, Pengeluaran, FinanceCategory } from '@/types/models';
import { Banknote, Plus, Trash2, X, Check, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

type FinanceTab = 'dashboard' | 'income' | 'expense' | 'categories';

export function FinancePage() {
  const { pemasukan, pengeluaran, financeCategories, finance, currentUser } = useStoreSelector(s => ({
    pemasukan: s.pemasukan, pengeluaran: s.pengeluaran, financeCategories: s.financeCategories,
    finance: s.finance, currentUser: s.currentUser,
  }));
  const [activeTab, setActiveTab] = useState<FinanceTab>('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense' | 'category'>('income');
  const [formData, setFormData] = useState<Record<string, any>>({});

  const userCanEdit = canEdit(currentUser);
  const userCanApprove = canApproveFinance(currentUser);

  useEffect(() => {
    const unsub1 = subscribeToCollection<Pemasukan>(DB_COLLECTIONS.PEMASUKAN, (data) => store.setCollection('pemasukan', data));
    const unsub2 = subscribeToCollection<Pengeluaran>(DB_COLLECTIONS.PENGELUARAN, (data) => store.setCollection('pengeluaran', data));
    return () => { unsub1(); unsub2(); };
  }, []);

  const stats = useMemo(() => {
    const totalIncome = pemasukan.filter(p => p.status === 'approved').reduce((s, p) => s + (p.jumlah || 0), 0);
    const totalExpense = pengeluaran.filter(p => p.status === 'approved').reduce((s, p) => s + (p.jumlah || 0), 0);
    const balance = (finance?.saldoAwal || 0) + totalIncome - totalExpense;
    return { totalIncome, totalExpense, balance };
  }, [pemasukan, pengeluaran, finance]);

  const getCategoryName = (id: string) => financeCategories.find(c => c.id === id)?.nama || '-';

  const handleAdd = (type: 'income' | 'expense' | 'category') => {
    setModalType(type);
    setFormData(type === 'category' ? { tipe: 'pemasukan' } : { tanggal: new Date().toISOString().split('T')[0], status: 'pending' });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    store.setLoading(true);
    try {
      if (modalType === 'income') {
        await addDocument<Pemasukan>(DB_COLLECTIONS.PEMASUKAN, { ...formData, status: userCanApprove ? 'approved' : 'pending' } as Pemasukan);
      } else if (modalType === 'expense') {
        await addDocument<Pengeluaran>(DB_COLLECTIONS.PENGELUARAN, { ...formData, status: userCanApprove ? 'approved' : 'pending' } as Pengeluaran);
      } else {
        await addDocument<FinanceCategory>(DB_COLLECTIONS.FINANCE_CATEGORIES, formData as FinanceCategory);
      }
      store.showToast(t('save-success'), 'success'); setShowModal(false);
    } catch { store.showToast(t('save-error'), 'error'); }
    store.setLoading(false);
  };

  const handleApprove = async (id: string, type: 'income' | 'expense') => {
    store.setLoading(true);
    try {
      const coll = type === 'income' ? DB_COLLECTIONS.PEMASUKAN : DB_COLLECTIONS.PENGELUARAN;
      await updateDocument(coll, id, { status: 'approved', approvedAt: new Date().toISOString() });
      store.showToast('Disetujui!', 'success');
    } catch { store.showToast('Gagal', 'error'); }
    store.setLoading(false);
  };

  const handleDelete = async (id: string, coll: string) => {
    if (!window.confirm(t('confirm-delete'))) return;
    store.setLoading(true);
    try { await deleteDocument(coll, id); store.showToast(t('delete-success'), 'success'); }
    catch { store.showToast(t('delete-error'), 'error'); }
    store.setLoading(false);
  };

  const tabs = [
    { key: 'dashboard' as FinanceTab, label: t('finance-dashboard') },
    { key: 'income' as FinanceTab, label: t('income') },
    { key: 'expense' as FinanceTab, label: t('expense') },
    { key: 'categories' as FinanceTab, label: t('categories') },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6"><h1 className="text-2xl font-bold text-white flex items-center gap-3"><Banknote className="w-7 h-7 text-orange-500" />{t('finance')}</h1><p className="text-gray-400 text-sm mt-1">{t('manage-finance')}</p></div>
      <div className="flex gap-1 bg-[#141414] rounded-xl p-1 mb-6 border border-[#2a2a2a]">
        {tabs.map(tab => <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-orange-500/15 text-orange-400' : 'text-gray-400 hover:text-white'}`}>{tab.label}</button>)}
      </div>

      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6 flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white"><Wallet className="w-6 h-6" /></div><div><h3 className="text-2xl font-bold text-white">{formatRupiah(stats.balance)}</h3><p className="text-gray-400 text-sm">{t('current-balance')}</p></div></div>
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6 flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white"><TrendingUp className="w-6 h-6" /></div><div><h3 className="text-2xl font-bold text-white">{formatRupiah(stats.totalIncome)}</h3><p className="text-gray-400 text-sm">{t('total-income')}</p></div></div>
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6 flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white"><TrendingDown className="w-6 h-6" /></div><div><h3 className="text-2xl font-bold text-white">{formatRupiah(stats.totalExpense)}</h3><p className="text-gray-400 text-sm">{t('total-expense')}</p></div></div>
        </div>
      )}

      {activeTab === 'income' && (
        <div>
          {userCanEdit && <div className="flex justify-end mb-4"><button onClick={() => handleAdd('income')} className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />{t('add-income')}</button></div>}
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-[#2a2a2a]"><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('date')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('category')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('description')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('amount')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('status')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('action')}</th></tr></thead>
                <tbody>{pemasukan.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()).map(p => (
                  <tr key={p.id} className="border-b border-[#2a2a2a]/50"><td className="px-5 py-4 text-gray-400 text-sm">{formatDate(p.tanggal)}</td><td className="px-5 py-4 text-white text-sm">{getCategoryName(p.kategoriId)}</td><td className="px-5 py-4 text-gray-400 text-sm">{p.keterangan || '-'}</td><td className="px-5 py-4 text-white text-sm font-medium">{formatRupiah(p.jumlah)}</td><td className="px-5 py-4"><span className={`px-2 py-1 rounded-full text-xs ${p.status === 'approved' ? 'bg-green-500/10 text-green-400' : p.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{p.status}</span></td><td className="px-5 py-4"><div className="flex gap-1">{p.status === 'pending' && userCanApprove && <button onClick={() => handleApprove(p.id, 'income')} className="p-1.5 rounded-lg text-gray-500 hover:text-green-400"><Check className="w-4 h-4" /></button>}<button onClick={() => handleDelete(p.id, DB_COLLECTIONS.PEMASUKAN)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div></td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'expense' && (
        <div>
          {userCanEdit && <div className="flex justify-end mb-4"><button onClick={() => handleAdd('expense')} className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />{t('add-expense')}</button></div>}
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-[#2a2a2a]"><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('date')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('category')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('description')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('amount')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('status')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('action')}</th></tr></thead>
                <tbody>{pengeluaran.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()).map(p => (
                  <tr key={p.id} className="border-b border-[#2a2a2a]/50"><td className="px-5 py-4 text-gray-400 text-sm">{formatDate(p.tanggal)}</td><td className="px-5 py-4 text-white text-sm">{getCategoryName(p.kategoriId)}</td><td className="px-5 py-4 text-gray-400 text-sm">{p.keterangan || '-'}</td><td className="px-5 py-4 text-white text-sm font-medium">{formatRupiah(p.jumlah)}</td><td className="px-5 py-4"><span className={`px-2 py-1 rounded-full text-xs ${p.status === 'approved' ? 'bg-green-500/10 text-green-400' : p.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{p.status}</span></td><td className="px-5 py-4"><div className="flex gap-1">{p.status === 'pending' && userCanApprove && <button onClick={() => handleApprove(p.id, 'expense')} className="p-1.5 rounded-lg text-gray-500 hover:text-green-400"><Check className="w-4 h-4" /></button>}<button onClick={() => handleDelete(p.id, DB_COLLECTIONS.PENGELUARAN)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div></td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div>
          {userCanEdit && <div className="flex justify-end mb-4"><button onClick={() => handleAdd('category')} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />{t('add-category')}</button></div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {financeCategories.map(cat => (
              <div key={cat.id} className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-5 flex items-center justify-between"><div><h4 className="text-white font-medium">{cat.nama}</h4><p className="text-gray-500 text-xs mt-1">{cat.deskripsi}</p><span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs ${cat.tipe === 'pemasukan' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{cat.tipe}</span></div><button onClick={() => handleDelete(cat.id, DB_COLLECTIONS.FINANCE_CATEGORIES)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]"><h3 className="text-white font-semibold text-lg">{modalType === 'category' ? t('add-category') : modalType === 'income' ? t('add-income') : t('add-expense')}</h3><button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {modalType === 'category' ? (
                <>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('category-name')} *</label><input type="text" required value={formData.nama || ''} onChange={e => setFormData({ ...formData, nama: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('category-type')}</label><select value={formData.tipe || 'pemasukan'} onChange={e => setFormData({ ...formData, tipe: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="pemasukan">{t('income')}</option><option value="pengeluaran">{t('expense')}</option></select></div>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('description')}</label><input type="text" value={formData.deskripsi || ''} onChange={e => setFormData({ ...formData, deskripsi: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
                </>
              ) : (
                <>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('select-category')} *</label><select required value={formData.kategoriId || ''} onChange={e => setFormData({ ...formData, kategoriId: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="">-</option>{financeCategories.filter(c => c.tipe === (modalType === 'income' ? 'pemasukan' : 'pengeluaran')).map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}</select></div>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('amount')} *</label><input type="number" required value={formData.jumlah || ''} onChange={e => setFormData({ ...formData, jumlah: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('date')}</label><input type="date" value={formData.tanggal || ''} onChange={e => setFormData({ ...formData, tanggal: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1.5">{t('description')}</label><textarea value={formData.keterangan || ''} onChange={e => setFormData({ ...formData, keterangan: e.target.value })} rows={2} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500 resize-none" /></div>
                </>
              )}
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm">{t('cancel')}</button><button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium">{t('save')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
