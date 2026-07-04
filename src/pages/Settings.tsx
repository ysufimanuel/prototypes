import { useState } from 'react';
import { Settings as SettingsIcon, Save, Globe, Download, Upload, Trash2, Church } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { cn, formatDate } from '@/lib/utils';
import type { AppData, Language } from '@/types';

interface SettingsProps {
  data: AppData;
  updateData: (fn: (prev: AppData) => AppData) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function Settings({ data, updateData, lang, setLang, t, showToast }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'language' | 'data'>('general');
  const [profile, setProfile] = useState({ ...data.churchProfile });

  const handleSaveProfile = () => {
    updateData(prev => ({ ...prev, churchProfile: profile }));
    showToast(lang === 'id' ? 'Profil gereja disimpan' : 'Church profile saved', 'success');
  };

  const handleBackup = () => {
    const backup = JSON.stringify(data, null, 2);
    const blob = new Blob([backup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cms-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(lang === 'id' ? 'Backup berhasil' : 'Backup successful', 'success');
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const restored = JSON.parse(event.target?.result as string);
        updateData(() => restored);
        showToast(lang === 'id' ? 'Data berhasil direstore' : 'Data restored successfully', 'success');
      } catch {
        showToast(lang === 'id' ? 'File tidak valid' : 'Invalid file', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    if (confirm(lang === 'id' ? 'Yakin ingin menghapus semua data? Ini tidak dapat dibatalkan.' : 'Are you sure? This cannot be undone.')) {
      localStorage.removeItem('churchDataV6');
      window.location.reload();
    }
  };

  const inputClass = "w-full bg-[#2a2a2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

  return (
    <div>
      <PageHeader title={t('settings')} lang={lang} />

      <div className="flex gap-1 mb-6 border-b border-white/10 pb-1">
        {[{ key: 'general' as const, label: t('settings-general'), icon: Church }, { key: 'language' as const, label: t('settings-language'), icon: Globe }, { key: 'data' as const, label: t('settings-data'), icon: SettingsIcon }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all', activeTab === tab.key ? 'text-orange-400 bg-orange-500/10 border-b-2 border-orange-500' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-6 max-w-2xl">
          <h3 className="text-base font-semibold text-white mb-4">{t('church-profile')}</h3>
          <div className="space-y-4">
            <div><label className={labelClass}>{t('church-name')}</label><input type="text" value={profile.churchName || ''} onChange={e => setProfile(p => ({ ...p, churchName: e.target.value, nama: e.target.value }))} className={inputClass} /></div>
            <div><label className={labelClass}>{t('pastor-name')}</label><input type="text" value={profile.pastorName || ''} onChange={e => setProfile(p => ({ ...p, pastorName: e.target.value, pastor: e.target.value }))} className={inputClass} /></div>
            <div><label className={labelClass}>{t('church-address')}</label><input type="text" value={profile.churchAddress || ''} onChange={e => setProfile(p => ({ ...p, churchAddress: e.target.value, alamat: e.target.value }))} className={inputClass} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>{t('church-phone')}</label><input type="text" value={profile.churchPhone || ''} onChange={e => setProfile(p => ({ ...p, churchPhone: e.target.value, telepon: e.target.value }))} className={inputClass} /></div>
              <div><label className={labelClass}>{t('church-email')}</label><input type="email" value={profile.churchEmail || ''} onChange={e => setProfile(p => ({ ...p, churchEmail: e.target.value, email: e.target.value }))} className={inputClass} /></div>
            </div>
            <div><label className={labelClass}>{t('website')}</label><input type="text" value={profile.website || ''} onChange={e => setProfile(p => ({ ...p, website: e.target.value }))} className={inputClass} /></div>
            <div><label className={labelClass}>{t('denomination')}</label><input type="text" value={profile.denomination || ''} onChange={e => setProfile(p => ({ ...p, denomination: e.target.value }))} className={inputClass} /></div>
            <div><label className={labelClass}>{t('vision')}</label><textarea value={profile.vision || ''} onChange={e => setProfile(p => ({ ...p, vision: e.target.value }))} className={cn(inputClass, 'h-20 resize-none')} /></div>
            <div><label className={labelClass}>{t('mission')}</label><textarea value={profile.mission || ''} onChange={e => setProfile(p => ({ ...p, mission: e.target.value }))} className={cn(inputClass, 'h-20 resize-none')} /></div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={profile.showBirthdays} onChange={e => setProfile(p => ({ ...p, showBirthdays: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
                <span className="text-sm text-gray-300">{t('show-birthdays')}</span>
              </label>
            </div>
            <button onClick={handleSaveProfile} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Save className="w-4 h-4 inline mr-2" />{t('save-changes')}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'language' && (
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-6 max-w-md">
          <h3 className="text-base font-semibold text-white mb-4">{t('language')}</h3>
          <div className="space-y-3">
            <button onClick={() => setLang('id')} className={cn('w-full flex items-center gap-3 p-4 rounded-lg border transition-all', lang === 'id' ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/10 hover:border-white/20')}>
              <Globe className={cn('w-5 h-5', lang === 'id' ? 'text-orange-400' : 'text-gray-400')} />
              <div className="text-left"><p className={cn('text-sm font-medium', lang === 'id' ? 'text-orange-400' : 'text-white')}>{t('indonesian')}</p><p className="text-xs text-gray-400">Bahasa Indonesia</p></div>
            </button>
            <button onClick={() => setLang('en')} className={cn('w-full flex items-center gap-3 p-4 rounded-lg border transition-all', lang === 'en' ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/10 hover:border-white/20')}>
              <Globe className={cn('w-5 h-5', lang === 'en' ? 'text-orange-400' : 'text-gray-400')} />
              <div className="text-left"><p className={cn('text-sm font-medium', lang === 'en' ? 'text-orange-400' : 'text-white')}>{t('english')}</p><p className="text-xs text-gray-400">English</p></div>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'data' && (
        <div className="space-y-4 max-w-md">
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-2">{t('backup')}</h3>
            <p className="text-sm text-gray-400 mb-4">{lang === 'id' ? 'Download semua data sebagai file JSON' : 'Download all data as JSON file'}</p>
            <button onClick={handleBackup} className="px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 text-sm font-medium rounded-lg transition-colors">
              <Download className="w-4 h-4 inline mr-2" />{t('backup')}
            </button>
          </div>
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-2">{t('restore')}</h3>
            <p className="text-sm text-gray-400 mb-4">{lang === 'id' ? 'Upload file backup JSON' : 'Upload JSON backup file'}</p>
            <label className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 text-sm font-medium rounded-lg transition-colors cursor-pointer inline-block">
              <Upload className="w-4 h-4 inline mr-2" />{t('restore')}
              <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
            </label>
          </div>
          <div className="bg-[#1e1e1e] border border-red-500/30 rounded-xl p-6">
            <h3 className="text-base font-semibold text-red-400 mb-2">{t('clear-data')}</h3>
            <p className="text-sm text-gray-400 mb-4">{lang === 'id' ? 'Hapus semua data dan reset ke default. Ini tidak dapat dibatalkan!' : 'Delete all data and reset to default. This cannot be undone!'}</p>
            <button onClick={handleClearData} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 text-sm font-medium rounded-lg transition-colors">
              <Trash2 className="w-4 h-4 inline mr-2" />{t('clear-data')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
