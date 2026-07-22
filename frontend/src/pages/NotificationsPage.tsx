import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  selectCls,
  tableContainer,
  theadRow,
  thCls,
  tbodyDivide,
  trHover,
  tdCls,
  emptyText,
  alertError,
  badgeBase,
  Spinner,
} from '../components/ui';

export const NotificationsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterChannel, setFilterChannel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  async function loadLogs() {
    setLoading(true);
    try {
      setLogs(
        await api.notifications.list({
          channel: filterChannel || undefined,
          status: filterStatus || undefined,
        })
      );
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load notification log');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [filterChannel, filterStatus]);

  const reminderTypeLabel: Record<string, string> = {
    DAYS_7: '7 days',
    DAYS_3: '3 days',
    DAYS_1: '1 day',
    OVERDUE: 'Overdue',
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Channel:</span>
          <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className={selectCls}>
            <option value="">All Channels</option>
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
            <option value="">All Statuses</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-600 ml-auto">{logs.length} records</span>
      </div>

      {error && <div className={alertError}>{error}</div>}

      {/* Table */}
      <div className={tableContainer}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className={thCls}>Timestamp</th>
                <th className={thCls}>Borrower</th>
                <th className={thCls}>Loan #</th>
                <th className={thCls}>Reminder</th>
                <th className={thCls}>Channel</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Info</th>
              </tr>
            </thead>
            <tbody className={tbodyDivide}>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10">
                    <Spinner />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={emptyText}>
                    No notification records found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className={trHover}>
                    <td className={`${tdCls} font-mono text-xs text-slate-400 dark:text-slate-500`}>
                      {new Date(log.sentAt).toLocaleString()}
                    </td>
                    <td className={`${tdCls} text-slate-700 dark:text-slate-300 text-xs font-medium`}>
                      {log.repaymentSchedule?.loan?.borrower?.fullName || '—'}
                    </td>
                    <td className={`${tdCls} font-mono text-blue-600 dark:text-blue-400 text-xs`}>
                      {log.repaymentSchedule?.loan?.loanNumber || '—'}
                    </td>
                    <td className={tdCls}>
                      <span className={`${badgeBase} bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20`}>
                        {reminderTypeLabel[log.reminderType] || log.reminderType}
                      </span>
                    </td>
                    <td className={`${tdCls} text-xs text-slate-500 dark:text-slate-400 uppercase font-mono`}>
                      {log.channel}
                    </td>
                    <td className={tdCls}>
                      <span
                        className={`${badgeBase} ${
                          log.status === 'SENT'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                            : log.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className={`${tdCls} text-xs text-slate-400 dark:text-slate-500 max-w-xs truncate`}>
                      {log.errorMessage || 'Delivered successfully'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
