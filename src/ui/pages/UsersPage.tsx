/**
 * Users Page - Manajemen user dan akses sistem (Superadmin only)
 */

import { useState, useMemo, useEffect } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { canManageUsers } from '@/auth/permissions';
import { createChurchUser } from '@/auth/auth';
import { subscribeToCollection } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import type { User } from '@/types/models';
import { Shield, Search, Plus, X } from 'lucide-react';

export function UsersPage() {
  const { users, currentUser } = useStoreSelector(s => ({ users: s.users, currentUser: s.currentUser }));
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ nama: '', username: '', email: '', password: '', role: 'user' });

  const showUsersMenu = canManageUsers(currentUser);

  useEffect(() => {
    const unsub = subscribeToCollection<User>(DB_COLLECTIONS.USERS, (data) => store.setCollection('users', data));
    return unsub;
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(u => !search || u.nama?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
  }, [users, search]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    store.setLoading(true);
    const success = await createChurchUser(formData);
    if (success) {
      setShowModal(false);
      setFormData({ nama: '', username: '', email: '', password: '', role: 'user' });
    }
    store.setLoading(false);
  };

  if (!showUsersMenu) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-400">Akses Ditolak</h2>
          <p className="text-gray-600 text-sm mt-2">Hanya Super Admin yang dapat mengakses halaman ini.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6"><h1 className="text-2xl font-bold text-white flex items-center gap-3"><Shield className="w-7 h-7 text-orange-500" />{t('user-management')}</h1><p className="text-gray-400 text-sm mt-1">{t('manage-users')}</p></div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder={t('search-users')} value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" />
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />{t('add-user')}</button>
      </div>

      <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[#2a2a2a]"><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('name')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">Username</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">Email</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">{t('user-role')}</th><th className="text-left px-5 py-4 text-gray-400 text-xs font-semibold uppercase">Status</th></tr></thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className="border-b border-[#2a2a2a]/50 hover:bg-[#0a0a0a]/50">
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center text-orange-400 font-semibold text-sm border border-orange-500/20">{u.nama?.charAt(0)}</div><span className="text-white text-sm font-medium">{u.nama}</span></div></td>
                  <td className="px-5 py-4 text-gray-400 text-sm">{u.username}</td>
                  <td className="px-5 py-4 text-gray-400 text-sm">{u.email}</td>
                  <td className="px-5 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.role === 'superadmin' ? 'bg-red-500/10 text-red-400' : u.role === 'admin' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'}`}>{u.role}</span></td>
                  <td className="px-5 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.status === 'aktif' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{u.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]"><h3 className="text-white font-semibold text-lg">{t('add-user')}</h3><button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('full-name')} *</label><input type="text" required value={formData.nama} onChange={e => setFormData({ ...formData, nama: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">Username *</label><input type="text" required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">Email *</label><input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">Password *</label><input type="password" required minLength={6} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('user-role')}</label><select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="user">{t('user-view-only')}</option><option value="admin">{t('admin')}</option></select></div>
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm">{t('cancel')}</button><button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium">{t('save')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
