import { Pencil, Trash2, Eye, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onView?: (row: any) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  emptyMessage?: string;
  keyExtractor?: (row: any, index: number) => string | number;
}

export function DataTable({
  columns,
  data,
  onEdit,
  onDelete,
  onView,
  canEdit = true,
  canDelete = true,
  emptyMessage = 'No data available',
  keyExtractor = (_row: any, i: number) => i,
}: DataTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4',
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
            {(onEdit || onDelete || onView) && (
              <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={keyExtractor(row, i)}
              className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
            >
              {columns.map(col => (
                <td key={col.key} className="py-3 px-4 text-sm text-gray-300">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
              {(onEdit || onDelete || onView) && (
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1">
                    {onView && (
                      <button
                        onClick={() => onView(row)}
                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {onEdit && canEdit && (
                      <button
                        onClick={() => onEdit(row)}
                        className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {onDelete && canDelete && (
                      <button
                        onClick={() => onDelete(row)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
