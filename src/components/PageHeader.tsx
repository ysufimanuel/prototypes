import { Plus, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
  onExport?: () => void;
  canEdit?: boolean;
  lang?: 'id' | 'en';
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  onAdd,
  addLabel,
  onExport,
  canEdit = true,
  lang = 'id',
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {children}
          {onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-300 border border-white/20 rounded-lg hover:bg-white/5 hover:text-white transition-all"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'id' ? 'Export' : 'Export'}</span>
            </button>
          )}
          {onAdd && canEdit && (
            <button
              onClick={onAdd}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/20'
              )}
            >
              <Plus className="w-4 h-4" />
              {addLabel || (lang === 'id' ? 'Tambah' : 'Add')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
