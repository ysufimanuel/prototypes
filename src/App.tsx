/**
 * App Component - Root component dengan routing dan auth guard
 * Menggunakan HashRouter agar kompatibel dengan GitHub Pages
 */

import { useEffect, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initAuthListener } from '@/auth/auth';
import { useStoreSelector } from '@/core/store';
import { startRealtimeSync } from '@/data/repositories/realtime.service';
import { LoginPage } from '@/ui/pages/LoginPage';
import { Layout } from '@/ui/components/Layout';
import { DashboardPage } from '@/ui/pages/DashboardPage';
import { MembersPage } from '@/ui/pages/MembersPage';
import { FamiliesPage } from '@/ui/pages/FamiliesPage';
import { GroupsPage } from '@/ui/pages/GroupsPage';
import { EventsPage } from '@/ui/pages/EventsPage';
import { AttendancePage } from '@/ui/pages/AttendancePage';
import { DonationsPage } from '@/ui/pages/DonationsPage';
import { FinancePage } from '@/ui/pages/FinancePage';
import { VolunteersPage } from '@/ui/pages/VolunteersPage';
import { CommunicationPage } from '@/ui/pages/CommunicationPage';
import { ReportsPage } from '@/ui/pages/ReportsPage';
import { UsersPage } from '@/ui/pages/UsersPage';
import { DeathsPage } from '@/ui/pages/DeathsPage';

// =========================================================
// ERROR BOUNDARY (mencegah halaman putih saat runtime error)
// =========================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-8">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <span className="text-red-400 text-2xl">⚠</span>
            </div>
            <h2 className="text-2xl font-bold text-red-400 mb-4">Terjadi Kesalahan</h2>
            <p className="text-gray-400 mb-6 text-sm">
              {this.state.error?.message || 'Kesalahan tidak terduga'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = '#/';
              }}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-700 rounded-xl text-white font-medium hover:shadow-lg hover:shadow-orange-500/20 transition-all"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// =========================================================
// APP ROUTES
// =========================================================

function AppRoutes() {
  const isAuthenticated = useStoreSelector(s => s.isAuthenticated);

  // Initialize auth listener (session restore)
  useEffect(() => {
    const unsub = initAuthListener();
    return unsub;
  }, []);

  // Start real-time sync when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const unsub = startRealtimeSync();
      return unsub;
    }
  }, [isAuthenticated]);

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}
      >
        <Route index element={<DashboardPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="families" element={<FamiliesPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="donations" element={<DonationsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="volunteers" element={<VolunteersPage />} />
        <Route path="communication" element={<CommunicationPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="deaths" element={<DeathsPage />} />
      </Route>
    </Routes>
  );
}

// =========================================================
// ROOT APP
// =========================================================

function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
