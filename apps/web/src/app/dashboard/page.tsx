'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/protected-route';
import {
  EmptyState,
  Icon,
  Kpi,
  PageHead,
  Pill,
  Skeleton,
  type IconName,
} from '@/components/ui';
import { cx } from '@/components/utils';
import { useAuth } from '@/lib/auth-context';
import {
  getDashboardReport,
  getOverdueReport,
  type DashboardReport,
  type OverdueItem,
} from '@/lib/reports-api';

interface QuickLink {
  href: string;
  title: string;
  desc: string;
  icon: IconName;
}

const ADMIN_LINKS: QuickLink[] = [
  { href: '/users', title: 'Users & approvals', desc: 'Review pending registrations', icon: 'users' },
  { href: '/departments', title: 'Departments', desc: 'Create and manage departments', icon: 'building' },
  { href: '/staff', title: 'Staff', desc: 'Search and manage staff records', icon: 'user' },
  { href: '/courses', title: 'Courses', desc: 'Create courses, manage slides & question banks', icon: 'book' },
  { href: '/assignments', title: 'Assignments', desc: 'Assign courses to staff and departments', icon: 'clipboard' },
  { href: '/reports', title: 'Reports', desc: 'Completion rates, overdue, transcripts', icon: 'chart' },
  { href: '/settings', title: 'Settings', desc: 'Company name and course defaults', icon: 'settings' },
  { href: '/audit', title: 'Audit log', desc: 'Who did what, and when', icon: 'shield' },
];

const STAFF_LINKS: QuickLink[] = [
  { href: '/my-training', title: 'My training', desc: 'Your assigned courses and progress', icon: 'book' },
  { href: '/catalog', title: 'Training catalog', desc: 'Browse published courses', icon: 'layers' },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning, ';
  if (hour < 18) return 'Good afternoon, ';
  return 'Good evening, ';
}

function AdminKpis({ data, loading }: { data?: DashboardReport; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="kgrid kgrid--dashboard">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi">
            <Skeleton height="0.7rem" width="55%" />
            <div className="mt-sm">
              <Skeleton height="1.8rem" width="40%" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="kgrid kgrid--dashboard">
      <Kpi
        label="Completion rate"
        value={`${data.completionRate}%`}
        tone="pass"
        icon="check"
        delta={`${data.completedAssignments} of ${data.totalAssignments} assignments`}
      />
      <Kpi
        label="Overdue"
        value={data.overdueAssignments}
        tone={data.overdueAssignments > 0 ? 'fail' : 'neutral'}
        icon="bell"
        delta={data.overdueAssignments > 0 ? 'Needs follow-up' : 'All on track'}
      />
      <Kpi
        label="Avg best score"
        value={data.averageBestScore !== null ? `${data.averageBestScore}%` : '—'}
        tone="info"
        icon="chart"
        delta={`${data.totalAttempts} quiz attempts`}
      />
      <Kpi
        label="Pending approvals"
        value={data.pendingApprovals}
        tone={data.pendingApprovals > 0 ? 'info' : 'neutral'}
        icon="users"
        delta={`${data.totalUsers} active users`}
      />
    </div>
  );
}

function OverduePanel({ items, loading }: { items?: OverdueItem[]; loading: boolean }) {
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Overdue learners</h2>
        <Link href="/reports" className="backlink">
          View reports
          <Icon name="arrow-right" />
        </Link>
      </div>
      {loading && <p className="listnote mono">Loading…</p>}
      {!loading && items && items.length === 0 && (
        <EmptyState icon="check" title="Nothing overdue">
          Every assigned learner is on track.
        </EmptyState>
      )}
      {!loading && items && items.length > 0 && (
        <div className="tablewrap mt-md">
          <table className="tbl">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Course</th>
                <th>Due</th>
                <th style={{ textAlign: 'right' }}>Days over</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.assignmentId}>
                  <td>
                    <p className="cell-strong">{o.fullName}</p>
                    <p className="text-muted text-sm">{o.departmentName ?? 'No department'}</p>
                  </td>
                  <td>{o.courseTitle}</td>
                  <td className="num">{new Date(o.dueDate).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Pill tone="fail">{o.daysOverdue}d</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QuickLinks({ links }: { links: QuickLink[] }) {
  return (
    <div className="cardgrid">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="cardlink">
          <span className="quicklink__icon" aria-hidden="true">
            <Icon name={link.icon} />
          </span>
          <span className="cardlink__title">{link.title}</span>
          <span className="cardlink__desc">{link.desc}</span>
        </Link>
      ))}
    </div>
  );
}

function DashboardContent() {
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'administrator';

  const dashboardQuery = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: () => getDashboardReport(token!),
    enabled: Boolean(token) && isAdmin,
  });
  const overdueQuery = useQuery({
    queryKey: ['reports-overdue'],
    queryFn: () => getOverdueReport(token!),
    enabled: Boolean(token) && isAdmin,
  });

  if (!user) return null;

  return (
    <div>
      <div className="welcome">
        <div className="welcome__text">
          <p className="mono eyebrow">{isAdmin ? 'Administration' : 'My training'}</p>
          <h1 className="welcome__title">
            {greeting()}
            <span className="welcome__accent">{user.fullName}</span>
          </h1>
          <p className="welcome__sub">
            Signed in as <strong>{user.username}</strong> · {isAdmin ? 'Administrator' : 'Staff'} ·{' '}
            {user.authProvider === 'ad' ? 'Active Directory' : 'Local account'}
          </p>
        </div>
        <div className="welcome__art" aria-hidden="true">
          <span className="welcome__blob welcome__blob--a" />
          <span className="welcome__blob welcome__blob--b" />
          <span className="welcome__blob welcome__blob--c" />
        </div>
      </div>

      {isAdmin ? (
        <div className="stack">
          <AdminKpis data={dashboardQuery.data} loading={dashboardQuery.isLoading} />
          <OverduePanel items={overdueQuery.data} loading={overdueQuery.isLoading} />
          <div className="section">
            <h2>Manage</h2>
            <QuickLinks links={ADMIN_LINKS} />
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className={cx('card', 'welcome-card')}>
            <span className="quicklink__icon" aria-hidden="true">
              <Icon name="book" />
            </span>
            <p className="text-muted text-sm">
              Pick up where you left off — read your slides, then take the quiz to complete each
              course.
            </p>
          </div>
          <QuickLinks links={STAFF_LINKS} />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
