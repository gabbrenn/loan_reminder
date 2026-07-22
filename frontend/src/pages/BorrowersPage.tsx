import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  inputCls,
  labelCls,
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
  btnDanger,
  alertError,
  Spinner,
} from '../components/ui';

const RiskBadge = ({ score }: { score: string }) => {
  if (score === 'HIGH') {
    return (
      <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 uppercase tracking-wide">
        High risk
      </span>
    );
  }
  if (score === 'MEDIUM') {
    return (
      <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 uppercase tracking-wide">
        Medium risk
      </span>
    );
  }
  return (
    <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 uppercase tracking-wide">
      Low risk
    </span>
  );
};

export const BorrowersPage: React.FC = () => {
  const { user } = useAuth();
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [photo, setPhoto] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canWrite = user?.role === 'ADMIN' || user?.role === 'LOAN_OFFICER';

  async function loadBorrowers() {
    setLoading(true);
    try {
      setBorrowers(await api.borrowers.list(search));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load borrowers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBorrowers();
  }, [search]);

  const resetForm = () => {
    setEditingId(null);
    setFullName('');
    setNationalId('');
    setPhone('');
    setEmail('');
    setAddress('');
    setOccupation('');
    setGuarantorName('');
    setGuarantorPhone('');
    setPhoto('');
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };
  const openEdit = (b: any) => {
    setEditingId(b.id);
    setFullName(b.fullName);
    setNationalId(b.nationalId);
    setPhone(b.phone);
    setEmail(b.email);
    setAddress(b.address);
    setOccupation(b.occupation);
    setGuarantorName(b.guarantorName);
    setGuarantorPhone(b.guarantorPhone);
    setPhoto(b.photo || '');
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const payload = {
      fullName,
      nationalId,
      phone,
      email,
      address,
      occupation,
      guarantorName,
      guarantorPhone,
      photo: photo || undefined,
    };
    try {
      if (editingId) await api.borrowers.update(editingId, payload);
      else await api.borrowers.create(payload);
      setShowModal(false);
      loadBorrowers();
    } catch (err: any) {
      setFormError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this borrower? All associated loans will also be removed.')) return;
    try {
      await api.borrowers.delete(id);
      loadBorrowers();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search name, phone, national ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.08] rounded-md pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-colors"
          />
        </div>
        {canWrite && (
          <button onClick={openCreate} className={btnPrimary}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Register Borrower
          </button>
        )}
      </div>

      {error && <div className={alertError}>{error}</div>}

      {/* Table */}
      <div className={tableContainer}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className={thCls}>Borrower</th>
                <th className={thCls}>National ID</th>
                <th className={thCls}>Contact</th>
                <th className={`${thCls} hidden lg:table-cell`}>Address</th>
                <th className={`${thCls} hidden xl:table-cell`}>Occupation</th>
                <th className={`${thCls} hidden xl:table-cell`}>Guarantor</th>
                <th className={thCls}>Risk</th>
                {canWrite && <th className={`${thCls} text-right`}>Actions</th>}
              </tr>
            </thead>
            <tbody className={tbodyDivide}>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10">
                    <Spinner />
                  </td>
                </tr>
              ) : borrowers.length === 0 ? (
                <tr>
                  <td colSpan={8} className={emptyText}>
                    No borrowers found.
                  </td>
                </tr>
              ) : (
                borrowers.map((b) => (
                  <tr key={b.id} className={trHover}>
                    <td className={tdCls}>
                      <div className="flex items-center gap-3">
                        {b.photo ? (
                          <img
                            src={b.photo}
                            alt={b.fullName}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-white/[0.1] flex-shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-600/20 dark:border-blue-500/20 flex items-center justify-center text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">
                            {b.fullName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-slate-800 dark:text-slate-200">{b.fullName}</span>
                      </div>
                    </td>
                    <td className={`${tdCls} font-mono text-xs text-slate-500 dark:text-slate-400`}>
                      {b.nationalId}
                    </td>
                    <td className={tdCls}>
                      <div className="text-slate-700 dark:text-slate-300 text-xs">{b.phone}</div>
                      <div className="text-slate-400 dark:text-slate-500 text-xs truncate max-w-[160px]">
                        {b.email}
                      </div>
                    </td>
                    <td className={`${tdCls} text-slate-500 dark:text-slate-400 text-xs hidden lg:table-cell`}>
                      {b.address}
                    </td>
                    <td className={`${tdCls} text-slate-500 dark:text-slate-400 text-xs hidden xl:table-cell`}>
                      {b.occupation}
                    </td>
                    <td className={`${tdCls} hidden xl:table-cell`}>
                      <div className="text-slate-700 dark:text-slate-300 text-xs">{b.guarantorName}</div>
                      <div className="text-slate-400 dark:text-slate-500 text-xs">{b.guarantorPhone}</div>
                    </td>
                    <td className={tdCls}>
                      <RiskBadge score={b.riskScore || 'LOW'} />
                    </td>
                    {canWrite && (
                      <td className={`${tdCls} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(b)} className={btnGhost}>
                            Edit
                          </button>
                          <button onClick={() => handleDelete(b.id)} className={btnDanger}>
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <Modal title={editingId ? 'Edit Borrower' : 'Register New Borrower'} onClose={() => setShowModal(false)}>
          {formError && <div className={`${alertError} mb-4`}>{formError}</div>}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>National ID</label>
                <input
                  type="text"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  className={inputCls}
                  disabled={!!editingId}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Occupation</label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Residential Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Profile Photo URL (optional)</label>
                <input
                  type="url"
                  value={photo}
                  onChange={(e) => setPhoto(e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>
            </div>

            <div className="pt-1">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
                Guarantor Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Guarantor Name</label>
                  <input
                    type="text"
                    value={guarantorName}
                    onChange={(e) => setGuarantorName(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Guarantor Phone</label>
                  <input
                    type="text"
                    value={guarantorPhone}
                    onChange={(e) => setGuarantorPhone(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
              </div>
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
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Register Borrower'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
