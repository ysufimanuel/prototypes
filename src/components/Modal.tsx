import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-10"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-[#1e1e1e] border border-white/10 rounded-xl w-full mx-4 shadow-2xl my-auto',
          'animate-in zoom-in-95 fade-in duration-200',
          sizeClasses[size]
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ModalFormProps extends ModalProps {
  onSubmit: (e: React.FormEvent) => void;
  submitText?: string;
  cancelText?: string;
  lang?: 'id' | 'en';
}

export function ModalForm({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitText,
  cancelText,
  lang = 'id',
  size = 'md',
}: ModalFormProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-10"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-[#1e1e1e] border border-white/10 rounded-xl w-full mx-4 shadow-2xl my-auto',
          'animate-in zoom-in-95 fade-in duration-200',
          sizeClasses[size]
        )}
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={onSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
            {children}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
            >
              {cancelText || (lang === 'id' ? 'Batal' : 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg transition-colors"
            >
              {submitText || (lang === 'id' ? 'Simpan' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
