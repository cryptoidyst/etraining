'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/auth-context';
import { listAuditLogs } from '@/lib/platform-api';
import { Alert, Button, PageHead, Pill, SkeletonRows } from '@/components/ui';

const ENTITY_TYPES: [string, string][] = [
  ['', 'All'],
  ['assignment', 'Assignments'],
  ['course', 'Courses'],
  ['question', 'Questions'],
];

function AuditContent() {
  const { token } = useAuth();
  const [entityType, setEntityType] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const auditQuery = useQuery({
    queryKey: ['audit', entityType, offset],
    queryFn: () =>
      listAuditLogs(token!, {
        entityType: entityType || undefined,
        limit,
        offset,
      }),
    enabled: Boolean(token),
  });

  const items = auditQuery.data?.items ?? [];
  const total = auditQuery.data?.total ?? 0;

  return (
    <div>
      <PageHead
        eyebrow="Administration"
        title="Audit Log"
        sub="Recorded admin actions. Newest first."
      />

      <div className="tabs">
        {ENTITY_TYPES.map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            className="tab"
            aria-pressed={entityType === value}
            onClick={() => {
              setEntityType(value);
              setOffset(0);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {auditQuery.isLoading && <SkeletonRows rows={8} cols={5} />}
      {auditQuery.isError && <Alert tone="error">Failed to load audit log.</Alert>}

      {!auditQuery.isLoading && (
      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {!auditQuery.isLoading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="tableempty">
                  No audit entries yet.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td className="num text-muted">{new Date(item.createdAt).toLocaleString()}</td>
                <td>{item.userName}</td>
                <td>
                  <Pill>{item.action}</Pill>
                </td>
                <td className="mono">{item.entityType}</td>
                <td className="mono text-muted">
                  {item.changes ? JSON.stringify(item.changes) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {total > limit && (
        <div className="pager">
          <span className="mono">
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <div className="pager__actions">
            <Button sm onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}>
              Prev
            </Button>
            <Button sm onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditPage() {
  return (
    <ProtectedRoute>
      <AuditContent />
    </ProtectedRoute>
  );
}
