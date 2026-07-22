import React, { useState } from 'react';
import { api } from '../api/client';
import {
  inputCls,
  labelCls,
  alertError,
  alertSuccess,
} from '../components/ui';

export const ChangePasswordPage: React.FC = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      await api.auth.changePassword({ oldPassword, newPassword });
      setSuccess('Password updated successfully. Keep it safe.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md">
      <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-md p-6">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Update Password</h3>

        {error && <div className={`${alertError} mb-4`}>{error}</div>}
        {success && <div className={`${alertSuccess} mb-4`}>{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Current Password</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="pt-1 border-t border-slate-100 dark:border-white/[0.05]" />

          <div>
            <label className={labelCls}>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className={labelCls}>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${inputCls} ${
                confirmPassword && confirmPassword !== newPassword ? 'border-red-500/40 dark:border-red-500/40' : ''
              }`}
              placeholder="••••••••"
              required
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-[10px] text-red-500 dark:text-red-400 mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-md text-sm transition-colors disabled:opacity-60 shadow-sm mt-1"
          >
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-600 mt-4 px-1">
        Use a strong password of at least 6 characters. After changing, your existing session remains active.
      </p>
    </div>
  );
};
