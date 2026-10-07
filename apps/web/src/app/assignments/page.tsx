'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { Alert, Button, EmptyState, Field, Modal, PageHead, SkeletonRows } from '@/components/ui';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import { listCourses } from '@/lib/admin-api';
import { listDepartments, listStaff } from '@/lib/admin-api';
import {
  createAssignment,
  deleteAssignment,
  listAssignments,
  updateAssignment,
  type AssignmentRow,
} from '@/lib/assignments-api';
import { ApiError } from '@/lib/api';

function useCourseList() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['courses', 'all'],
    queryFn: () => listCourses(token!, { status: 'all' }),
    enabled: Boolean(token),
  });
}

function AssignModal({
  courseId,
  onClose,
  onError,
}: {
  courseId: string;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [targetType, setTargetType] = useState<'user' | 'department'>('user');
  const [targetId, setTargetId] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    setTargetId('');
  }, [targetType]);

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: () => listStaff(token!, { role: 'staff' }),
    enabled: Boolean(token) && targetType === 'user',
  });
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => listDepartments(token!),
    enabled: Boolean(token) && targetType === 'department',
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      createAssignment(token!, {
        courseId,
        targetType,
        targetId,
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['course-assignments', courseId] });
      const note = result.skipped > 0 ? `${result.skipped} already assigned and skipped.` : undefined;
      toast.success(`Assigned ${result.created} user(s).`, note);
      onClose();
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Assign failed.';
      toast.error('Assign failed', message);
      onError(message);
    },
  });

  const options =
    targetType === 'user'
      ? (staffQuery.data ?? []).map((s) => ({ id: s.id, label: s.fullName }))
      : (departmentsQuery.data ?? []).map((d) => ({ id: d.id, label: d.name }));

  return (
    <Modal
      title="Assign course"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onError('');
              assignMutation.mutate();
            }}
            disabled={!targetId || assignMutation.isPending}
          >
            {assignMutation.isPending ? 'Assigning…' : 'Assign'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="row">
          {(['user', 'department'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="tab"
              aria-pressed={targetType === t}
              onClick={() => setTargetType(t)}
            >
              {t === 'user' ? 'Individual' : 'Department'}
            </button>
          ))}
        </div>
        <Field
          label={targetType === 'user' ? 'Staff member' : 'Department'}
          htmlFor="assign-target"
        >
          <select
            id="assign-target"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">Select…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {targetType === 'user' && staffQuery.isLoading && (
          <p className="text-muted text-sm">Loading staff…</p>
        )}
        {targetType === 'department' && departmentsQuery.isLoading && (
          <p className="text-muted text-sm">Loading departments…</p>
        )}
        <Field label="Due date (optional)" htmlFor="assign-due-date">
          <input
            id="assign-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <p className="text-muted text-sm">
          Department assigns create one entry per active member. Already-assigned members are
          skipped.
        </p>
      </div>
    </Modal>
  );
}

