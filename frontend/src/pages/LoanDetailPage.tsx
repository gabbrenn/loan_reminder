import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  inputCls,
  labelCls,
  tableContainer,
  theadRow,
  thCls,
  tbodyDivide,
  trHover,
  tdCls,
  emptyText,
  alertError,
  loanStatusCls,
  badgeBase,
  sectionTitle,
  Spinner,
} from '../components/ui';

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between py-2.5 border-b border-slate-100 dark:border-white/[0.04] last:border-0">
    <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 w-36">{label}</span>
    <span className="text-xs text-slate-800 dark:text-slate-300 text-right font-medium">{value}</span>
  </div>
);

export const LoanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [loan, setLoan] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [formError, setFormError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const canWrite = user?.role === 'ADMIN' || user?.role === 'LOAN_OFFICER';
  const canSetStatus = user?.role === 'ADMIN' || user?.role === 'CREDIT_MANAGER';

  async function load() {
    if (!id) return;
    try {
      const [loanData, paymentHistory] = await Promise.all([
        api.loans.getOne(id),
        api.repayments.listForLoan(id),
      ]);
      setLoan(loanData);
      setPayments(paymentHistory);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load loan details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setFormError(null);
    setRecording(true);
    try {
      await api.repayments.create({
        loanId: id,
        amount: parseFloat(paymentAmount),
        paymentDate: new Date(paymentDate).toISOString(),
        paymentMethod,
      });
      setPaymentAmount('');
      setPaymentMethod('CASH');
      load();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record payment');
    } finally {
      setRecording(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id || !newStatus) return;
    if (!window.confirm(`Change loan status to ${newStatus}?`)) return;
    try {
      await api.loans.setStatus(id, newStatus);
      load();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner />
      </div>
    );
  }

  if (error || !loan) {
    return <div className={alertError}>{error || 'Loan not found'}</div>;
  }

  const paidAmount = loan.totalPayable - loan.remainingBalance;
  const progressPct = loan.totalPayable > 0 ? Math.min((paidAmount / loan.totalPayable) * 100, 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-md p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-xs text-slate-400 dark:text-slate-500">Loan</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 text-sm font-semibold">
                {loan.loanNumber}
              </span>
              <span className={`${badgeBase} ${loanStatusCls[loan.status] || ''}`}>{loan.status}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Issued to <span className="text-slate-800 dark:text-slate-200 font-medium">{loan.borrower.fullName}</span>
            </p>
          </div>
          {canSetStatus && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Override status:</span>
              <select
                onChange={(e) => handleStatusChange(e.target.value)}
                value=""
                className="bg-slate-50 dark:bg-[#161b27] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-md text-xs focus:outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-colors"
              >
                <option value="" disabled>
                  Select status
                </option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DEFAULTED">DEFAULTED</option>
              </select>
            </div>
          )}
        </div>

        {/* Repayment progress */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.05]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">Repayment progress</span>
            <span className="text-xs text-slate-700 dark:text-slate-400 font-medium tabular-nums">
              {progressPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-slate-500">Paid: RWF {paidAmount.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500">Remaining: RWF {loan.remainingBalance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: info cards */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-md p-5">
            <h3 className={`${sectionTitle} mb-3`}>Borrower Details</h3>
            <InfoRow label="National ID" value={<span className="font-mono">{loan.borrower.nationalId}</span>} />
            <InfoRow label="Phone" value={loan.borrower.phone} />
            <InfoRow label="Email" value={loan.borrower.email} />
            <InfoRow label="Address" value={loan.borrower.address} />
            <InfoRow label="Occupation" value={loan.borrower.occupation} />
          </div>

          <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-md p-5">
            <h3 className={`${sectionTitle} mb-3`}>Loan Summary</h3>
            <InfoRow
              label="Principal"
              value={<span className="font-mono">RWF {loan.principalAmount.toLocaleString()}</span>}
            />
            <InfoRow label="Interest Rate" value={`${(loan.interestRate * 100).toFixed(0)}% (flat)`} />
            <InfoRow
              label="Total Payable"
              value={<span className="font-mono">RWF {loan.totalPayable.toLocaleString()}</span>}
            />
            <InfoRow
              label="Remaining Balance"
              value={<span className="font-mono text-blue-600 dark:text-blue-400">RWF {loan.remainingBalance.toLocaleString()}</span>}
            />
            <InfoRow label="Issued Date" value={new Date(loan.loanDate).toLocaleDateString()} />
            <InfoRow label="Due Date" value={new Date(loan.dueDate).toLocaleDateString()} />
            <InfoRow label="Frequency" value={loan.frequency} />
            <InfoRow label="Grace Period" value={`${loan.gracePeriodDays} day${loan.gracePeriodDays !== 1 ? 's' : ''}`} />
            <InfoRow label="Purpose" value={loan.purpose || <span className="italic text-slate-400">None</span>} />
          </div>
        </div>

        {/* Right column: schedule + payments */}
        <div className="lg:col-span-2 space-y-5">
          {/* Record Payment */}
          {canWrite && loan.remainingBalance > 0 && (
            <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-md p-5">
              <h3 className={`${sectionTitle} mb-4`}>Record Repayment</h3>
              {formError && <div className={`${alertError} mb-4`}>{formError}</div>}
              <form onSubmit={handleRecordPayment} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className={labelCls}>Amount (RWF)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. 50000"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={inputCls}
                  >
                    <option value="CASH">Cash</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={recording}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors disabled:opacity-60 h-9"
                >
                  {recording ? 'Processing...' : 'Record Payment'}
                </button>
              </form>
            </div>
          )}

          {/* Repayment Schedule */}
          <div className={tableContainer}>
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
              <h3 className={sectionTitle}>Repayment Schedule</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={theadRow}>
                    <th className={thCls}>Installment</th>
                    <th className={thCls}>Due Date</th>
                    <th className={thCls}>Amount Due</th>
                    <th className={thCls}>Amount Paid</th>
                    <th className={thCls}>Status</th>
                  </tr>
                </thead>
                <tbody className={tbodyDivide}>
                  {loan.repaymentSchedules.map((s: any) => {
                    const isPaid = s.amountPaid >= s.amountDue;
                    const isPartial = s.amountPaid > 0 && s.amountPaid < s.amountDue;
                    return (
                      <tr key={s.id} className={trHover}>
                        <td className={`${tdCls} text-slate-500 dark:text-slate-400 text-xs`}>
                          # {s.installmentNumber}
                        </td>
                        <td className={`${tdCls} text-slate-700 dark:text-slate-300 text-xs`}>
                          {new Date(s.dueDate).toLocaleDateString()}
                        </td>
                        <td className={`${tdCls} font-mono text-xs text-slate-700 dark:text-slate-300`}>
                          RWF {s.amountDue.toLocaleString()}
                        </td>
                        <td className={`${tdCls} font-mono text-xs text-slate-700 dark:text-slate-300`}>
                          RWF {s.amountPaid.toLocaleString()}
                        </td>
                        <td className={tdCls}>
                          <span
                            className={`${badgeBase} ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                : isPartial
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20'
                            }`}
                          >
                            {isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History */}
          <div className={tableContainer}>
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
              <h3 className={sectionTitle}>Payment History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={theadRow}>
                    <th className={thCls}>Date</th>
                    <th className={thCls}>Method</th>
                    <th className={thCls}>Amount</th>
                  </tr>
                </thead>
                <tbody className={tbodyDivide}>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className={emptyText}>
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className={trHover}>
                        <td className={`${tdCls} text-slate-700 dark:text-slate-300 text-xs`}>
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </td>
                        <td className={tdCls}>
                          <span className={`${badgeBase} bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20`}>
                            {p.paymentMethod.replace('_', ' ')}
                          </span>
                        </td>
                        <td className={`${tdCls} font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium`}>
                          RWF {p.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
