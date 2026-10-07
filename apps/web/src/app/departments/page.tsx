'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Alert, Button, Field, Modal, PageHead, Pill, SkeletonRows } from '@/components/ui';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
  type Department,
} from '@/lib/admin-api';
import { ApiError } from '@/lib/api';

function DepartmentsTable() {
  const { token } = useAuth();
  const toast = useToast();
  const [showInactive, setShowInactive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const departmentsQuery = useQuery({
    queryKey: ['departments', showInactive],
    queryFn: () => listDepartments(token!, showInactive),
    enabled: Boolean(token),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['departments'] });

  const createMutation = useMutation({
    mutationFn: (input: { name: string; code: string; description?: string }) =>
      createDepartment(token!, input),
    onSuccess: () => {
      setCreating(false);
      invalidate();
      toast.success('Department created.');
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Create failed.';
      setFormError(message);
      toast.error('Create failed', message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; description?: string; isActive?: boolean } }) =>
      updateDepartment(token!, id, input),
    onSuccess: () => {
      setEditing(null);
      invalidate();
      toast.success('Department updated.');
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Update failed.';
      setFormError(message);
      toast.error('Update failed', message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDepartment(token!, id),
    onSuccess: () => {
      invalidate();
      toast.success('Department deleted.');
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Delete failed.';
      setFormError(message);
      toast.error('Delete failed', message);
    },
  });

  if (departmentsQuery.isLoading) return <SkeletonRows rows={5} cols={4} />;
  if (departmentsQuery.isError) {
    return <Alert tone="error">Failed to load departments.</Alert>;
  }

  const departments = departmentsQuery.data ?? [];

  return (
    <div className="stack">
      <div className="row">
        <label className="row">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <div className="spacer" />
        <Button
          variant="primary"
          onClick={() => {
            setFormError(null);
            setCreating(true);
          }}
        >
          New department
        </Button>
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}

      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Staff</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 && (
              <tr>
                <td colSpan={5} className="tableempty">
                  No departments yet.
                </td>
              </tr>
            )}
            {departments.map((d) => (
              <tr key={d.id}>
                <td>
                  <p className="cell-strong">{d.name}</p>
                  {d.description && <p className="text-muted text-sm">{d.description}</p>}
                </td>
                <td className="mono">{d.code}</td>
                <td className="num">{d.staffCount}</td>
                <td>
                  <Pill tone={d.isActive ? 'pass' : 'neutral'}>
                    {d.isActive ? 'active' : 'inactive'}
                  </Pill>
                </td>
                <td>
                  <div className="rowactions">
                    <Button
                      sm
                      onClick={() => {
                        setFormError(null);
                        setEditing(d);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      sm
                      onClick={() => {
                        setFormError(null);
                        deleteMutation.mutate(d.id);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DepartmentModal
        open={creating || editing !== null}
        department={editing}
        saving={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={(values) => {
          if (editing) {
            updateMutation.mutate({ id: editing.id, input: values });
          } else {
            createMutation.mutate(values as { name: string; code: string });
          }
        }}
      />
    </div>
  );
}

function DepartmentModal({
  open,
  department,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  department: Department | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; code?: string; description?: string; isActive?: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [key, setKey] = useState('');

  const currentKey = department?.id ?? 'new';
  if (open && key !== currentKey) {
    setKey(currentKey);
    setName(department?.name ?? '');
    setCode(department?.code ?? '');
    setDescription(department?.description ?? '');
  }
  if (!open && key !== '') setKey('');

  if (!open) return null;

  return (
    <Modal
      title={department ? `Edit ${department.name}` : 'New department'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onSubmit({ name, code: code || undefined, description: description || undefined })}
            disabled={saving || !name || (!department && !code)}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <Field label="Name" htmlFor="department-name">
        <input id="department-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {!department && (
        <Field label="Code (lowercase, unique)" htmlFor="department-code">
          <input
            id="department-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase())}
          />
        </Field>
      )}
      <Field label="Description" htmlFor="department-description">
        <input
          id="department-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      {department && (
        <label className="row">
          <input
            type="checkbox"
            checked={department.isActive}
            onChange={(e) =>
              onSubmit({ name, description: description || undefined, isActive: e.target.checked })
            }
          />
          Active
        </label>
      )}
    </Modal>
  );
}

function DepartmentsContent() {
  return (
    <div>
      <PageHead
        eyebrow="Administration"
        title="Departments"
        sub="Organize staff into departments. Departments with staff cannot be deleted."
      />
      <DepartmentsTable />
    </div>
  );
}

export default function DepartmentsPage() {
  return (
    <ProtectedRoute>
      <DepartmentsContent />
    </ProtectedRoute>
  );
}
