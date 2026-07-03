/**
 * Members Page - Kelola data jemaat gereja
 */

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { formatDate, calculateAge } from '@/utils/formatters';
import { canEdit, canDelete, canViewSensitive } from '@/auth/permissions';
import {
  addDocument,
  updateDocument,
  deleteDocument,
  subscribeToCollection,
} from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import { exportCSV, exportXLS, exportTXT, exportPDF, exportDOCX } from '@/utils/exporters';
import { validateMemberForm } from '@/utils/validators';
import type { Member } from '@/types/models';
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  Download,
  X,
  ChevronDown,
  Eye,
} from 'lucide-react';

export function MembersPage() {
  const [searchParams] = useSearchParams();
  const { members, groups, currentUser } = useStoreSelector(s => ({
    members: s.members,
    groups: s.groups,
    currentUser: s.currentUser,
  }));

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [showAddModal, setShowAddModal] = useState(searchParams.get('action') === 'add');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Partial<Member>>({});

  const userCanEdit = canEdit(currentUser);
  const userCanDelete = canDelete(currentUser);
  const userCanViewSensitive = canViewSensitive(currentUser);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsub = subscribeToCollection<Member>(DB_COLLECTIONS.MEMBERS, (data) => {
      store.setCollection('members', data);
    });
    return unsub;
  }, []);

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchSearch = !search ||
        m.nama?.toLowerCase().includes(search.toLowerCase()) ||
        m.email?.toLowerCase().includes(search.toLowerCase()) ||
        m.telepon?.includes(search);
      const matchStatus = !filterStatus || m.status === filterStatus;
      const matchGender = !filterGender || m.jk === filterGender;
      return matchSearch && matchStatus && matchGender;
    });
  }, [members, search, filterStatus, filterGender]);

  const getGroupName = (groupId: string | null | undefined) => {
    if (!groupId) return '-';
    const group = groups.find(g => g.id === groupId);
    return group?.nama || '-';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const validation = validateMemberForm(formData);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    store.setLoading(true);

    try {
      if (showEditModal && selectedMember) {
        await updateDocument(DB_COLLECTIONS.MEMBERS, selectedMember.id, formData);
        store.showToast(t('save-success'), 'success');
      } else {
        await addDocument<Member>(DB_COLLECTIONS.MEMBERS, formData as Member);
        store.showToast(t('save-success'), 'success');
      }
      setShowAddModal(false);
      setShowEditModal(false);
      setFormData({});
    } catch {
      store.showToast(t('save-error'), 'error');
    }

    store.setLoading(false);
  };

  const handleDelete = async (member: Member) => {
    if (!window.confirm(t('confirm-delete'))) return;
    store.setLoading(true);
    try {
      await deleteDocument(DB_COLLECTIONS.MEMBERS, member.id);
      store.showToast(t('delete-success'), 'success');
    } catch {
      store.showToast(t('delete-error'), 'error');
    }
    store.setLoading(false);
  };

  const openEdit = (member: Member) => {
    setSelectedMember(member);
    setFormData({ ...member });
    setFormErrors({});
    setShowEditModal(true);
  };

  const openDetail = (member: Member) => {
    setSelectedMember(member);
    setShowDetailModal(true);
  };

  const openAdd = () => {
    setSelectedMember(null);
    setFormData({ status: 'aktif' });
    setFormErrors({});
    setShowAddModal(true);
  };

  const handleExport = (format: string) => {
    const data = filteredMembers.map(m => ({
      Nama: m.nama,
      Email: m.email || '-',
      Telepon: m.telepon || '-',
      'Jenis Kelamin': m.jk || '-',
      'Tempat Lahir': m.tempatLahir || '-',
      'Tanggal Lahir': m.tglLahir || '-',
      Alamat: m.alamat || '-',
      Kota: m.kota || '-',
      Status: m.status,
      Grup: getGroupName(m.groupId),
    }));

    switch (format) {
      case 'csv': exportCSV(data, 'members'); break;
      case 'xls': exportXLS(data, 'members'); break;
      case 'pdf': exportPDF(data, t('members-report')); break;
      case 'docx': exportDOCX(data, t('members-report')); break;
      case 'txt': exportTXT(data, 'members'); break;
    }
    setShowExportMenu(false);
  };

  const memberForm = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">{t('full-name')} *</label>
        <input
          type="text"
          value={formData.nama || ''}
          onChange={e => setFormData({ ...formData, nama: e.target.value })}
          className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          required
        />
        {formErrors.nama && <p className="text-red-400 text-xs mt-1">{formErrors.nama}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">{t('email')}</label>
          <input
            type="email"
            value={formData.email || ''}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          />
          {formErrors.email && <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">{t('phone')}</label>
          <input
            type="tel"
            value={formData.telepon || ''}
            onChange={e => setFormData({ ...formData, telepon: e.target.value })}
            className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">{t('gender')}</label>
          <select
            value={formData.jk || ''}
            onChange={e => setFormData({ ...formData, jk: e.target.value as any })}
            className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          >
            <option value="">-</option>
            <option value="Laki-laki">{t('male')}</option>
            <option value="Perempuan">{t('female')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">{t('status')}</label>
          <select
            value={formData.status || 'aktif'}
            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
            className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          >
            <option value="aktif">{t('active')}</option>
            <option value="tidak-aktif">{t('inactive')}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">{t('birth-place')}</label>
          <input
            type="text"
            value={formData.tempatLahir || ''}
            onChange={e => setFormData({ ...formData, tempatLahir: e.target.value })}
            className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">{t('birth-date')}</label>
          <input
            type="date"
            value={formData.tglLahir || ''}
            onChange={e => setFormData({ ...formData, tglLahir: e.target.value })}
            className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">{t('group')}</label>
        <select
          value={formData.groupId || ''}
          onChange={e => setFormData({ ...formData, groupId: e.target.value || null })}
          className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
        >
          <option value="">-</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.nama}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">{t('full-address')}</label>
        <textarea
          value={formData.alamat || ''}
          onChange={e => setFormData({ ...formData, alamat: e.target.value })}
          rows={2}
          className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
        />
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Users className="w-7 h-7 text-orange-500" />
          {t('members')}
        </h1>
        <p className="text-gray-400 text-sm mt-1">{t('manage-members')}</p>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder={t('search-members')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          >
            <option value="">{t('all-status')}</option>
            <option value="aktif">{t('active')}</option>
            <option value="tidak-aktif">{t('inactive')}</option>
          </select>

          <select
            value={filterGender}
            onChange={e => setFilterGender(e.target.value)}
            className="px-3 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"
          >
            <option value="">{t('all-gender')}</option>
            <option value="Laki-laki">{t('male')}</option>
            <option value="Perempuan">{t('female')}</option>
          </select>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-gray-300 text-sm hover:text-orange-400 hover:border-orange-500/50 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {t('export')}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showExportMenu && (
              <div className="absolute top-full right-0 mt-1 w-40 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-xl z-50 overflow-hidden">
                {['csv', 'xls', 'pdf', 'docx', 'txt'].map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    className="w-full px-4 py-2.5 text-left text-gray-300 text-sm hover:bg-orange-500/10 hover:text-orange-400 transition-colors capitalize"
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          {userCanEdit && (
            <button
              onClick={openAdd}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium hover:shadow-lg hover:shadow-orange-500/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('add-member')}
            </button>
          )}
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">{t('photo')}</th>
                <th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">{t('name')}</th>
                {userCanViewSensitive && (
                  <>
                    <th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">{t('email')}</th>
                    <th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">{t('phone')}</th>
                  </>
                )}
                <th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">{t('gender')}</th>
                <th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">{t('status')}</th>
                <th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">{t('group')}</th>
                <th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={userCanViewSensitive ? 8 : 6} className="text-center py-12 text-gray-500">
                    {t('no-data')}
                  </td>
                </tr>
              ) : (
                filteredMembers.map(member => (
                  <tr key={member.id} className="border-b border-[#2a2a2a]/50 hover:bg-[#0a0a0a]/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center text-orange-400 font-semibold text-sm border border-orange-500/20">
                        {member.nama?.charAt(0).toUpperCase()}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-white text-sm font-medium">{member.nama}</td>
                    {userCanViewSensitive && (
                      <>
                        <td className="px-5 py-4 text-gray-400 text-sm">{member.email || '-'}</td>
                        <td className="px-5 py-4 text-gray-400 text-sm">{member.telepon || '-'}</td>
                      </>
                    )}
                    <td className="px-5 py-4 text-gray-400 text-sm">{member.jk || '-'}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        member.status === 'aktif'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {member.status === 'aktif' ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-sm">{getGroupName(member.groupId)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => openDetail(member)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title={t('view')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {userCanEdit && (
                          <button
                            onClick={() => openEdit(member)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
                            title={t('edit')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {userCanDelete && (
                          <button
                            onClick={() => handleDelete(member)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title={t('delete')}
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
        <div className="px-5 py-3 border-t border-[#2a2a2a] text-gray-500 text-xs">
          {t('showing')} {filteredMembers.length} {t('of')} {members.length} {t('entries')}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
              <h3 className="text-white font-semibold text-lg">
                {showEditModal ? t('edit') : t('add-member')}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6">
              {memberForm}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="flex-1 px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm hover:bg-[#0a0a0a] transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium hover:shadow-lg transition-all"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
              <h3 className="text-white font-semibold text-lg">{t('details')}</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center text-orange-400 font-bold text-2xl border border-orange-500/20">
                  {selectedMember.nama?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-white font-semibold text-lg">{selectedMember.nama}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedMember.status === 'aktif'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {selectedMember.status === 'aktif' ? t('active') : t('inactive')}
                  </span>
                </div>
              </div>

              <DetailRow label={t('email')} value={selectedMember.email} />
              <DetailRow label={t('phone')} value={selectedMember.telepon} />
              <DetailRow label={t('gender')} value={selectedMember.jk} />
              <DetailRow label={t('birth-place')} value={selectedMember.tempatLahir} />
              <DetailRow label={t('birth-date')} value={formatDate(selectedMember.tglLahir)} />
              <DetailRow label={t('age')} value={selectedMember.tglLahir ? `${calculateAge(selectedMember.tglLahir)} tahun` : '-'} />
              <DetailRow label={t('address')} value={selectedMember.alamat} />
              <DetailRow label={t('city')} value={selectedMember.kota} />
              <DetailRow label={t('group')} value={getGroupName(selectedMember.groupId)} />
              <DetailRow label={t('join-date')} value={formatDate(selectedMember.joinDate)} />
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a]">
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm hover:bg-[#0a0a0a] transition-colors"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-2 border-b border-[#2a2a2a]/50">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-white text-sm">{value || '-'}</span>
    </div>
  );
}
