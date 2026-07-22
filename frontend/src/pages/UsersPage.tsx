import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
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
  btnPrimary,
  btnGhost,
  btnDanger,
  alertError,
  badgeBase,
  Spinner,
} from '../components/ui';

const ROLE_CONFIG: Record<string, { label: string; cls: string }> = {
  ADMIN: {
    label: 'Admin',
    cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  },
  LOAN_OFFICER: {
    label: 'Loan Officer',
    cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-600/15 dark:text-blue-400 dark:border-blue-500/20',
  },
  CREDIT_MANAGER: {
    label: 'Credit Manager',
    cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20',
  },
};

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'LOAN_OFFICER' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      setUsers(await api.users.list());
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finaly: {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm({ email: '', name: '', password: '', role: 'LOAN_OFFICER' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setForm({ email: u.email, name: u.name, password: '', role: u.role });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      if (editUser) {
        await api.users.update(editUser.id, { name: form.name, role: form.role });
      } else {
        await api.users.create({
          email: form.email,
          name: form.name,
          password: form.password,
          role: form.role,
        });
      }
      setShowModal(false);
      fetchUsers();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await api.users.delete(id);
      fetchUsers();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">System Users</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Manage accounts and role assignments</p>
        </div>
        <button onClick={openCreate} className={btnPrimary}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New User
        </button>
      </div>

      {error && <div className={alertError}>{error}</div>}

      {/* Table */}
      <div className={tableContainer}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={theadRow}>
                <th className={thCls}>Name</th>
                <th className={thCls}>Email</th>
                <th className={thCls}>Role</th>
                <th className={`${thCls} hidden sm:table-cell`}>Created</th>
                <th className={`${thCls} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className={tbodyDivide}>
              {users.map((u) => {
                const roleInfo = ROLE_CONFIG[u.role] || {
                  label: u.role,
                  cls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
                };
                const isSelf = u.id === user?.id;
                return (
                  <tr key={u.id} className={trHover}>
                    <td className={tdCls}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 dark:bg-blue-600/15 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-[10px] font-semibold flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-slate-800 dark:text-slate-200 text-sm font-medium">{u.name}</span>
                          {isSelf && (
                            <span className="ml-2 text-[9px] text-blue-600 dark:text-blue-400 bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 px-1.5 py-0.5 rounded uppercase tracking-wide">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={`${tdCls} text-slate-500 dark:text-slate-400 text-xs`}>{u.email}</td>
                    <td className={tdCls}>
                      <span className={`${badgeBase} ${roleInfo.cls}`}>{roleInfo.label}</span>
                    </td>
                    <td className={`${tdCls} text-slate-400 dark:text-slate-500 text-xs hidden sm:table-cell`}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className={tdCls}>
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(u)} className={btnGhost}>
                          Edit
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => handleDelete(u.id)}
                            disabled={deletingId === u.id}
                            className={btnDanger}
                          >
                            {deletingId === u.id ? '...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal title={editUser ? 'Edit User' : 'Create New User'} onClose={() => setShowModal(false)}>
          {formError && <div className={`${alertError} mb-4`}>{formError}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className={inputCls}
                placeholder="Jane Doe"
              />
            </div>
            {!editUser && (
              <>
                <div>
                  <label className={labelCls}>Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    className={inputCls}
                    placeholder="jane@example.com"
                  />
                </div>
                <div>
                  <label className={labelCls}>Temporary Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                    className={inputCls}
                    placeholder="Min 6 characters"
                  />
                </div>
              </>
            )}
            <div>
              <label className={labelCls}>Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className={selectCls}
              >
                <option value="LOAN_OFFICER">Loan Officer</option>
                <option value="CREDIT_MANAGER">Credit Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-md border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-white/[0.15] text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors disabled:opacity-60"
              >
                {submitting ? 'Saving…' : editUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
