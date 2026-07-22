import { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  inputCls,
  labelCls,
  alertError,
  alertSuccess,
} from '../components/ui';

const Toggle = ({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) => (
  <button
    type="button"
    id={id}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
      checked ? 'bg-blue-600' : 'bg-slate-200 dark:bg-white/10'
    }`}
    role="switch"
    aria-checked={checked}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
        checked ? 'translate-x-4' : 'translate-x-0'
      }`}
    />
  </button>
);

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.settings.get();
      setSettings(data.settings);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const updated = await api.settings.update({
        reminderDaysBefore1: parseInt(settings.reminderDaysBefore1),
        reminderDaysBefore2: parseInt(settings.reminderDaysBefore2),
        reminderDaysBefore3: parseInt(settings.reminderDaysBefore3),
        smsEnabled: settings.smsEnabled,
        emailEnabled: settings.emailEnabled,
      });
      setSettings(updated.settings);
      setSuccess('Settings saved successfully.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: any) {
      setError(e.message || 'Failed to save settings');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <svg className="animate-spin w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      {error && <div className={alertError}>{error}</div>}
      {success && <div className={alertSuccess}>{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Reminder Windows */}
        <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-md p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">Reminder Windows</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
            Number of days before due date to trigger each alert
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>First Alert</label>
              <input
                type="number"
                min={1}
                required
                value={settings.reminderDaysBefore1}
                onChange={(e) => setSettings({ ...settings, reminderDaysBefore1: e.target.value })}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">days before</p>
            </div>
            <div>
              <label className={labelCls}>Second Alert</label>
              <input
                type="number"
                min={1}
                required
                value={settings.reminderDaysBefore2}
                onChange={(e) => setSettings({ ...settings, reminderDaysBefore2: e.target.value })}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">days before</p>
            </div>
            <div>
              <label className={labelCls}>Third Alert</label>
              <input
                type="number"
                min={1}
                required
                value={settings.reminderDaysBefore3}
                onChange={(e) => setSettings({ ...settings, reminderDaysBefore3: e.target.value })}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">days before</p>
            </div>
          </div>
        </div>

        {/* Notification Channels */}
        <div className="bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.06] rounded-md p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">Notification Channels</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Enable or disable alert dispatch channels</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">Email Alerts</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Send transactional reminders to borrower email addresses
                </p>
              </div>
              <Toggle
                id="toggle-email"
                checked={settings.emailEnabled}
                onChange={(v) => setSettings({ ...settings, emailEnabled: v })}
              />
            </div>
            <div className="border-t border-slate-100 dark:border-white/[0.05] pt-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">SMS Alerts</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  SMS channel logging (delivery out-of-scope for V1)
                </p>
              </div>
              <Toggle
                id="toggle-sms"
                checked={settings.smsEnabled}
                onChange={(v) => setSettings({ ...settings, smsEnabled: v })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-md text-sm transition-colors disabled:opacity-60 shadow-sm"
          >
            {submitting ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
