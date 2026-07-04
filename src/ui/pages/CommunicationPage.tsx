/**
 * Communication Page - Sistem komunikasi dan broadcast
 */

import { useState, useMemo, useEffect } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { t } from '@/core/i18n';
import { formatDate } from '@/utils/formatters';
import { canEdit } from '@/auth/permissions';
import { subscribeToCollection, addDocument, deleteDocument } from '@/data/repositories/base.repository';
import { DB_COLLECTIONS } from '@/core/config';
import type { Announcement } from '@/types/models';
import { MessageSquare, Send, Save, X, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';

type CommTab = 'broadcast' | 'messages' | 'announcements';

export function CommunicationPage() {
  const { members, announcements, currentUser } = useStoreSelector(s => ({
    members: s.members, announcements: s.announcements, currentUser: s.currentUser,
  }));
  const [activeTab, setActiveTab] = useState<CommTab>('broadcast');
  const [broadcastForm, setBroadcastForm] = useState({ recipients: 'all', subject: '', message: '' });
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [announceForm, setAnnounceForm] = useState<Partial<Announcement>>({});
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: string; content: string; time: string }>>([
    { id: '1', sender: 'Budi Santoso', content: 'Halo, apakah besok ada latihan?', time: '10:00' },
    { id: '2', sender: 'Admin', content: 'Ya, besok jam 19:00 di gedung utama.', time: '10:05' },
  ]);

  const [announceIdToDelete, setAnnounceIdToDelete] = useState<string | null>(null);
  const userCanEdit = canEdit(currentUser);

  useEffect(() => {
    const unsub = subscribeToCollection<Announcement>(DB_COLLECTIONS.ANNOUNCEMENTS, (data) => store.setCollection('announcements', data));
    return unsub;
  }, []);

  const handleSendBroadcast = () => {
    if (!broadcastForm.subject || !broadcastForm.message) { store.showToast('Isi subjek dan pesan', 'warning'); return; }
    store.showToast('Broadcast terkirim!', 'success');
    setBroadcastForm({ recipients: 'all', subject: '', message: '' });
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    store.setLoading(true);
    try {
      await addDocument(DB_COLLECTIONS.ANNOUNCEMENTS, {
        ...announceForm,
        tanggal: new Date().toISOString().split('T')[0],
      });
      store.showToast(t('save-success'), 'success');
      setShowAnnounceModal(false);
      setAnnounceForm({});
    } catch { store.showToast(t('save-error'), 'error'); }
    store.setLoading(false);
  };

  const handleDeleteAnnouncement = (id: string) => {
    setAnnounceIdToDelete(id);
  };

  const confirmDeleteAnnouncement = async () => {
    if (!announceIdToDelete) return;
    store.setLoading(true);
    try { await deleteDocument(DB_COLLECTIONS.ANNOUNCEMENTS, announceIdToDelete); store.showToast(t('delete-success'), 'success'); }
    catch { store.showToast(t('delete-error'), 'error'); }
    store.setLoading(false);
    setAnnounceIdToDelete(null);
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    setChatMessages([...chatMessages, { id: Date.now().toString(), sender: 'Admin', content: chatMessage, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
    setChatMessage('');
  };

  const tabs = [
    { key: 'broadcast' as CommTab, label: t('email-broadcast') },
    { key: 'messages' as CommTab, label: t('send-message') },
    { key: 'announcements' as CommTab, label: t('announcements-tab') },
  ];

  const activeMembers = useMemo(() => members.filter(m => m.status === 'aktif'), [members]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6"><h1 className="text-2xl font-bold text-white flex items-center gap-3"><MessageSquare className="w-7 h-7 text-orange-500" />{t('communication')}</h1><p className="text-gray-400 text-sm mt-1">{t('communication-system')}</p></div>
      <div className="flex gap-1 bg-[#141414] rounded-xl p-1 mb-6 border border-[#2a2a2a]">
        {tabs.map(tab => <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-orange-500/15 text-orange-400' : 'text-gray-400 hover:text-white'}`}>{tab.label}</button>)}
      </div>

      {activeTab === 'broadcast' && (
        <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] p-6 max-w-2xl">
          <div className="space-y-4">
            <div><label className="block text-sm text-gray-400 mb-1.5">{t('recipients')}</label><select value={broadcastForm.recipients} onChange={e => setBroadcastForm({ ...broadcastForm, recipients: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500"><option value="all">{t('all-members')}</option><option value="active">{t('active-members')}</option><option value="groups">{t('by-groups')}</option><option value="custom">{t('custom')}</option></select></div>
            <div><label className="block text-sm text-gray-400 mb-1.5">{t('subject')}</label><input type="text" value={broadcastForm.subject} onChange={e => setBroadcastForm({ ...broadcastForm, subject: e.target.value })} placeholder="Subjek email..." className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
            <div><label className="block text-sm text-gray-400 mb-1.5">{t('message')}</label><textarea value={broadcastForm.message} onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })} rows={8} placeholder="Tulis pesan Anda..." className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500 resize-none" /></div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => store.showToast('Draft disimpan', 'info')} className="px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm flex items-center gap-2 hover:bg-[#0a0a0a] transition-colors"><Save className="w-4 h-4" />{t('save-draft')}</button>
              <button onClick={handleSendBroadcast} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium flex items-center gap-2 hover:shadow-lg transition-all"><Send className="w-4 h-4" />{t('send-broadcast')}</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] overflow-hidden flex h-[600px]">
          <div className="w-72 border-r border-[#2a2a2a] flex flex-col">
            <div className="p-4 border-b border-[#2a2a2a]"><h4 className="text-white font-medium">{t('contacts')}</h4></div>
            <div className="flex-1 overflow-y-auto">
              {activeMembers.map(m => (
                <button key={m.id} onClick={() => setSelectedContact(m.id)} className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#0a0a0a] transition-colors ${selectedContact === m.id ? 'bg-orange-500/10 border-l-2 border-orange-500' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center text-orange-400 text-sm font-bold border border-orange-500/20">{m.nama.charAt(0)}</div>
                  <span className="text-gray-300 text-sm">{m.nama}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-[#2a2a2a]"><p className="text-gray-400 text-sm">{selectedContact ? activeMembers.find(m => m.id === selectedContact)?.nama : t('select-contact')}</p></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'Admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${msg.sender === 'Admin' ? 'bg-orange-500 text-white rounded-br-md' : 'bg-[#2a2a2a] text-gray-300 rounded-bl-md'}`}>
                    <p>{msg.content}</p>
                    <span className="text-[10px] opacity-60 mt-1 block">{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-[#2a2a2a] flex gap-2">
              <input type="text" value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder={t('type-message')} className="flex-1 px-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" />
              <button onClick={handleSendMessage} className="px-4 py-2.5 bg-orange-500 rounded-xl text-white hover:bg-orange-600 transition-colors"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <>
          {userCanEdit && <div className="flex justify-end mb-4"><button onClick={() => { setAnnounceForm({ important: false }); setShowAnnounceModal(true); }} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />{t('create-announcement')}</button></div>}
          <div className="space-y-3">
            {announcements.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()).map(a => (
              <div key={a.id} className={`bg-[#141414] rounded-2xl border p-5 ${a.important ? 'border-orange-500/30' : 'border-[#2a2a2a]'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {a.important && <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-xs font-medium">PENTING</span>}
                    <span className="text-gray-500 text-xs">{formatDate(a.tanggal)}</span>
                  </div>
                  {userCanEdit && <button onClick={() => handleDeleteAnnouncement(a.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <h4 className="text-white font-semibold mb-1">{a.judul}</h4>
                <p className="text-gray-400 text-sm">{a.konten}</p>
                {a.expiry && <p className="text-gray-600 text-xs mt-2">Berlaku sampai: {formatDate(a.expiry)}</p>}
              </div>
            ))}
            {announcements.length === 0 && <div className="text-center py-12 text-gray-500 bg-[#141414] rounded-2xl border border-[#2a2a2a]">{t('no-data')}</div>}
          </div>
        </>
      )}

      {showAnnounceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] rounded-2xl border border-[#2a2a2a] w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]"><h3 className="text-white font-semibold text-lg">{t('create-announcement')}</h3><button onClick={() => setShowAnnounceModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSaveAnnouncement} className="p-6 space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('title')} *</label><input type="text" required value={announceForm.judul || ''} onChange={e => setAnnounceForm({ ...announceForm, judul: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('content')} *</label><textarea required value={announceForm.konten || ''} onChange={e => setAnnounceForm({ ...announceForm, konten: e.target.value })} rows={4} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500 resize-none" /></div>
              <div><label className="block text-sm text-gray-400 mb-1.5">{t('show-until')}</label><input type="date" value={announceForm.expiry || ''} onChange={e => setAnnounceForm({ ...announceForm, expiry: e.target.value })} className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500" /></div>
              <label className="flex items-center gap-2 text-gray-400 text-sm cursor-pointer"><input type="checkbox" checked={announceForm.important || false} onChange={e => setAnnounceForm({ ...announceForm, important: e.target.checked })} className="accent-orange-500" />{t('mark-important')}</label>
              <div className="flex gap-3 mt-6"><button type="button" onClick={() => setShowAnnounceModal(false)} className="flex-1 px-4 py-2.5 border border-[#2a2a2a] rounded-xl text-gray-300 text-sm">{t('cancel')}</button><button type="submit" className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white text-sm font-medium">{t('publish')}</button></div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!announceIdToDelete}
        onOpenChange={(open) => { if (!open) setAnnounceIdToDelete(null); }}
        onConfirm={confirmDeleteAnnouncement}
        title="Hapus Pengumuman"
        description="Yakin ingin menghapus pengumuman ini?"
        confirmText="Hapus"
        cancelText="Batal"
        destructive
      />
    </div>
  );
}
