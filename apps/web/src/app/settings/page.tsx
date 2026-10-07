'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/auth-context';
import { getSettings, updateSettings } from '@/lib/platform-api';
import { ApiError } from '@/lib/api';
import { Alert, Button, Field, PageHead, Skeleton } from '@/components/ui';
import { useToast } from '@/components/toast';

const fields: { key: string; label: string; type: 'text' | 'number' | 'bool'; hint?: string }[] = [
  { key: 'company_name', label: 'Company name', type: 'text' },
  { key: 'default_passing_score', label: 'Default pass score %', type: 'number', hint: '1–100' },
  { key: 'default_allow_retake', label: 'Allow retake by default', type: 'bool' },
  { key: 'default_max_attempts', label: 'Default max attempts', type: 'number', hint: 'Blank = unlimited' },
  { key: 'deadline_reminder_days', label: 'Deadline reminder (days before)', type: 'number' },
];

function SettingsContent() {
  const { token } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => getSettings(token!),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (settingsQuery.data) setValues(settingsQuery.data);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateSettings(token!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setMessage('Settings saved.');
      setError('');
      toast.success('Settings saved.');
      setTimeout(() => setMessage(''), 2500);
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Save failed.';
      setError(message);
      toast.error('Save failed', message);
    },
  });

  return (
    <div>
      <PageHead
        eyebrow="Administration"
        title="System Settings"
        sub="Defaults applied to new courses and reminders."
      />

      {settingsQuery.isLoading && (
        <div className="card stack" style={{ maxWidth: '40rem' }}>
          {fields.map((f) => (
            <div key={f.key}>
              <Skeleton height="0.8rem" width="30%" />
              <div className="mt-sm">
                <Skeleton height="2.75rem" width="100%" />
              </div>
            </div>
          ))}
        </div>
      )}
      {settingsQuery.isError && <Alert tone="error">Failed to load settings.</Alert>}

      {settingsQuery.isSuccess && (
        <div className="card stack" style={{ maxWidth: '40rem' }}>
          {fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              htmlFor={`setting-${f.key}`}
              hint={f.hint}
            >
              {f.type === 'bool' ? (
                <select
                  id={`setting-${f.key}`}
                  value={values[f.key] === 'true' ? 'true' : 'false'}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  id={`setting-${f.key}`}
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              )}
            </Field>
          ))}

          {message && <Alert tone="pass">{message}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}

          <div className="row">
            <span className="spacer" />
            <Button
              variant="primary"
              onClick={() => {
                setError('');
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
