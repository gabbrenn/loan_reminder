/**
 * Shared design tokens as Tailwind class strings.
 * All values include both light and dark: variants.
 */

/** Card / panel surface */
export const surface = 'bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06]';

/** Input field */
export const inputCls = 'w-full bg-slate-50 dark:bg-[#161b27] border border-slate-200 dark:border-white/[0.08] rounded-md px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-colors disabled:opacity-50';

/** Form field label */
export const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5';

/** Standard select element */
export const selectCls = 'bg-slate-50 dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-700 dark:text-slate-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-colors';

/** Table container */
export const tableContainer = 'bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-md overflow-hidden';

/** Table header cell */
export const thCls = 'px-5 py-3 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide';

/** Table header row */
export const theadRow = 'border-b border-slate-100 dark:border-white/[0.05]';

/** Table body divider */
export const tbodyDivide = 'divide-y divide-slate-100 dark:divide-white/[0.04]';

/** Table row hover */
export const trHover = 'hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors';

/** Table data cell */
export const tdCls = 'px-5 py-3.5';

/** Empty state cell text */
export const emptyText = 'text-center py-10 text-slate-400 dark:text-slate-600 text-sm';

/** Primary button */
export const btnPrimary = 'flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors shadow-sm';

/** Ghost/outline button */
export const btnGhost = 'text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] px-3 py-1.5 rounded-md transition-colors';

/** Danger button */
export const btnDanger = 'text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 border border-red-200 dark:border-red-500/20 hover:border-red-300 dark:hover:border-red-500/40 px-3 py-1.5 rounded-md transition-colors';

/** Error alert */
export const alertError = 'flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm';

/** Success alert */
export const alertSuccess = 'flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-md text-sm';

/** Section heading (inside a card) */
export const sectionTitle = 'text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide';

/** Badge: loan status */
export const loanStatusCls: Record<string, string> = {
  ACTIVE: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  OVERDUE: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  DEFAULTED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
};

/** Badge: repayment health */
export const healthBadgeCls: Record<string, string> = {
  GREEN: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  YELLOW: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  ORANGE: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
  RED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
};

/** Base badge class */
export const badgeBase = 'inline-flex text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide';

/** Spinner */
export const Spinner = () => (
  <svg className="animate-spin w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

/** ErrorIcon */
export const ErrorIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

/** Modal wrapper */
import React from 'react';
export const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4">
    <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.08] rounded-md w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl dark:shadow-2xl">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);
