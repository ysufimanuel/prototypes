import { useState, useMemo } from 'react';
import { Users, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ModalForm } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportToCSV } from '@/lib/utils';
import { cn, formatDate, calculateAge } from '@/lib/utils';
import type { AppData, Member, Language } from '@/types';

interface MembersProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

const genders = [
  { value: 'Laki-laki', label: { id: 'Laki-laki', en: 'Male' } },
  { value: 'Perempuan', label: { id: 'Perempuan', en: 'Female' } },
];

const statuses = [
  { value: 'aktif', label: { id: 'Aktif', en: 'Active' } },
  { value: 'tidak-aktif', label: { id: 'Nonaktif', en: 'Inactive' } },
];

export function Members({ data, updateData, lang, t, canEdit, canDelete, showToast }: MembersProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const [formData, setFormData] = useState<Partial<Member>>({
    nama: '', email: '', telepon: '', jk: 'Laki-laki', tempatLahir: '',
    tglLahir: '', alamat: '', kota: '', kodepos: '', status: 'aktif', groupId: null,
    joinDate: new Date().toISOString().split('T')[0],
  });

  const filtered = useMemo(() => {
    return data.members.filter(m => {
      const matchesSearch = !search ||
        m.nama.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase()) ||
        m.telepon.includes(search);
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      const matchesGender = genderFilter === 'all' || m.jk === genderFilter;
      return matchesSearch && matchesStatus && matchesGender;
    });
  }, [data.members, search, statusFilter, genderFilter]);

  const resetForm = () => {
    setFormData({
      nama: '', email: '', telepon: '', jk: 'Laki-laki', tempatLahir: '',
      tglLahir: '', alamat: '', kota: '', kodepos: '', status: 'aktif', groupId: null,
      joinDate: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (member: Member) => {
    setFormData({ ...member });
    setEditingId(member.id);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || !formData.email || !formData.telepon) {
      showToast(lang === 'id' ? 'Nama, email, dan telepon wajib diisi' : 'Name, email, and phone are required', 'error');
      return;
    }

    updateData(prev => {
      if (editingId) {
        const idx = prev.members.findIndex(m => m.id === editingId);
        if (idx === -1) return prev;
        const updated = [...prev.members];
        updated[idx] = { ...updated[idx], ...formData } as Member;
        return { ...prev, members: updated };
      } else {
        const newId = Math.max(...prev.members.map(m => m.id), 0) + 1;
        const newMember: Member = {
          ...formData,
          id: newId,
          avatar: null,
        } as Member;
        return {
          ...prev,
          members: [...prev.members, newMember],
          activities: [
            { id: Date.now(), type: 'member', action: lang === 'id' ? 'Anggota baru' : 'New member', detail: newMember.nama, timestamp: new Date().toISOString() },
            ...prev.activities,
          ],
        };
      }
    });

    showToast(editingId
      ? (lang === 'id' ? 'Anggota diperbarui' : 'Member updated')
      : (lang === 'id' ? 'Anggota ditambahkan' : 'Member added'),
      'success'
    );
    setIsModalOpen(false);
    resetForm();
  };

  const handleDelete = (id: number) => {
    updateData(prev => ({
      ...prev,
      members: prev.members.filter(m => m.id !== id),
    }));
    showToast(lang === 'id' ? 'Anggota dihapus' : 'Member deleted', 'success');
    setConfirmDelete(null);
  };

  const handleExport = () => {
    const exportData = filtered.map(m => ({
      Nama: m.nama,
      Email: m.email,
      Telepon: m.telepon,
      'Jenis Kelamin': m.jk,
      Status: m.status,
      Alamat: m.alamat,
      Kota: m.kota,
    }));
    exportToCSV(exportData, 'members');
    showToast(lang === 'id' ? 'Data diexport' : 'Data exported', 'success');
  };

  const inputClass = "w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50 transition-colors";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

  return (
    <div>
      <PageHeader
        title={t('members')}
        subtitle={`${filtered.length} ${lang === 'id' ? 'anggota' : 'members'}`}
        onAdd={canEdit ? openAdd : undefined}
        addLabel={t('add-member')}
        onExport={handleExport}
        canEdit={canEdit}
        lang={lang}
      />

      {/* Filters */}
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('search')}
                className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
          >
            <option value="all">{t('all')}</option>
            {statuses.map(s => (
              <option key={s.value} value={s.value}>{s.label[lang]}</option>
            ))}
          </select>
          <select
            value={genderFilter}
            onChange={e => setGenderFilter(e.target.value)}
            className="bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
          >
            <option value="all">{t('gender')}</option>
            {genders.map(g => (
              <option key={g.value} value={g.value}>{g.label[lang]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('name')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('email')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('phone')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('gender')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('status')}</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('birth-date')}</th>
                <th className="text-right text-xs font-medium text-gray-400 uppercase py-3 px-4">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">{t('no-data')}</td>
                </tr>
              ) : (
                filtered.map(m => (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{m.nama.charAt(0)}</span>
                        </div>
                        <span className="text-sm text-white font-medium">{m.nama}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">{m.email}</td>
                    <td className="py-3 px-4 text-sm text-gray-300">{m.telepon}</td>
                    <td className="py-3 px-4 text-sm text-gray-300">{m.jk}</td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        'text-xs px-2.5 py-1 rounded-full font-medium',
                        m.status === 'aktif' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                      )}>
                        {m.status === 'aktif' ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {formatDate(m.tglLahir, lang)}
                      <span className="text-gray-500 ml-1">({calculateAge(m.tglLahir)} th)</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetailMember(m)}
                          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => openEdit(m)}
                            className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setConfirmDelete(m.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <ModalForm
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title={editingId ? (lang === 'id' ? 'Edit Anggota' : 'Edit Member') : t('add-member')}
        onSubmit={handleSubmit}
        lang={lang}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t('name')} *</label>
            <input
              type="text"
              value={formData.nama || ''}
              onChange={e => setFormData(p => ({ ...p, nama: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t('email')} *</label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t('phone')} *</label>
            <input
              type="tel"
              value={formData.telepon || ''}
              onChange={e => setFormData(p => ({ ...p, telepon: e.target.value }))}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t('gender')}</label>
            <select
              value={formData.jk || 'Laki-laki'}
              onChange={e => setFormData(p => ({ ...p, jk: e.target.value as 'Laki-laki' | 'Perempuan' }))}
              className={inputClass}
            >
              {genders.map(g => (
                <option key={g.value} value={g.value}>{g.label[lang]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('birth-place')}</label>
            <input
              type="text"
              value={formData.tempatLahir || ''}
              onChange={e => setFormData(p => ({ ...p, tempatLahir: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('birth-date')}</label>
            <input
              type="date"
              value={formData.tglLahir || ''}
              onChange={e => setFormData(p => ({ ...p, tglLahir: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('address')}</label>
            <input
              type="text"
              value={formData.alamat || ''}
              onChange={e => setFormData(p => ({ ...p, alamat: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('city')}</label>
            <input
              type="text"
              value={formData.kota || ''}
              onChange={e => setFormData(p => ({ ...p, kota: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('postal-code')}</label>
            <input
              type="text"
              value={formData.kodepos || ''}
              onChange={e => setFormData(p => ({ ...p, kodepos: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t('status')}</label>
            <select
              value={formData.status || 'aktif'}
              onChange={e => setFormData(p => ({ ...p, status: e.target.value as 'aktif' | 'tidak-aktif' }))}
              className={inputClass}
            >
              {statuses.map(s => (
                <option key={s.value} value={s.value}>{s.label[lang]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('group')}</label>
            <select
              value={formData.groupId || ''}
              onChange={e => setFormData(p => ({ ...p, groupId: e.target.value ? Number(e.target.value) : null }))}
              className={inputClass}
            >
              <option value="">{t('none')}</option>
              {data.groups.map(g => (
                <option key={g.id} value={g.id}>{g.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('join-date')}</label>
            <input
              type="date"
              value={formData.joinDate || ''}
              onChange={e => setFormData(p => ({ ...p, joinDate: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
      </ModalForm>

      {/* Detail Modal */}
      {detailMember && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setDetailMember(null)}
        >
          <div
            className="bg-[#1e1e1e] border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-2xl animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">{lang === 'id' ? 'Detail Anggota' : 'Member Detail'}</h3>
              <button onClick={() => setDetailMember(null)} className="text-gray-400 hover:text-white"><Pencil className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                  <span className="text-white text-xl font-bold">{detailMember.nama.charAt(0)}</span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white">{detailMember.nama}</h4>
                  <span className={cn(
                    'text-xs px-2 py-1 rounded-full',
                    detailMember.status === 'aktif' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                  )}>
                    {detailMember.status === 'aktif' ? t('active') : t('inactive')}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t('email'), value: detailMember.email },
                  { label: t('phone'), value: detailMember.telepon },
                  { label: t('gender'), value: detailMember.jk },
                  { label: t('birth-date'), value: `${formatDate(detailMember.tglLahir, lang)} (${calculateAge(detailMember.tglLahir)} th)` },
                  { label: t('address'), value: `${detailMember.alamat}, ${detailMember.kota}` },
                  { label: t('join-date'), value: formatDate(detailMember.joinDate, lang) },
                  { label: t('group'), value: data.groups.find(g => g.id === detailMember.groupId)?.nama || '-' },
                  { label: t('family'), value: data.families.find(f => f.anggota.includes(detailMember.id))?.nama || '-' },
                ].map((item, i) => (
                  <div key={i} className="bg-[#2a2a2a] rounded-lg p-3">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="text-sm text-white mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title={t('confirm')}
        message={lang === 'id' ? 'Apakah Anda yakin ingin menghapus anggota ini?' : 'Are you sure you want to delete this member?'}
        onConfirm={() => confirmDelete !== null && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        lang={lang}
      />
    </div>
  );
}
