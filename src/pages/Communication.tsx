import { useState, useMemo } from 'react';
import { MessageSquare, Send, Trash2, Megaphone, Pin } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ModalForm } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDate, cn } from '@/lib/utils';
import type { AppData, Announcement, Language } from '@/types';

interface CommunicationProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  t: (key: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function Communication({ data, updateData, lang, t, canEdit, canDelete, showToast }: CommunicationProps) {
  const [activeTab, setActiveTab] = useState<'announcements' | 'broadcast'>('announcements');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const [formData, setFormData] = useState<Partial<Announcement>>({ judul: '', konten: '', tanggal: new Date().toISOString().split('T')[0], expiry: '', important: false, authorId: 1 });

  const sortedAnnouncements = useMemo(() => {
    return [...data.announcements].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [data.announcements]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.judul || !formData.konten) { showToast(lang === 'id' ? 'Judul dan konten wajib diisi' : 'Title and content are required', 'error'); return; }
    updateData(prev => {
      const newId = Date.now();
      return { ...prev, announcements: [...prev.announcements, { ...formData, id: newId } as Announcement] };
    });
    showToast(lang === 'id' ? 'Pengumuman dipublikasikan' : 'Announcement published', 'success');
    setIsModalOpen(false);
    setFormData({ judul: '', konten: '', tanggal: new Date().toISOString().split('T')[0], expiry: '', important: false, authorId: 1 });
  };

  const handleDelete = (id: number) => {
    updateData(prev => ({ ...prev, announcements: prev.announcements.filter(a => a.id !== id) }));
    showToast(lang === 'id' ? 'Pengumuman dihapus' : 'Announcement deleted', 'success');
    setConfirmDelete(null);
  };

  const handleBroadcast = () => {
    if (!broadcastSubject || !broadcastMessage) { showToast(lang === 'id' ? 'Subjek dan pesan wajib diisi' : 'Subject and message are required', 'error'); return; }
    showToast(lang === 'id' ? 'Broadcast terkirim' : 'Broadcast sent', 'success');
    setBroadcastSubject(''); setBroadcastMessage('');
  };

  const inputClass = "w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

  return (
    <div>
      <PageHeader title={t('communication')} lang={lang} />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-white/10 pb-1">
        {[{ key: 'announcements', label: lang === 'id' ? 'Pengumuman' : 'Announcements', icon: Megaphone }, { key: 'broadcast', label: lang === 'id' ? 'Broadcast' : 'Broadcast', icon: Send }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all', activeTab === tab.key ? 'text-orange-400 bg-orange-500/10 border-b-2 border-orange-500' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'announcements' ? (
        <>
          {canEdit && (
            <div className="mb-4">
              <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Megaphone className="w-4 h-4 inline mr-2" />{lang === 'id' ? 'Buat Pengumuman' : 'Create Announcement'}
              </button>
            </div>
          )}
          <div className="space-y-4">
            {sortedAnnouncements.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-[#1e1e1e] border border-white/10 rounded-xl">{t('no-data')}</div>
            ) : sortedAnnouncements.map(a => (
              <div key={a.id} className={cn('bg-[#1e1e1e] border rounded-xl p-5 transition-all', a.important ? 'border-red-500/30 bg-gradient-to-br from-red-500/5 to-transparent' : 'border-white/10 hover:border-orange-500/30')}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {a.important && <Pin className="w-4 h-4 text-red-400" />}
                    <h4 className="text-sm font-semibold text-white">{a.judul}</h4>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(a.tanggal, lang)}</span>
                </div>
                <p className="text-sm text-gray-300 mb-3">{a.konten}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{lang === 'id' ? 'Valid sampai' : 'Valid until'}: {formatDate(a.expiry, lang)}</span>
                  {canDelete && <button onClick={() => setConfirmDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-4">{lang === 'id' ? 'Kirim Broadcast' : 'Send Broadcast'}</h3>
          <div className="space-y-4">
            <div><label className={labelClass}>{lang === 'id' ? 'Subjek' : 'Subject'}</label><input type="text" value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>{lang === 'id' ? 'Pesan' : 'Message'}</label><textarea value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} className={cn(inputClass, 'h-32 resize-none')} /></div>
            <button onClick={handleBroadcast} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Send className="w-4 h-4 inline mr-2" />{lang === 'id' ? 'Kirim ke Semua' : 'Send to All'}
            </button>
          </div>
        </div>
      )}

      <ModalForm isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={lang === 'id' ? 'Buat Pengumuman' : 'Create Announcement'} onSubmit={handleSubmit} lang={lang}>
        <div className="space-y-4">
          <div><label className={labelClass}>{lang === 'id' ? 'Judul' : 'Title'} *</label><input type="text" value={formData.judul || ''} onChange={e => setFormData(p => ({ ...p, judul: e.target.value }))} className={inputClass} required /></div>
          <div><label className={labelClass}>{lang === 'id' ? 'Konten' : 'Content'} *</label><textarea value={formData.konten || ''} onChange={e => setFormData(p => ({ ...p, konten: e.target.value }))} className={cn(inputClass, 'h-32 resize-none')} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>{lang === 'id' ? 'Valid Sampai' : 'Valid Until'}</label><input type="date" value={formData.expiry || ''} onChange={e => setFormData(p => ({ ...p, expiry: e.target.value }))} className={inputClass} /></div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.important || false} onChange={e => setFormData(p => ({ ...p, important: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
                <span className="text-sm text-gray-300">{lang === 'id' ? 'Penting' : 'Important'}</span>
              </label>
            </div>
          </div>
        </div>
      </ModalForm>

      <ConfirmDialog isOpen={confirmDelete !== null} title={t('confirm')} message={lang === 'id' ? 'Hapus pengumuman ini?' : 'Delete this announcement?'} onConfirm={() => confirmDelete !== null && handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} lang={lang} />
    </div>
  );
}
