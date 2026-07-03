/**
 * Toast Component - Notifikasi popup
 */

import { useEffect } from 'react';
import { useStoreSelector } from '@/core/store';
import { store } from '@/core/store';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

export function ToastContainer() {
  const toast = useStoreSelector(s => s.toast);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        store.set({ toast: null });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!toast) return null;

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
  };

  const bgColors = {
    success: 'bg-green-900/90 border-green-700',
    error: 'bg-red-900/90 border-red-700',
    warning: 'bg-yellow-900/90 border-yellow-700',
    info: 'bg-blue-900/90 border-blue-700',
  };

  return (
    <div className="fixed top-5 right-5 z-[9999] animate-in slide-in-from-top-2 fade-in duration-300">
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border shadow-2xl min-w-[300px] max-w-[400px] ${bgColors[toast.type]}`}>
        {icons[toast.type]}
        <p className="text-white text-sm font-medium">{toast.message}</p>
        <button
          onClick={() => store.set({ toast: null })}
          className="ml-auto text-gray-400 hover:text-white transition-colors"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
