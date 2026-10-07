'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Alert, Button, Field, Modal, PageHead, Pill, SkeletonRows } from '@/components/ui';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import {
  approveUser,
  listDepartments,
  listUsers,
  rejectUser,
  type ListUsersFilter,
  type ManagedUser,
} from '@/lib/admin-api';
import { ApiError } from '@/lib/api';

const filters: { key: ListUsersFilter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

const statusTone: Record<ManagedUser['approvalStatus'], 'pass' | 'fail' | 'info'> = {
  pending: 'info',
  approved: 'pass',
  rejected: 'fail',
};

function UsersTable() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState<ListUsersFilter>('pending');
  const [actionError, setActionError] = useState<string | null>(null);
  const [approving, setApproving] = useState<ManagedUser | null>(null);
  const [approveDepartmentId, setApproveDepartmentId] = useState('');
  const [approveRole, setApproveRole] = useState<'administrator' | 'staff'>('staff');
  const [rejecting, setRejecting] = useState<ManagedUser | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['users', filter],
    queryFn: () => listUsers(token!, filter),
    enabled: Boolean(token),
  });

  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => listDepartments(token!),
    enabled: Boolean(token),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const approveMutation = useMutation({
    mutationFn: ({ id, departmentId, role }: { id: string; departmentId: string; role: 'administrator' | 'staff' }) =>
      approveUser(token!, id, { departmentId, role }),
    onSuccess: () => {
      setApproving(null);
      setApproveDepartmentId('');
      setApproveRole('staff');
      invalidate();
      toast.success('User approved.');
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Approve failed.';
      setActionError(message);
      toast.error('Approve failed', message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectUser(token!, id, reason),
    onSuccess: () => {
      setRejecting(null);
      setRejectReason('');
      invalidate();
      toast.success('Registration rejected.');
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Reject failed.';
      setActionError(message);
      toast.error('Reject failed', message);
    },
  });

  if (usersQuery.isLoading) {
    return <SkeletonRows rows={5} cols={5} />;
  }

  if (usersQuery.isError) {
    return (
      <Alert tone="error">
        {usersQuery.error instanceof ApiError
          ? usersQuery.error.message
          : 'Failed to load users.'}
      </Alert>
    );
  }

  const users = usersQuery.data ?? [];
  const visibleUsers = users.filter((u) => u.id !== user?.id);

  return (
    <div className="stack">
      <div className="tabs">
        {filters.map((f) => (
          <button
            key={f.key}
            className="tab"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Provider</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length === 0 && (
              <tr>
                <td colSpan={7} className="tableempty">
                  No users for this filter.
                </td>
              </tr>
            )}
            {visibleUsers.map((u) => (
              <tr key={u.id}>
                <td>
                  <p className="cell-strong">{u.fullName}</p>
                  <p className="text-muted text-sm">@{u.username}</p>
                </td>
                <td>{u.email ?? '—'}</td>
                <td>{u.authProvider}</td>
                <td>{u.role}</td>
                <td>{u.departmentName ?? '—'}</td>
                <td>
                  <Pill tone={statusTone[u.approvalStatus]}>{u.approvalStatus}</Pill>
                </td>
                <td>
                  {u.approvalStatus === 'pending' && (
                    <div className="rowactions">
                      <Button
                        variant="primary"
                        sm
                        onClick={() => {
                          setActionError(null);
                          setApproveDepartmentId('');
                          setApproveRole('staff');
                          setApproving(u);
                        }}
                        disabled={approveMutation.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        sm
                        onClick={() => {
                          setActionError(null);
                          setRejecting(u);
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {approving && (
        <Modal
          title={`Approve ${approving.fullName}?`}
          onClose={() => {
            setApproving(null);
            setApproveDepartmentId('');
            setApproveRole('staff');
          }}
          footer={
            <>
              <Button
                onClick={() => {
                  setApproving(null);
                  setApproveDepartmentId('');
                  setApproveRole('staff');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  approveMutation.mutate({
                    id: approving.id,
                    departmentId: approveDepartmentId,
                    role: approveRole,
                  })
                }
                disabled={approveMutation.isPending || !approveDepartmentId}
              >
                {approveMutation.isPending ? 'Approving…' : 'Approve'}
              </Button>
            </>
          }
        >
          <Field
            label="Department"
            htmlFor="approve-department"
            hint={
              approveDepartmentId
                ? 'Can be changed later under Staff.'
                : 'Required — select a department to enable approval.'
            }
          >
            <select
              id="approve-department"
              value={approveDepartmentId}
              aria-invalid={!approveDepartmentId}
              onChange={(e) => setApproveDepartmentId(e.target.value)}
            >
              <option value="">Select a department…</option>
              {(departmentsQuery.data ?? [])
                .filter((d) => d.isActive)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field
            label="Role"
            htmlFor="approve-role"
            hint="Staff can only access assigned training."
          >
            <select
              id="approve-role"
              value={approveRole}
              onChange={(e) => setApproveRole(e.target.value as 'administrator' | 'staff')}
            >
              <option value="staff">Staff</option>
              <option value="administrator">Administrator</option>
            </select>
          </Field>
        </Modal>
      )}

      {rejecting && (
        <Modal
          title={`Reject registration of ${rejecting.fullName}?`}
          onClose={() => {
            setRejecting(null);
            setRejectReason('');
          }}
          footer={
            <>
              <Button
                onClick={() => {
                  setRejecting(null);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => rejectMutation.mutate({ id: rejecting.id, reason: rejectReason || undefined })}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
              </Button>
            </>
          }
        >
          <Field htmlFor="reject-reason">
            <input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason (optional)"
            />
          </Field>
        </Modal>
      )}

      {user?.role !== 'administrator' && (
        <p className="text-muted text-sm">Read-only view — administrator role required.</p>
      )}
    </div>
  );
}

function UsersContent() {
  return (
    <div>
      <PageHead
        eyebrow="Administration"
        title="Users & Approvals"
        sub="Review self-registered accounts before they can sign in."
      />
      <UsersTable />
    </div>
  );
}

export default function UsersPage() {
  return (
    <ProtectedRoute>
      <UsersContent />
    </ProtectedRoute>
  );
}
