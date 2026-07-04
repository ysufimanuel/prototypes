import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'yellow';
  onClick?: () => void;
}

const colorMap = {
  orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30 text-orange-400',
  green: 'from-green-500/20 to-green-600/5 border-green-500/30 text-green-400',
  blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400',
  purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-400',
  red: 'from-red-500/20 to-red-600/5 border-red-500/30 text-red-400',
  yellow: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/30 text-yellow-400',
};

const iconBgMap = {
  orange: 'bg-orange-500/10',
  green: 'bg-green-500/10',
  blue: 'bg-blue-500/10',
  purple: 'bg-purple-500/10',
  red: 'bg-red-500/10',
  yellow: 'bg-yellow-500/10',
};

export function StatCard({ icon: Icon, label, value, color = 'orange', onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-gradient-to-br border rounded-xl p-5 transition-all duration-300 group',
        'hover:-translate-y-1 hover:shadow-lg',
        onClick && 'cursor-pointer',
        colorMap[color]
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('p-2.5 rounded-lg', iconBgMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{label}</p>
      </div>
    </div>
  );
}
