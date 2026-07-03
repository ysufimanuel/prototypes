/**
 * Dashboard Page - Halaman utama dengan statistik, grafik, dan ringkasan
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreSelector } from '@/core/store';
import { t } from '@/core/i18n';
import { formatRupiah, formatDate } from '@/utils/formatters';
import {
  Users,
  ClipboardCheck,
  HeartHandshake,
  Calendar,
  Group,
  HandHelping,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export function DashboardPage() {
  const navigate = useNavigate();
  const { currentUser, members, events, donations, groups, volunteers, attendance } =
    useStoreSelector(s => ({
      currentUser: s.currentUser,
      members: s.members,
      events: s.events,
      donations: s.donations,
      groups: s.groups,
      volunteers: s.volunteers,
      attendance: s.attendance,
      churchName: s.churchName,
    }));

  const [attendancePeriod, setAttendancePeriod] = useState('week');

  // Stats
  const stats = useMemo(() => {
    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.status === 'aktif').length;
    const totalDonations = donations.reduce((sum, d) => sum + (d.jumlah || 0), 0);
    const activeEvents = events.filter(e => e.status === 'upcoming' || e.status === 'ongoing').length;
    const totalGroups = groups.length;
    const activeVolunteers = volunteers.filter(v => v.status === 'aktif').length;

    // Weekly attendance
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklyAttendance = attendance.filter(a => new Date(a.tanggal) >= weekAgo).length;

    return {
      totalMembers,
      activeMembers,
      totalDonations,
      activeEvents,
      totalGroups,
      activeVolunteers,
      weeklyAttendance,
    };
  }, [members, donations, events, groups, volunteers, attendance]);

  // Attendance chart data
  const attendanceChartData = useMemo(() => {
    const labels: string[] = [];
    const data: number[] = [];

    if (attendancePeriod === 'week') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        labels.push(d.toLocaleDateString('id-ID', { weekday: 'short' }));
        data.push(attendance.filter(a => a.tanggal === dateStr).length);
      }
    } else if (attendancePeriod === 'month') {
      for (let i = 29; i >= 0; i -= 3) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.getDate().toString());
        const start = new Date(d);
        start.setDate(start.getDate() - 2);
        data.push(
          attendance.filter(a => {
            const ad = new Date(a.tanggal);
            return ad >= start && ad <= d;
          }).length
        );
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        labels.push(d.toLocaleDateString('id-ID', { month: 'short' }));
        const month = d.getMonth();
        const year = d.getFullYear();
        data.push(
          attendance.filter(a => {
            const ad = new Date(a.tanggal);
            return ad.getMonth() === month && ad.getFullYear() === year;
          }).length
        );
      }
    }

    return {
      labels,
      datasets: [
        {
          label: t('total-attendance'),
          data,
          borderColor: '#ff6b00',
          backgroundColor: 'rgba(255, 107, 0, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ff6b00',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
        },
      ],
    };
  }, [attendance, attendancePeriod]);

  // Member distribution chart
  const memberDistData = useMemo(() => {
    const active = members.filter(m => m.status === 'aktif').length;
    const inactive = members.filter(m => m.status === 'tidak-aktif').length;
    const male = members.filter(m => m.jk === 'Laki-laki').length;
    const female = members.filter(m => m.jk === 'Perempuan').length;

    return {
      status: {
        labels: [t('active'), t('inactive')],
        datasets: [
          {
            data: [active, inactive],
            backgroundColor: ['#4caf50', '#f44336'],
            borderWidth: 0,
          },
        ],
      },
      gender: {
        labels: [t('male'), t('female')],
        datasets: [
          {
            data: [male, female],
            backgroundColor: ['#2196f3', '#e91e63'],
            borderWidth: 0,
          },
        ],
      },
    };
  }, [members]);

  // Upcoming events
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => new Date(e.start) >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 5);
  }, [events]);

  // Recent donations
  const recentDonations = useMemo(() => {
    return [...donations]
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
      .slice(0, 5);
  }, [donations]);

  // Recent activities
  const activities = useMemo(() => {
    const acts: { type: string; action: string; detail: string; time: string }[] = [];

    members.slice(-3).forEach(m => {
      acts.push({
        type: 'member',
        action: 'Member baru',
        detail: m.nama,
        time: m.createdAt || '',
      });
    });

    donations.slice(-2).forEach(d => {
      acts.push({
        type: 'donation',
        action: 'Donasi diterima',
        detail: formatRupiah(d.jumlah),
        time: d.tanggal,
      });
    });

    events.slice(-2).forEach(e => {
      acts.push({
        type: 'event',
        action: 'Event dibuat',
        detail: e.nama,
        time: e.start,
      });
    });

    return acts.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);
  }, [members, donations, events]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#666', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#666', font: { size: 11 } },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#999', font: { size: 11 }, padding: 15 },
      },
    },
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          {t('dashboard')}
        </h1>
        <p className="text-gray-400 mt-2">
          {t('welcome-back')}, <span className="text-orange-400 font-medium">{currentUser?.nama || 'Admin'}</span>!
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        <StatCard
          icon={Users}
          iconBg="bg-gradient-to-br from-orange-500 to-orange-700"
          value={stats.totalMembers.toString()}
          label={t('total-members')}
          change="+12%"
          changeType="positive"
        />
        <StatCard
          icon={ClipboardCheck}
          iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
          value={stats.weeklyAttendance.toString()}
          label={t('attendance-this-week')}
          change="+5%"
          changeType="positive"
        />
        <StatCard
          icon={HeartHandshake}
          iconBg="bg-gradient-to-br from-green-500 to-green-700"
          value={formatRupiah(stats.totalDonations)}
          label={t('donations-this-month')}
          change="+8%"
          changeType="positive"
        />
        <StatCard
          icon={Calendar}
          iconBg="bg-gradient-to-br from-purple-500 to-purple-700"
          value={stats.activeEvents.toString()}
          label={t('active-events')}
          change="0%"
          changeType="neutral"
        />
        <StatCard
          icon={Group}
          iconBg="bg-gradient-to-br from-red-500 to-red-700"
          value={stats.totalGroups.toString()}
          label={t('total-groups')}
          change="+2"
          changeType="positive"
        />
        <StatCard
          icon={HandHelping}
          iconBg="bg-gradient-to-br from-yellow-500 to-yellow-700"
          value={stats.activeVolunteers.toString()}
          label={t('active-volunteers')}
          change="+3"
          changeType="positive"
        />
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Activity */}
        <DashboardCard
          title={t('recent-activity')}
          icon={<svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          action={{ label: t('view-all'), onClick: () => navigate('/reports') }}
        >
          <div className="space-y-1 max-h-[350px] overflow-y-auto">
            {activities.map((act, i) => (
              <div key={i} className="flex items-start gap-3.5 p-3.5 rounded-xl hover:bg-[#0a0a0a] transition-colors">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 flex-shrink-0">
                  <ActivityIcon type={act.type} />
                </div>
                <div>
                  <p className="text-white text-sm">{act.action}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{act.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Upcoming Events */}
        <DashboardCard
          title={t('upcoming-events')}
          icon={<Calendar className="w-5 h-5 text-orange-500" />}
          action={{ label: t('view-all'), onClick: () => navigate('/events') }}
        >
          <div className="space-y-1 max-h-[350px] overflow-y-auto">
            {upcomingEvents.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">{t('no-data')}</p>
            ) : (
              upcomingEvents.map(evt => (
                <div key={evt.id} className="flex items-center gap-3.5 p-3.5 rounded-xl hover:bg-[#0a0a0a] transition-colors">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex flex-col items-center justify-center flex-shrink-0 border border-orange-500/20">
                    <span className="text-orange-400 text-xs font-medium">
                      {new Date(evt.start).toLocaleDateString('id-ID', { month: 'short' })}
                    </span>
                    <span className="text-white text-lg font-bold">
                      {new Date(evt.start).getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{evt.nama}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{evt.lokasi || '-'}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                </div>
              ))
            )}
          </div>
        </DashboardCard>

        {/* Attendance Chart */}
        <DashboardCard
          title={t('attendance-stats')}
          icon={<svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>}
          className="lg:col-span-2"
        >
          <div className="flex justify-end mb-4">
            <select
              value={attendancePeriod}
              onChange={e => setAttendancePeriod(e.target.value)}
              className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="week">{t('this-week')}</option>
              <option value="month">{t('this-month')}</option>
              <option value="year">{t('this-year')}</option>
            </select>
          </div>
          <div className="h-[300px]">
            <Line data={attendanceChartData} options={chartOptions} />
          </div>
        </DashboardCard>

        {/* Member Distribution */}
        <DashboardCard
          title={t('member-distribution')}
          icon={<svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
        >
          <div className="h-[250px]">
            <Doughnut data={memberDistData.status} options={doughnutOptions} />
          </div>
        </DashboardCard>

        {/* Recent Donations */}
        <DashboardCard
          title={t('recent-donations')}
          icon={<svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
          action={{ label: t('view-all'), onClick: () => navigate('/donations') }}
        >
          <div className="space-y-1 max-h-[350px] overflow-y-auto">
            {recentDonations.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">{t('no-data')}</p>
            ) : (
              recentDonations.map(don => (
                <div key={don.id} className="flex items-center justify-between p-3.5 rounded-xl hover:bg-[#0a0a0a] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                      <HeartHandshake className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{formatRupiah(don.jumlah)}</p>
                      <p className="text-gray-500 text-xs">{don.tipe}</p>
                    </div>
                  </div>
                  <span className="text-gray-600 text-xs">{formatDate(don.tanggal)}</span>
                </div>
              ))
            )}
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}

// =========================================================
// SUB-COMPONENTS
// =========================================================

function StatCard({
  icon: Icon,
  iconBg,
  value,
  label,
  change,
  changeType,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  value: string;
  label: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
}) {
  const changeIcons = {
    positive: <TrendingUp className="w-3 h-3" />,
    negative: <TrendingDown className="w-3 h-3" />,
    neutral: <Minus className="w-3 h-3" />,
  };

  const changeColors = {
    positive: 'text-green-400',
    negative: 'text-red-400',
    neutral: 'text-gray-500',
  };

  return (
    <div className="bg-[#141414] rounded-2xl p-6 border border-[#2a2a2a] flex items-center gap-5 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 hover:border-orange-500/20 transition-all duration-300">
      <div className={`w-[60px] h-[60px] rounded-2xl flex items-center justify-center text-white flex-shrink-0 ${iconBg}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-white">{value}</h3>
        <p className="text-gray-400 text-sm mt-0.5">{label}</p>
        <span className={`text-xs font-medium flex items-center gap-1 mt-1.5 ${changeColors[changeType]}`}>
          {changeIcons[changeType]} {change}
        </span>
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  icon,
  children,
  action,
  className = '',
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={`bg-[#141414] rounded-2xl border border-[#2a2a2a] overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2.5">
          {icon}
          {title}
        </h3>
        {action && (
          <button
            onClick={action.onClick}
            className="text-orange-400 text-xs hover:underline transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case 'member':
      return <Users className="w-4 h-4" />;
    case 'donation':
      return <HeartHandshake className="w-4 h-4" />;
    case 'event':
      return <Calendar className="w-4 h-4" />;
    default:
      return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
  }
}
