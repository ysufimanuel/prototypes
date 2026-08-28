import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Login } from '@/components/Login';
import { ToastContainer } from '@/components/Toast';
import { Dashboard } from '@/pages/Dashboard';
import { Members } from '@/pages/Members';
import { Families } from '@/pages/Families';
import { Groups } from '@/pages/Groups';
import { Events } from '@/pages/Events';
import { Attendance } from '@/pages/Attendance';
import { Donations } from '@/pages/Donations';
import { Finance } from '@/pages/Finance';
import { Volunteers } from '@/pages/Volunteers';
import { Communication } from '@/pages/Communication';
import { Reports } from '@/pages/Reports';
import { Users } from '@/pages/Users';
import { Settings } from '@/pages/Settings';
import { Deaths } from '@/pages/Deaths';

import { useAppData } from '@/hooks/useLocalStorage';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { useToast } from '@/hooks/useToast';
import type { Language } from '@/types';

function AppContent() {
  const { data, updateData } = useAppData();
  const { currentUser, login, logout, isSuperAdmin, isAdmin, isViewOnly, canEdit, canDelete, canApprove } = useAuth();
  const { lang, setLang, t, toggleLang } = useI18n();
  const { toasts, showToast, removeToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogin = useCallback((username: string, password: string) => {
    return login(data.users, username, password);
  }, [login, data.users]);

  const handleQuickAction = useCallback((action: string) => {
    switch (action) {
      case 'member': navigate('/members'); break;
      case 'event': navigate('/events'); break;
      case 'checkin': navigate('/attendance'); break;
    }
  }, [navigate]);

  // Protected route wrapper
  if (!currentUser) {
    return <Login onLogin={handleLogin} lang={lang} toggleLang={toggleLang} />;
  }

  const commonProps = {
    data,
    updateData,
    lang: lang as Language,
    t,
    showToast,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Sidebar user={currentUser} lang={lang as Language} t={t} onCollapse={setSidebarCollapsed} />
      
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[70px]' : 'lg:ml-[260px]'}`}>
        <Header
          user={currentUser}
          lang={lang as Language}
          t={t}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onToggleLang={toggleLang}
          onLogout={logout}
          onQuickAction={handleQuickAction}
        />
        
        <main className="p-6">
          <Routes>
            <Route path="/" element={<Dashboard {...commonProps} canEdit={canEdit()} />} />
            <Route path="/members" element={<Members {...commonProps} canEdit={canEdit()} canDelete={canDelete()} />} />
            <Route path="/families" element={<Families {...commonProps} canEdit={canEdit()} canDelete={canDelete()} />} />
            <Route path="/groups" element={<Groups {...commonProps} canEdit={canEdit()} canDelete={canDelete()} />} />
            <Route path="/events" element={<Events {...commonProps} canEdit={canEdit()} canDelete={canDelete()} />} />
            <Route path="/attendance" element={<Attendance {...commonProps} canEdit={canEdit()} />} />
            <Route path="/donations" element={<Donations {...commonProps} canEdit={canEdit()} canDelete={canDelete()} />} />
            <Route path="/finance" element={<Finance {...commonProps} canEdit={canEdit()} canDelete={canDelete()} canApprove={canApprove()} />} />
            <Route path="/volunteers" element={<Volunteers {...commonProps} canEdit={canEdit()} canDelete={canDelete()} />} />
            <Route path="/communication" element={<Communication {...commonProps} canEdit={canEdit()} canDelete={canDelete()} />} />
            <Route path="/reports" element={<Reports {...commonProps} />} />
            <Route path="/users" element={<Users {...commonProps} canEdit={canEdit()} canDelete={canDelete()} />} />
            <Route path="/settings" element={<Settings {...commonProps} setLang={setLang} />} />
            <Route path="/deaths" element={<Deaths {...commonProps} canEdit={canEdit()} />} />
          </Routes>
        </main>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
