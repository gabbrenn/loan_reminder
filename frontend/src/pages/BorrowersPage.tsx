import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
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

function mapRawRowToBorrower(row: any) {
  const getVal = (...keys: string[]) => {
    for (const k of keys) {
      const foundKey = Object.keys(row).find((rk) => rk.toLowerCase().trim() === k.toLowerCase().trim());
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        return String(row[foundKey]).trim();
      }
    }
    return '';
  };

  return {
    fullName: getVal('fullName', 'full name', 'name', 'borrower name'),
    nationalId: getVal('nationalId', 'national id', 'id number', 'nid', 'id'),
    phone: getVal('phone', 'phone number', 'contact phone', 'mobile'),
    email: getVal('email', 'email address', 'mail'),
    address: getVal('address', 'residence', 'location', 'city'),
    occupation: getVal('occupation', 'job', 'profession', 'work'),
    guarantorName: getVal('guarantorName', 'guarantor name', 'guarantor'),
    guarantorPhone: getVal('guarantorPhone', 'guarantor phone', 'guarantor contact'),
    photo: getVal('photo', 'photo url', 'image'),
  };
}

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

  // Import modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failureCount: number;
    errors: any[];
  } | null>(null);

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

  const handleDownloadTemplate = async () => {
    try {
      await api.borrowers.downloadTemplate();
    } catch (err: any) {
      alert(err.message || 'Failed to download template');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        const mapped = data.map((row: any, idx: number) => ({
          _rowNum: idx + 1,
          ...mapRawRowToBorrower(row),
        }));
        setParsedRows(mapped);
      } catch (err: any) {
        alert('Failed to parse spreadsheet file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setImportResult(null);

    try {
      const cleanPayload = parsedRows.map(({ _rowNum, ...rest }) => rest);
      const res = await api.borrowers.import(cleanPayload);
      setImportResult(res);
      if (res.successCount > 0) {
        loadBorrowers();
      }
    } catch (err: any) {
      alert(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo file size should be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setPhoto(String(evt.target.result));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.1] rounded-md transition-colors"
              title="Download Excel / CSV Template"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Template
            </button>
            <button
              onClick={() => {
                setParsedRows([]);
                setImportResult(null);
                setShowImportModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/20 rounded-md transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Excel
            </button>
            <button onClick={openCreate} className={btnPrimary}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Register Borrower
            </button>
          </div>
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

      {/* Modal - Create/Edit Borrower */}
      {showModal && (
        <Modal title={editingId ? 'Edit Borrower' : 'Register New Borrower'} onClose={() => setShowModal(false)}>
          {formError && <div className={`${alertError} mb-4`}>{formError}</div>}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>
                  National ID <span className="text-red-500">*</span>
                </label>
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
                <label className={labelCls}>
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>
                  Occupation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>
                  Residential Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>

              {/* Profile Photo File Upload */}
              <div className="sm:col-span-2 space-y-2">
                <label className={labelCls}>Profile Photo (optional)</label>
                <div className="flex items-center gap-4">
                  {photo ? (
                    <div className="relative group">
                      <img
                        src={photo}
                        alt="Preview"
                        className="w-14 h-14 rounded-full object-cover border-2 border-blue-500/40 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setPhoto('')}
                        className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs shadow"
                        title="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-white/[0.05] border border-dashed border-slate-300 dark:border-white/[0.15] flex items-center justify-center text-slate-400 text-xs font-medium">
                      No Photo
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileChange}
                      className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-500/10 dark:file:text-blue-400 cursor-pointer"
                    />
                    <input
                      type="url"
                      value={photo}
                      onChange={(e) => setPhoto(e.target.value)}
                      placeholder="Or paste photo URL..."
                      className={`${inputCls} text-xs py-1.5`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-1">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
                Guarantor Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    Guarantor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={guarantorName}
                    onChange={(e) => setGuarantorName(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Guarantor Phone <span className="text-red-500">*</span>
                  </label>
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

      {/* Modal - Import Borrowers Excel */}
      {showImportModal && (
        <Modal title="Import Borrowers from Excel / CSV" onClose={() => setShowImportModal(false)}>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Select Excel / CSV File</label>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-500/10 dark:file:text-blue-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Supported formats: .xlsx, .xls, .csv. You can download the template above for proper column formatting.
              </p>
            </div>

            {/* Import Summary Results */}
            {importResult && (
              <div className="p-3 rounded-md border text-xs space-y-2 bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ✓ {importResult.successCount} imported successfully
                  </span>
                  {importResult.failureCount > 0 && (
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      ✗ {importResult.failureCount} failed
                    </span>
                  )}
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="text-red-500 dark:text-red-400 text-[11px]">
                        Row {err.row} ({err.name}): {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Parsed Rows Preview Table */}
            {parsedRows.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    File Preview ({parsedRows.length} rows found)
                  </h4>
                </div>
                <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-white/[0.08] rounded-md">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-white/[0.03] sticky top-0">
                      <tr>
                        <th className="px-2.5 py-2 font-medium text-slate-600 dark:text-slate-400">#</th>
                        <th className="px-2.5 py-2 font-medium text-slate-600 dark:text-slate-400">Full Name</th>
                        <th className="px-2.5 py-2 font-medium text-slate-600 dark:text-slate-400">National ID</th>
                        <th className="px-2.5 py-2 font-medium text-slate-600 dark:text-slate-400">Phone</th>
                        <th className="px-2.5 py-2 font-medium text-slate-600 dark:text-slate-400">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {parsedRows.map((r, i) => {
                        const isValid = r.fullName && r.nationalId && r.phone && r.email;
                        return (
                          <tr key={i} className={isValid ? '' : 'bg-red-50/50 dark:bg-red-500/10'}>
                            <td className="px-2.5 py-1.5 text-slate-500 dark:text-slate-400">{r._rowNum}</td>
                            <td className="px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-200">
                              {r.fullName || <span className="text-red-500 italic">Missing</span>}
                            </td>
                            <td className="px-2.5 py-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                              {r.nationalId || <span className="text-red-500 italic">Missing</span>}
                            </td>
                            <td className="px-2.5 py-1.5 text-slate-600 dark:text-slate-400">
                              {r.phone || <span className="text-red-500 italic">Missing</span>}
                            </td>
                            <td className="px-2.5 py-1.5 text-slate-600 dark:text-slate-400">
                              {r.email || <span className="text-red-500 italic">Missing</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-white/[0.08] rounded-md transition-colors"
              >
                Close
              </button>
              {parsedRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleImportSubmit}
                  disabled={importing}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <Spinner />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <span>Import {parsedRows.length} Borrowers</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
