'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import {
  Alert,
  Button,
  ButtonLink,
  Field,
  Modal,
  PageHead,
  Pill,
  SkeletonRows,
} from '@/components/ui';
import { useToast } from '@/components/toast';
import { ActionMenu } from '@/components/action-menu';
import { CourseWizard } from '@/components/course-wizard';
import { useAuth } from '@/lib/auth-context';
import {
  archiveCourse,
  deleteCourse,
  listCourses,
  publishCourse,
  unpublishCourse,
  updateCourse,
  type Course,
  type CourseStatusFilter,
} from '@/lib/admin-api';
import { ApiError } from '@/lib/api';

const statusFilters: { key: CourseStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'published', label: 'Published' },
  { key: 'archived', label: 'Archived' },
];

const statusTone: Record<Course['status'], 'neutral' | 'pass' | 'info'> = {
  draft: 'neutral',
  published: 'pass',
  archived: 'info',
};

function CoursesTable() {
  const { token } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<CourseStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal, setModal] = useState<Course | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const queryClient = useQueryClient();

  const coursesQuery = useQuery({
    queryKey: ['courses', status, search],
    queryFn: () => listCourses(token!, { status, search: search || undefined }),
    enabled: Boolean(token),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['courses'] });

  const publishMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'unpublish' | 'archive' }) =>
      action === 'publish'
        ? publishCourse(token!, id)
        : action === 'unpublish'
          ? unpublishCourse(token!, id)
          : archiveCourse(token!, id),
    onSuccess: (_data, { action }) => {
      invalidate();
      toast.success(`Course ${action === 'publish' ? 'published' : action === 'unpublish' ? 'unpublished' : 'archived'}.`);
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Action failed.';
      setActionError(message);
      toast.error('Action failed', message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCourse(token!, id),
    onSuccess: () => {
      invalidate();
      toast.success('Course deleted.');
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Delete failed.';
      setActionError(message);
      toast.error('Delete failed', message);
    },
  });

  if (coursesQuery.isLoading) return <SkeletonRows rows={6} cols={5} />;
  if (coursesQuery.isError) {
    return <Alert tone="error">Failed to load courses.</Alert>;
  }

  const courses = coursesQuery.data ?? [];

  return (
    <div className="stack">
      <div className="tabs">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className="tab"
            aria-pressed={status === f.key}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="filterbar">
        <Field label="Search" htmlFor="courses-search" className="grow">
          <input
            id="courses-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
          />
        </Field>
        <Button
          variant="primary"
          onClick={() => {
            setActionError(null);
            setWizardOpen(true);
          }}
        >
          New course
        </Button>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Course</th>
              <th>Slides</th>
              <th>Pass score</th>
              <th>Retake</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr>
                <td colSpan={6} className="tableempty">
                  No courses found.
                </td>
              </tr>
            )}
            {courses.map((c) => (
              <tr key={c.id}>
                <td>
                  <p className="cell-strong">{c.title}</p>
                  {c.description && <p className="text-muted text-sm">{c.description}</p>}
                </td>
                <td className="num">{c.slideCount}</td>
                <td className="num">{c.passingScore}%</td>
                <td>
                  {c.allowRetake ? (c.maxAttempts ? `max ${c.maxAttempts}` : 'yes') : 'no'}
                </td>
                <td>
                  <Pill tone={statusTone[c.status]}>{c.status}</Pill>
                </td>
                <td>
                  <div className="rowactions">
                    {c.status !== 'published' ? (
                      <Button
                        sm
                        variant="primary"
                        onClick={() => {
                          setActionError(null);
                          publishMutation.mutate({ id: c.id, action: 'publish' });
                        }}
                        disabled={publishMutation.isPending}
                      >
                        Publish
                      </Button>
                    ) : (
                      <ButtonLink href={`/slides?courseId=${c.id}`} sm>
                        View slides
                      </ButtonLink>
                    )}
                    <ActionMenu
                      items={[
                        {
                          label: `Slides (${c.slideCount})`,
                          onClick: () => {
                            window.location.href = `/slides?courseId=${c.id}`;
                          },
                        },
                        {
                          label: 'Question bank',
                          onClick: () => {
                            window.location.href = `/questions?courseId=${c.id}`;
                          },
                        },
                        {
                          label: 'Quiz builder',
                          onClick: () => {
                            window.location.href = `/quiz?courseId=${c.id}`;
                          },
                        },
                        {
                          label: 'Assignments',
                          onClick: () => {
                            window.location.href = `/assignments?courseId=${c.id}`;
                          },
                        },
                        {
                          label: 'Edit',
                          onClick: () => {
                            setActionError(null);
                            setModal(c);
                          },
                        },                        {
                          label: 'Archive',
                          onClick: () => {
                            setActionError(null);
                            publishMutation.mutate({ id: c.id, action: 'archive' });
                          },
                          disabled: c.status === 'archived' || publishMutation.isPending,
                        },
                        {
                          label: 'Unpublish',
                          onClick: () => {
                            setActionError(null);
                            publishMutation.mutate({ id: c.id, action: 'unpublish' });
                          },
                          disabled: c.status !== 'published' || publishMutation.isPending,
                        },
                        {
                          label: 'Delete',
                          tone: 'danger',
                          onClick: () => {
                            setActionError(null);
                            deleteMutation.mutate(c.id);
                          },
                          disabled: c.status === 'published' || deleteMutation.isPending,
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CourseModal
        course={modal}
        open={modal !== null}
        saving={false}
        onClose={() => setModal(null)}
      />

      <CourseWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

function CourseModal({
  course,
  open,
  onClose,
}: {
  course: Course | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState('');

  const currentKey = course?.id ?? '';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState(80);
  const [allowRetake, setAllowRetake] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState('');

  if (open && course && key !== currentKey) {
    setKey(currentKey);
    setTitle(course.title);
    setDescription(course.description ?? '');
    setPassingScore(course.passingScore);
    setAllowRetake(course.allowRetake);
    setMaxAttempts(course.maxAttempts?.toString() ?? '');
  }
  if (!open && key !== '') setKey('');

  const saveMutation = useMutation({
    mutationFn: (values: Parameters<typeof updateCourse>[2]) =>
      updateCourse(token!, course!.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Course updated.');
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Save failed.'),
  });

  if (!open || !course) return null;

  return (
    <Modal
      title={`Edit ${course.title}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() =>
              saveMutation.mutate({
                title,
                description: description || undefined,
                passingScore,
                allowRetake,
                maxAttempts: maxAttempts ? Number(maxAttempts) : null,
              })
            }
            disabled={saveMutation.isPending || title.trim().length < 3}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <Field label="Title" htmlFor="course-title">
        <input
          id="course-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Description" htmlFor="course-description">
        <textarea
          id="course-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </Field>
      <div className="grid2">
        <Field label="Pass score %" htmlFor="course-passing-score">
          <input
            id="course-passing-score"
            type="number"
            min={1}
            max={100}
            value={passingScore}
            onChange={(e) => setPassingScore(Number(e.target.value))}
          />
        </Field>
        <Field label="Allow retake" htmlFor="course-allow-retake">
          <select
            id="course-allow-retake"
            value={allowRetake ? 'yes' : 'no'}
            onChange={(e) => setAllowRetake(e.target.value === 'yes')}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="Max attempts" htmlFor="course-max-attempts">
          <input
            id="course-max-attempts"
            type="number"
            min={1}
            placeholder="∞"
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(e.target.value)}
          />
        </Field>
      </div>
      {error && <p className="hint-error">{error}</p>}
    </Modal>
  );
}

function CoursesContent() {
  return (
    <div>
      <PageHead
        eyebrow="Administration"
        title="Courses"
        sub="Create a course with slides and a quiz. A course needs at least one slide and a set of at least 10 questions before it can be published."
      />
      <CoursesTable />
    </div>
  );
}

export default function CoursesPage() {
  return (
    <ProtectedRoute>
      <CoursesContent />
    </ProtectedRoute>
  );
}
