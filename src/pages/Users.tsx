import { useState, useMemo } from 'react';
import { UserCog, Search, Pencil, Trash2, Shield } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ModalForm } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import type { AppData, User, Language } from '@/types';

interface UsersProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function Users({ data, updateData, lang, t, canEdit, canDelete, showToast }: UsersProps) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const [formData, setFormData] = useState<Partial<User>>({ nama: '', username: '', email: '', password: '', role: 'admin', status: 'aktif' });

  const filtered = useMemo(() => {
    return data.users.filter(u =>
      !search || u.nama.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [data.users, search]);

  const resetForm = () => { setFormData({ nama: '', username: '', email: '', password: '', role: 'admin', status: 'aktif' }); setEditingId(null); };
  const openAdd = () => { resetForm(); setIsModalOpen(true); };
  const openEdit = (u: User) => { setFormData({ ...u, password: '' }); setEditingId(u.id); setIsModalOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || !formData.username || !formData.email) { showToast(lang === 'id' ? 'Semua field wajib diisi' : 'All fields are required', 'error'); return; }

    const existing = data.users.find(u => u.username.toLowerCase() === formData.username?.toLowerCase() && u.id !== editingId);
    if (existing) { showToast(lang === 'id' ? 'Username sudah digunakan' : 'Username already exists', 'error'); return; }

    updateData(prev => {
      if (editingId) {
        const idx = prev.users.findIndex(u => u.id === editingId);
        if (idx === -1) return prev;
        const updated = [...prev.users];
        const updateData = { ...updated[idx], ...formData };
        if (!formData.password) updateData.password = updated[idx].password;
        updated[idx] = updateData as User;
        return { ...prev, users: updated };
      } else {
        if (!formData.password) { showToast(lang === 'id' ? 'Password wajib diisi' : 'Password is required', 'error'); return prev; }
        const newId = Math.max(...prev.users.map(u => u.id), 0) + 1;
        return { ...prev, users: [...prev.users, { ...formData, id: newId, avatar: null, lastLogin: null } as User] };
      }
    });
    showToast(editingId ? (lang === 'id' ? 'User diperbarui' : 'User updated') : (lang === 'id' ? 'User ditambahkan' : 'User added'), 'success');
    setIsModalOpen(false); resetForm();
  };

  const handleDelete = (id: number) => {
    if (id === 1) { showToast(lang === 'id' ? 'Super Admin tidak dapat dihapus' : 'Super Admin cannot be deleted', 'error'); setConfirmDelete(null); return; }
    updateData(prev => ({ ...prev, users: prev.users.filter(u => u.id !== id) }));
    showToast(lang === 'id' ? 'User dihapus' : 'User deleted', 'success');
    setConfirmDelete(null);
  };

  const inputClass = "w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

  return (
    <div>
      <PageHeader title={t('users')} subtitle={`${filtered.length} ${lang === 'id' ? 'pengguna' : 'users'}`} onAdd={canEdit ? openAdd : undefined} addLabel={lang === 'id' ? 'Tambah User' : 'Add User'} canEdit={canEdit} lang={lang} />
      
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="w-full bg-[#2a2a2a] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 bg-[#1e1e1e] border border-white/10 rounded-xl">{t('no-data')}</div>
        ) : filtered.map(u => (
          <div key={u.id} className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5 hover:border-orange-500/30 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{u.nama.charAt(0)}</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{u.nama}</h4>
                  <p className="text-xs text-gray-400">@{u.username}</p>
                </div>
              </div>
              <div className={cn('text-xs px-2 py-0.5 rounded-full flex items-center gap-1', u.role === 'superadmin' ? 'bg-red-500/10 text-red-400' : u.role === 'admin' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400')}>
                <Shield className="w-3 h-3" /> <span className="capitalize">{u.role}</span>
              </div>
            </div>
            <div className="space-y-1.5 mb-4">
              <p className="text-xs text-gray-400">{u.email}</p>
              <span className={cn('text-xs', u.status === 'aktif' ? 'text-green-400' : 'text-gray-400')}>{u.status === 'aktif' ? t('active') : t('inactive')}</span>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"><Pencil className="w-4 h-4" /></button>}
              {canDelete && u.id !== 1 && <button onClick={() => setConfirmDelete(u.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>}
            </div>
          </div>
        ))}
      </div>

      <ModalForm isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? (lang === 'id' ? 'Edit User' : 'Edit User') : (lang === 'id' ? 'Tambah User' : 'Add User')} onSubmit={handleSubmit} lang={lang}>
        <div className="space-y-4">
          <div><label className={labelClass}>{t('name')} *</label><input type="text" value={formData.nama || ''} onChange={e => setFormData(p => ({ ...p, nama: e.target.value }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{lang === 'id' ? 'Username' : 'Username'} *</label><input type="text" value={formData.username || ''} onChange={e => setFormData(p => ({ ...p, username: e.target.value }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{t('email')} *</label><input type="email" value={formData.email || ''} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{lang === 'id' ? 'Password' : 'Password'} {!editingId && '*'}</label><input type="password" value={formData.password || ''} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} className={inputClass} placeholder={editingId ? (lang === 'id' ? 'Kosongkan jika tidak diubah' : 'Leave blank to keep current') : ''} required={!editingId} /></div>
          <div><label className={labelClass}>{lang === 'id' ? 'Role' : 'Role'}</label>
            <select value={formData.role || 'admin'} onChange={e => setFormData(p => ({ ...p, role: e.target.value as User['role'] }))} className={inputClass}>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>
      </ModalForm>

      <ConfirmDialog isOpen={confirmDelete !== null} title={t('confirm')} message={lang === 'id' ? 'Hapus user ini?' : 'Delete this user?'} onConfirm={() => confirmDelete !== null && handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} lang={lang} />
    </div>
  );
}
