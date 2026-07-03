/**
 * App Component - Root component dengan routing dan auth guard
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
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
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
