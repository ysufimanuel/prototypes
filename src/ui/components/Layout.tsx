/**
 * Layout Component - Main app layout dengan sidebar, header, dan content area
 */

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from './Toast';
import { LoadingOverlay } from './Loading';

export function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="lg:ml-[280px] min-h-screen flex flex-col">
        {/* Top Header */}
        <Header />

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Global UI */}
      <ToastContainer />
      <LoadingOverlay />
    </div>
  );
}
