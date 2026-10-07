'use client';

import { useQuery } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import {
  Alert,
  ButtonLink,
  EmptyState,
  Field,
  Kpi,
  PageHead,
  Pill,
  Skeleton,
  SkeletonRows,
} from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { listCourses, listDepartments, listStaff } from '@/lib/admin-api';
import {
  getCourseReport,
  getDashboardReport,
  getOverdueReport,
  getStaffTranscript,
  type CourseReportRow,
} from '@/lib/reports-api';

const statusTone: Record<CourseReportRow['status'], 'pass' | 'info' | 'neutral' | 'fail'> = {
  completed: 'pass',
  in_progress: 'info',
  not_started: 'neutral',
  overdue: 'fail',
};

const statusLabel: Record<CourseReportRow['status'], string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  not_started: 'Not started',
  overdue: 'Overdue',
};

function DashboardSection() {
  const { token } = useAuth();
  const dashboardQuery = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () => getDashboardReport(token!),
    enabled: Boolean(token),
  });
  const overdueQuery = useQuery({
    queryKey: ['reports-overdue'],
    queryFn: () => getOverdueReport(token!),
    enabled: Boolean(token),
  });

  if (dashboardQuery.isLoading) {
    return (
      <div className="stack">
        <div className="kgrid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="kpi">
              <Skeleton height="0.7rem" width="55%" />
              <div className="mt-sm">
                <Skeleton height="1.8rem" width="40%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (dashboardQuery.isError) {
    return <Alert tone="error">Failed to load dashboard.</Alert>;
  }

  const d = dashboardQuery.data!;

  return (
    <div className="stack">
      <div className="kgrid">
        <Kpi
          label="Completion rate"
          value={<span className="st--pass">{d.completionRate}%</span>}
        />
        <Kpi label="Assignments" value={`${d.completedAssignments}/${d.totalAssignments}`} />
        <Kpi
          label="Overdue"
          value={
            d.overdueAssignments > 0 ? (
              <span className="st--fail">{d.overdueAssignments}</span>
            ) : (
              d.overdueAssignments
            )
          }
        />
        <Kpi
          label="Avg best score"
          value={d.averageBestScore !== null ? `${d.averageBestScore}%` : '—'}
        />
        <Kpi label="Active users" value={d.totalUsers} />
        <Kpi label="Pending approvals" value={d.pendingApprovals} />
        <Kpi label="Courses (published)" value={`${d.publishedCourses}/${d.totalCourses}`} />
        <Kpi label="Quiz attempts" value={d.totalAttempts} />
      </div>

      <div className="card">
        <h2>Overdue (not passed)</h2>
        {overdueQuery.isLoading && <p className="listnote">Loading…</p>}
        {overdueQuery.data?.length === 0 && <EmptyState>Nothing overdue. 🎉</EmptyState>}
        {overdueQuery.data && overdueQuery.data.length > 0 && (
          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Department</th>
                  <th>Course</th>
                  <th>Due</th>
                  <th style={{ textAlign: 'right' }}>Days over</th>
                </tr>
              </thead>
              <tbody>
                {overdueQuery.data.map((o) => (
                  <tr key={o.assignmentId}>
                    <td>
                      <span className="cell-strong">{o.fullName}</span>
                    </td>
                    <td>{o.departmentName ?? '—'}</td>
                    <td>{o.courseTitle}</td>
                    <td>{new Date(o.dueDate).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="st--fail cell-strong">{o.daysOverdue}d</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CourseReportSection() {
  const { token } = useAuth();
  const [courseId, setCourseId] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const coursesQuery = useQuery({
    queryKey: ['courses', 'all'],
    queryFn: () => listCourses(token!, { status: 'all' }),
    enabled: Boolean(token),
  });
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => listDepartments(token!),
    enabled: Boolean(token),
  });
  const reportQuery = useQuery({
    queryKey: ['course-report', courseId, departmentId],
    queryFn: () =>
      getCourseReport(token!, courseId, departmentId ? { departmentId } : {}),
    enabled: Boolean(token) && Boolean(courseId),
  });

  const report = reportQuery.data;

  return (
    <div className="stack">
      <div className="filterbar">
        <Field label="Course" htmlFor="report-course" className="grow">
          <select id="report-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Select a course…</option>
            {(coursesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.status})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Department" htmlFor="report-department" className="grow">
          <select
            id="report-department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">All departments</option>
            {(departmentsQuery.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {reportQuery.isFetching && !report && <SkeletonRows rows={5} cols={6} />}

      {report && (
        <div className="stack">
          <div className="kgrid">
            <Kpi label="Assigned" value={report.total} />
            <Kpi label="Completed" value={<span className="st--pass">{report.completed}</span>} />
            <Kpi label="In progress" value={report.inProgress} />
            <Kpi label="Not started" value={report.notStarted} />
            <Kpi
              label="Avg score"
              value={report.averageScore !== null ? `${report.averageScore}%` : '—'}
            />
          </div>

          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Department</th>
                  <th>Slides</th>
                  <th>Best score</th>
                  <th>Attempts</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Transcript</th>
                </tr>
              </thead>
              <tbody>
                {report.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="tableempty">
                      No assignments for this filter.
                    </td>
                  </tr>
                )}
                {report.items.map((row) => (
                  <tr key={row.userId}>
                    <td>
                      <span className="cell-strong">{row.fullName}</span>
                    </td>
                    <td>{row.departmentName ?? '—'}</td>
                    <td>
                      {row.slidesViewed}/{row.slideCount}
                    </td>
                    <td>{row.bestScore !== null ? `${row.bestScore}%` : '—'}</td>
                    <td>{row.attemptsUsed}</td>
                    <td>
                      <Pill tone={statusTone[row.status]}>{statusLabel[row.status]}</Pill>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <ButtonLink href={`/reports/staff/${row.userId}`} sm>
                        View
                      </ButtonLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffTranscriptPanel({ userId }: { userId: string }) {
  const { token } = useAuth();
  const transcriptQuery = useQuery({
    queryKey: ['staff-transcript', userId],
    queryFn: () => getStaffTranscript(token!, userId),
    enabled: Boolean(token),
  });

  if (transcriptQuery.isLoading) return <SkeletonRows rows={5} cols={5} />;
  if (transcriptQuery.isError) {
    return <Alert tone="error">Failed to load transcript.</Alert>;
  }

  const t = transcriptQuery.data!;

  return (
    <div className="stack">
      <div className="card">
        <h2>{t.fullName}</h2>
        <p className="text-muted text-sm">
          {t.jobTitle ?? '—'} · {t.departmentName ?? 'No department'}
        </p>
        <p className="mono text-muted mt-sm">
          {t.completedCourses}/{t.assignedCourses} courses completed
        </p>
      </div>

      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Course</th>
              <th>Slides</th>
              <th>Best score</th>
              <th>Attempts</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {t.items.length === 0 && (
              <tr>
                <td colSpan={6} className="tableempty">
                  No assigned courses.
                </td>
              </tr>
            )}
            {t.items.map((item) => (
              <tr key={item.courseId}>
                <td>
                  <span className="cell-strong">{item.courseTitle}</span>
                </td>
                <td>
                  {item.slidesViewed}/{item.slideCount}
                </td>
                <td>{item.bestScore !== null ? `${item.bestScore}%` : '—'}</td>
                <td>{item.attemptsUsed}</td>
                <td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</td>
                <td>
                  <Pill tone={statusTone[item.status]}>{statusLabel[item.status]}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffTranscriptSection() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const preselected = searchParams.get('staffId') ?? '';
  const [staffId, setStaffId] = useState(preselected);

  const staffListQuery = useQuery({
    queryKey: ['staff'],
    queryFn: () => listStaff(token!),
    enabled: Boolean(token),
  });

  return (
    <div className="stack">
      <Field label="Staff member" htmlFor="report-staff" className="grow">
        <select id="report-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="">Select staff…</option>
          {(staffListQuery.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </select>
      </Field>
      {staffId && <StaffTranscriptPanel userId={staffId} />}
    </div>
  );
}

type Tab = 'dashboard' | 'courses' | 'staff';

function ReportsContent() {
  const [tab, setTab] = useState<Tab>('dashboard');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'courses', label: 'Course report' },
    { key: 'staff', label: 'Staff transcript' },
  ];

  return (
    <div>
      <PageHead
        title="Reports & Dashboard"
        sub="Best-attempt scores; completion = quiz passed (Module 11)."
      />
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className="tab"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <DashboardSection />}
      {tab === 'courses' && <CourseReportSection />}
      {tab === 'staff' && <StaffTranscriptSection />}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <ReportsContent />
      </Suspense>
    </ProtectedRoute>
  );
}
