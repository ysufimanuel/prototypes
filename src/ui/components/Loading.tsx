/**
 * Loading Component - Overlay spinner saat loading
 */

import { useStoreSelector } from '@/core/store';
import { Loader2 } from 'lucide-react';

export function LoadingOverlay() {
  const loading = useStoreSelector(s => s.loading);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
        <p className="text-white text-lg font-medium">Memuat...</p>
      </div>
    </div>
  );
}