function DueDateCell({
  assignment,
  onError,
}: {
  assignment: AssignmentRow;
  onError: (msg: string) => void;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(assignment.dueDate ? assignment.dueDate.slice(0, 10) : '');

  const updateMutation = useMutation({
    mutationFn: () =>
      updateAssignment(token!, assignment.id, {
        dueDate: value ? new Date(`${value}T23:59:59`).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-assignments', assignment.courseId] });
      setEditing(false);
      toast.success('Due date updated.');
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Update failed.';
      toast.error('Update failed', message);
      onError(message);
    },
  });

  if (editing) {
    return (
      <span className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          type="date"
          className="num"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          sm
          variant="primary"
          onClick={() => {
            onError('');
            updateMutation.mutate();
          }}
          disabled={updateMutation.isPending}
        >
          Save
        </Button>
        <Button sm onClick={() => setEditing(false)}>
          ✕
        </Button>
      </span>
    );
  }

  return (
    <button type="button" className="backlink" onClick={() => setEditing(true)} title="Edit due date">
      {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : '—'}
    </button>
  );
}

function AssignedTable({ courseId }: { courseId: string }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const assignmentsQuery = useQuery({
    queryKey: ['course-assignments', courseId, onlyOverdue],
    queryFn: () => listAssignments(token!, { courseId, overdue: onlyOverdue || undefined }),
    enabled: Boolean(token),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteAssignment(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-assignments', courseId] });
      toast.success('Assignment removed.');
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Remove failed.';
      setError(message);
      toast.error('Remove failed', message);
    },
  });

  const items = assignmentsQuery.data ?? [];
  const overdueCount = items.filter(
    (a) => a.dueDate && new Date(a.dueDate) < new Date(),
  ).length;

  return (
    <div className="stack">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="row">
        <p className="mono text-muted">
          {items.length} assigned · {overdueCount} overdue
        </p>
        <div className="spacer" />
        <label className="row text-sm">
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => setOnlyOverdue(e.target.checked)}
          />
          Overdue only
        </label>
      </div>
      {assignmentsQuery.isLoading && <SkeletonRows rows={5} cols={4} />}
      {!assignmentsQuery.isLoading && (
      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Assigned user</th>
              <th>Department</th>
              <th>Via</th>
              <th>Due date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!assignmentsQuery.isLoading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="tableempty">
                  {onlyOverdue
                    ? 'Nothing overdue.'
                    : 'Nobody assigned yet. Use “Assign course” above.'}
                </td>
              </tr>
            )}
            {items.map((a) => {
              const isOverdue = a.dueDate ? new Date(a.dueDate) < new Date() : false;
              return (
                <tr key={a.id}>
                  <td>
                    <span className="cell-strong">{a.user.fullName}</span>
                  </td>
                  <td>{a.user.department?.name ?? '—'}</td>
                  <td>{a.targetType === 'department' ? 'department' : 'individual'}</td>
                  <td>
                    <span className={isOverdue ? 'st--fail' : undefined}>
                      <DueDateCell assignment={a} onError={setError} />
                    </span>
                  </td>
                  <td>
                    <div className="rowactions">
                      <Button
                        sm
                        variant="danger"
                        onClick={() => {
                          setError(null);
                          removeMutation.mutate(a.id);
                        }}
                        disabled={removeMutation.isPending}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

function AssignmentsContent() {
  const searchParams = useSearchParams();
  const courseQuery = useCourseList();
  const [courseId, setCourseId] = useState(searchParams.get('courseId') ?? '');
  const [modal, setModal] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const courses = courseQuery.data ?? [];
  const selected = courses.find((c) => c.id === courseId) ?? null;

  const report = (msg: string) => {
    if (!msg) return;
    if (msg.includes('failed') || msg.includes('Failed')) {
      setError(msg);
      setMessage('');
    } else {
      setMessage(msg);
      setError(null);
    }
  };

  return (
    <div>
      <PageHead
        title="Course Assignments"
        sub="Assign published or draft courses to staff and departments (Module 9)."
        back={{ href: '/courses', label: 'Back to courses' }}
        actions={
          courseId ? (
            <Button
              variant="primary"
              onClick={() => {
                setError(null);
                setModal(true);
              }}
            >
              Assign course
            </Button>
          ) : undefined
        }
      />

      <div className="filterbar">
        <Field label="Course" htmlFor="assignments-course" className="grow">
          <select
            id="assignments-course"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setError(null);
              setMessage('');
            }}
          >
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.status})
              </option>
            ))}
          </select>
        </Field>
      </div>

      {message && !error && (
        <div className="mt-md">
          <Alert tone="pass">{message}</Alert>
        </div>
      )}
      {error && (
        <div className="mt-md">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {courseQuery.isLoading && <SkeletonRows rows={4} cols={4} />}
      {!courseQuery.isLoading && !courseId && (
        <EmptyState icon="clipboard" title="No course selected">
          Pick a course above to view and manage assignments.
        </EmptyState>
      )}
      {courseId && selected && <AssignedTable courseId={courseId} />}

      {modal && courseId && (
        <AssignModal courseId={courseId} onClose={() => setModal(false)} onError={report} />
      )}
    </div>
  );
}

export default function AssignmentsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <AssignmentsContent />
      </Suspense>
    </ProtectedRoute>
  );
}
