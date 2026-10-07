'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Alert, Button, Field, Modal, PageHead, Pill, SkeletonRows } from '@/components/ui';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import {
  listDepartments,
  listStaff,
  updateStaff,
  type StaffMember,
} from '@/lib/admin-api';
import { ApiError } from '@/lib/api';

const statusTone: Record<string, 'pass' | 'fail' | 'info' | 'neutral'> = {
  pending: 'info',
  approved: 'pass',
  rejected: 'fail',
};

function StaffTable() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [role, setRole] = useState('');
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const departmentsQuery = useQuery({
    queryKey: ['departments', false],
    queryFn: () => listDepartments(token!),
    enabled: Boolean(token),
  });

  const staffQuery = useQuery({
    queryKey: ['staff', search, departmentId, role],
    queryFn: () =>
      listStaff(token!, {
        search: search || undefined,
        departmentId: departmentId || undefined,
        role: (role || undefined) as 'administrator' | 'staff' | undefined,
      }),
    enabled: Boolean(token),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Parameters<typeof updateStaff>[2];
    }) => updateStaff(token!, id, input),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff member updated.');
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Update failed.';
      setActionError(message);
      toast.error('Update failed', message);
    },
  });

  if (staffQuery.isLoading) return <SkeletonRows rows={6} cols={5} />;
  if (staffQuery.isError) {
    return <Alert tone="error">Failed to load staff.</Alert>;
  }

  const staff = staffQuery.data ?? [];
  const visibleStaff = staff.filter((s) => s.id !== user?.id);
  const departments = departmentsQuery.data ?? [];

  return (
    <div className="stack">
      <div className="filterbar">
        <Field className="filterbar grow" htmlFor="staff-search">
          <input
            id="staff-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, username, email…"
          />
        </Field>
        <Field className="filterbar" htmlFor="staff-department">
          <select
            id="staff-department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field className="filterbar" htmlFor="staff-role">
          <select id="staff-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="staff">staff</option>
            <option value="administrator">administrator</option>
          </select>
        </Field>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Department</th>
              <th>Job title</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleStaff.length === 0 && (
              <tr>
                <td colSpan={6} className="tableempty">
                  No staff match these filters.
                </td>
              </tr>
            )}
            {visibleStaff.map((s) => (
              <tr key={s.id} className={s.isActive ? '' : 'row-muted'}>
                <td>
                  <p className="cell-strong">{s.fullName}</p>
                  <p className="text-muted text-sm">
                    @{s.username} · {s.email ?? 'no email'}
                  </p>
                </td>
                <td>{s.departmentName ?? '—'}</td>
                <td>{s.jobTitle ?? '—'}</td>
                <td>{s.role}</td>
                <td>
                  <Pill tone={statusTone[s.approvalStatus] ?? 'neutral'}>{s.approvalStatus}</Pill>
                </td>
                <td>
                  <div className="rowactions">
                    <Button
                      sm
                      onClick={() => {
                        setActionError(null);
                        setEditing(s);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditStaffModal
          staff={editing}
          departments={departments}
          saving={updateMutation.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(input) => updateMutation.mutate({ id: editing.id, input })}
        />
      )}
    </div>
  );
}

function EditStaffModal({
  staff,
  departments,
  saving,
  onClose,
  onSubmit,
}: {
  staff: StaffMember;
  departments: { id: string; name: string }[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: {
    fullName: string;
    email: string | null;
    employeeId: string | null;
    jobTitle: string | null;
    departmentId: string | null;
    isActive: boolean;
  }) => void;
}) {
  const [fullName, setFullName] = useState(staff.fullName);
  const [email, setEmail] = useState(staff.email ?? '');
  const [employeeId, setEmployeeId] = useState(staff.employeeId ?? '');
  const [jobTitle, setJobTitle] = useState(staff.jobTitle ?? '');
  const [departmentId, setDepartmentId] = useState(staff.departmentId ?? '');
  const [isActive, setIsActive] = useState(staff.isActive);

  return (
    <Modal
      title={`Edit ${staff.fullName}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() =>
              onSubmit({
                fullName,
                email: email || null,
                employeeId: employeeId || null,
                jobTitle: jobTitle || null,
                departmentId: departmentId || null,
                isActive,
              })
            }
            disabled={saving || !fullName}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <Field label="Full name" htmlFor="staff-fullname">
        <input id="staff-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field label="Email" htmlFor="staff-email">
        <input id="staff-email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Employee ID" htmlFor="staff-employeeid">
        <input id="staff-employeeid" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
      </Field>
      <Field label="Job title" htmlFor="staff-jobtitle">
        <input id="staff-jobtitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
      </Field>
      <Field label="Department" htmlFor="staff-department-modal">
        <select
          id="staff-department-modal"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        >
          <option value="">No department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <label className="row">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Account active
      </label>
    </Modal>
  );
}

function StaffContent() {
  return (
    <div>
      <PageHead
        eyebrow="Administration"
        title="Staff"
        sub="Manage staff profiles, department assignments, and account status."
      />
      <StaffTable />
    </div>
  );
}

export default function StaffPage() {
  return (
    <ProtectedRoute>
      <StaffContent />
    </ProtectedRoute>
  );
}
