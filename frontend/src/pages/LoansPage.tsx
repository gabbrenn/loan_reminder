import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  inputCls,
  labelCls,
  selectCls,
  Modal,
  tableContainer,
  theadRow,
  thCls,
  tbodyDivide,
  trHover,
  tdCls,
  emptyText,
  btnPrimary,
  btnGhost,
  alertError,
  loanStatusCls,
  badgeBase,
  Spinner,
} from '../components/ui';

export const LoansPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loans, setLoans] = useState<any[]>([]);
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [myLoansOnly, setMyLoansOnly] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isOfficer = user?.role === 'LOAN_OFFICER';
  const canWrite = user?.role === 'ADMIN' || user?.role === 'LOAN_OFFICER';

  const [showModal, setShowModal] = useState(false);
  const [borrowerId, setBorrowerId] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('0.1');
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [purpose, setPurpose] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const filters: any = {};
      if (filterStatus) filters.status = filterStatus;
      if (myLoansOnly && user?.id) filters.createdById = user.id;
      const [loanList, borrowerList] = await Promise.all([
        api.loans.list(filters),
        canWrite ? api.borrowers.list() : Promise.resolve([]),
      ]);
      setLoans(loanList);
      setBorrowers(borrowerList);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [filterStatus, myLoansOnly]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('jwt_token');
      const params = filterStatus ? `?status=${filterStatus}` : '';
      const res = await fetch(`/api/v1/loans/export${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loans-${filterStatus || 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const openCreateModal = () => {
    setBorrowerId(borrowers[0]?.id || '');
    setPrincipalAmount('');
    setInterestRate('0.1');
    setLoanDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setFrequency('MONTHLY');
    setPurpose('');
    setGracePeriodDays('0');
    setFormError(null);
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await api.loans.create({
        borrowerId,
        principalAmount: parseFloat(principalAmount),
        interestRate: parseFloat(interestRate),
        loanDate: new Date(loanDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        frequency,
        purpose: purpose || undefined,
        gracePeriodDays: parseInt(gracePeriodDays || '0'),
      });
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Loan creation failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DEFAULTED">Defaulted</option>
          </select>

          {isOfficer && (
            <button
              onClick={() => setMyLoansOnly(!myLoansOnly)}
              className={`text-xs font-medium px-3 py-2 rounded-md border transition-colors ${
                myLoansOnly
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-600/15 dark:border-blue-500/30 dark:text-blue-400'
                  : 'bg-white dark:bg-[#0f1117] border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/[0.15] hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              My Loans {myLoansOnly ? '(on)' : ''}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} disabled={exporting} className={btnGhost}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>

          {canWrite && (
            <button onClick={openCreateModal} className={btnPrimary}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Issue Loan
            </button>
          )}
        </div>
      </div>

      {error && <div className={alertError}>{error}</div>}

      {/* Table */}
      <div className={tableContainer}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className={thCls}>Loan #</th>
                <th className={thCls}>Borrower</th>
                <th className={thCls}>Principal</th>
                <th className={thCls}>Rate</th>
                <th className={thCls}>Total Payable</th>
                <th className={thCls}>Balance</th>
                <th className={`${thCls} hidden lg:table-cell`}>Frequency</th>
                <th className={`${thCls} hidden xl:table-cell`}>Purpose</th>
                <th className={thCls}>Status</th>
                <th className={`${thCls} hidden lg:table-cell`}>Officer</th>
                <th className={`${thCls} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className={tbodyDivide}>
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-10">
                    <Spinner />
                  </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={11} className={emptyText}>
                    No loans found.
                  </td>
                </tr>
              ) : (
                loans.map((l) => (
                  <tr key={l.id} className={trHover}>
                    <td className={`${tdCls} font-mono text-blue-600 dark:text-blue-400 text-xs font-medium`}>
                      {l.loanNumber}
                    </td>
                    <td className={`${tdCls} text-slate-700 dark:text-slate-300`}>{l.borrower.fullName}</td>
                    <td className={`${tdCls} font-mono text-xs text-slate-700 dark:text-slate-300`}>
                      RWF {l.principalAmount.toLocaleString()}
                    </td>
                    <td className={`${tdCls} font-mono text-xs text-slate-500 dark:text-slate-400`}>
                      {(l.interestRate * 100).toFixed(0)}%
                    </td>
                    <td className={`${tdCls} font-mono text-xs text-slate-700 dark:text-slate-300`}>
                      RWF {l.totalPayable.toLocaleString()}
                    </td>
                    <td className={`${tdCls} font-mono text-xs text-slate-700 dark:text-slate-300`}>
                      RWF {l.remainingBalance.toLocaleString()}
                    </td>
                    <td className={`${tdCls} text-xs text-slate-500 dark:text-slate-400 hidden lg:table-cell`}>
                      {l.frequency}
                    </td>
                    <td className={`${tdCls} text-xs text-slate-400 dark:text-slate-500 hidden xl:table-cell max-w-[120px] truncate`}>
                      {l.purpose || <span className="italic text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className={tdCls}>
                      <span className={`${badgeBase} ${loanStatusCls[l.status] || ''}`}>{l.status}</span>
                    </td>
                    <td className={`${tdCls} text-xs text-slate-500 dark:text-slate-400 hidden lg:table-cell`}>
                      {l.createdBy?.name || <span className="italic text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className={`${tdCls} text-right`}>
                      <button onClick={() => navigate(`/loans/${l.id}`)} className={btnGhost}>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Loan Modal */}
      {showModal && (
        <Modal title="Issue New Loan" onClose={() => setShowModal(false)}>
          {formError && <div className={`${alertError} mb-4`}>{formError}</div>}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className={labelCls}>Select Borrower</label>
              <select
                value={borrowerId}
                onChange={(e) => setBorrowerId(e.target.value)}
                className={selectCls}
                required
              >
                <option value="" disabled>
                  -- Select Borrower --
                </option>
                {borrowers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.fullName} ({b.nationalId})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Principal Amount (RWF)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Interest Rate (0.1 = 10%)</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Issued Date</label>
                <input
                  type="date"
                  value={loanDate}
                  onChange={(e) => setLoanDate(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Maturity Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Repayment Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className={selectCls}
                  required
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Grace Period (Days)</label>
                <input
                  type="number"
                  min="0"
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Loan Purpose (optional)</label>
              <input
                type="text"
                placeholder="e.g. Business expansion, Agriculture"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60"
              >
                {saving ? 'Issuing...' : 'Issue Loan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
