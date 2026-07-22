import { useEffect, useState } from 'react';
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

const ACTION_CONFIG: Record<string, { label: string; cls: string }> = {
  CREATE: {
    label: 'Create',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  },
  UPDATE: {
    label: 'Update',
    cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  },
  DELETE: {
    label: 'Delete',
    cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  },
  STATUS_CHANGE: {
    label: 'Status Change',
    cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  },
  PAYMENT: {
    label: 'Payment',
    cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20',
  },
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ entity: '', action: '' });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.audit.list(filters);
      setLogs(data.logs);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Entity:</span>
            <select
              value={filters.entity}
              onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
              className={selectCls}
            >
              <option value="">All Entities</option>
              <option value="BORROWER">Borrower</option>
              <option value="LOAN">Loan</option>
              <option value="LOAN_REPAYMENT">Repayment</option>
              <option value="USER">User</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Action:</span>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className={selectCls}
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="STATUS_CHANGE">Status Change</option>
              <option value="PAYMENT">Payment</option>
            </select>
          </div>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-600">{logs.length} records</span>
      </div>

      {error && <div className={alertError}>{error}</div>}

      {/* Table */}
      <div className={tableContainer}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={theadRow}>
                  <th className={thCls}>Timestamp</th>
                  <th className={thCls}>Actor</th>
                  <th className={thCls}>Action</th>
                  <th className={thCls}>Entity</th>
                  <th className={thCls}>Entity ID</th>
                </tr>
              </thead>
              <tbody className={tbodyDivide}>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={emptyText}>
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const actionInfo = ACTION_CONFIG[log.action] || {
                      label: log.action,
                      cls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
                    };
                    return (
                      <tr key={log.id} className={trHover}>
                        <td className={`${tdCls} font-mono text-xs text-slate-400 dark:text-slate-500`}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className={tdCls}>
                          <div className="text-slate-800 dark:text-slate-200 text-xs font-medium">{log.user?.name}</div>
                          <div className="text-slate-400 dark:text-slate-500 text-[10px] font-mono uppercase">
                            {log.user?.role?.replace('_', ' ')}
                          </div>
                        </td>
                        <td className={tdCls}>
                          <span className={`${badgeBase} ${actionInfo.cls}`}>{actionInfo.label}</span>
                        </td>
                        <td className={`${tdCls} text-slate-700 dark:text-slate-300 text-xs`}>{log.entity}</td>
                        <td className={`${tdCls} font-mono text-[10px] text-slate-400 dark:text-slate-600 select-all break-all max-w-[140px] truncate`}>
                          {log.entityId}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
