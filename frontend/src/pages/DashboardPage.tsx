import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  badgeBase, loanStatusCls, healthBadgeCls, tableContainer, theadRow, thCls,
  tbodyDivide, trHover, tdCls, emptyText, btnGhost, Spinner,
} from '../components/ui';

const PARBar = ({ label, value }: { label: string; value: number }) => {
  const clamped = Math.min(value, 100);
  const barColor = value < 5 ? 'bg-emerald-500' : value < 20 ? 'bg-amber-400' : 'bg-red-500';
  const textColor = value < 5 ? 'text-emerald-600 dark:text-emerald-400' : value < 20 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${textColor}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) => (
  <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-md p-5">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={`w-7 h-7 rounded-md flex items-center justify-center ${accent}`}>{icon}</span>
    </div>
    <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{value.toLocaleString()}</p>
  </div>
);

const healthLabel: Record<string, string> = { GREEN: 'On track', YELLOW: 'Warning', ORANGE: 'Due soon', RED: 'Overdue' };

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<any>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dashboard.getMetrics()
      .then((d) => { setMetrics(d.metrics); setLoans(d.loans); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner /></div>;
  if (error) return <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-md text-sm">{error}</div>;

  const statCards = [
    { label: 'Total Borrowers', value: metrics.totalBorrowers, accent: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    { label: 'Active Loans', value: metrics.activeLoans, accent: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: 'Due Today', value: metrics.dueToday, accent: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { label: 'Due This Week', value: metrics.dueThisWeek, accent: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
    { label: 'Overdue Loans', value: metrics.overdueLoans, accent: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
    { label: 'Reminders Today', value: metrics.notificationsSentToday, accent: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> },
  ];

  const collectionRate = metrics.collectionRate ?? 100;
  const collRateColor = collectionRate >= 90 ? '#10b981' : collectionRate >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((c, i) => <StatCard key={i} {...c} />)}
      </div>

      {/* Portfolio health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-md p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Portfolio at Risk (PAR)</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">% of outstanding portfolio with overdue installments by aging bucket</p>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] px-2.5 py-1 rounded-md">
              RWF {(metrics.totalPortfolioBalance || 0).toLocaleString()}
            </span>
          </div>
          <div className="space-y-4">
            <PARBar label="PAR 30 — 30+ days overdue" value={metrics.par30 ?? 0} />
            <PARBar label="PAR 60 — 60+ days overdue" value={metrics.par60 ?? 0} />
            <PARBar label="PAR 90 — 90+ days overdue" value={metrics.par90 ?? 0} />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-600 mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.05]">
            PAR &lt; 5% is considered healthy. PAR &gt; 20% requires immediate attention.
          </p>
        </div>

        <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-md p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">Collection Rate</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">This month's repayment efficiency</p>
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <div className="relative w-28 h-28">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100 dark:text-white/[0.06]" />
                <circle cx="50" cy="50" r="40" fill="none" stroke={collRateColor} strokeWidth="10"
                  strokeDasharray={`${collectionRate * 2.513} 251.3`} strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.8s ease' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">{collectionRate.toFixed(0)}%</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">collected</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-center text-slate-400 dark:text-slate-500">
            {collectionRate >= 90 ? 'Excellent — keep it up' : collectionRate >= 70 ? 'Good — monitor closely' : 'Below target — action needed'}
          </p>
        </div>
      </div>

      {/* Repayment Status Table */}
      <div className={tableContainer}>
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Repayment Status</h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">{loans.length} loans</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={theadRow}>
                {['Loan #', 'Borrower', 'Remaining', 'Total Payable', 'Status', 'Health', 'Action'].map(h => (
                  <th key={h} className={`${thCls} ${h === 'Action' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={tbodyDivide}>
              {loans.length === 0 ? (
                <tr><td colSpan={7} className={emptyText}>No loans in portfolio.</td></tr>
              ) : loans.map((loan) => (
                <tr key={loan.id} className={trHover}>
                  <td className={`${tdCls} font-mono text-blue-600 dark:text-blue-400 text-xs font-medium`}>{loan.loanNumber}</td>
                  <td className={`${tdCls} text-slate-700 dark:text-slate-300`}>{loan.borrowerName}</td>
                  <td className={`${tdCls} font-mono text-slate-700 dark:text-slate-300 text-xs`}>RWF {loan.remainingBalance.toLocaleString()}</td>
                  <td className={`${tdCls} font-mono text-slate-500 dark:text-slate-400 text-xs`}>RWF {loan.totalPayable.toLocaleString()}</td>
                  <td className={tdCls}>
                    <span className={`${badgeBase} ${loanStatusCls[loan.status] || 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20'}`}>{loan.status}</span>
                  </td>
                  <td className={tdCls}>
                    <span className={`${badgeBase} ${healthBadgeCls[loan.badge] || 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20'}`}>
                      {healthLabel[loan.badge] || loan.badge}
                    </span>
                  </td>
                  <td className={`${tdCls} text-right`}>
                    <button onClick={() => navigate(`/loans/${loan.id}`)} className={btnGhost}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
