'use client';

import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/protected-route';
import { ButtonLink, EmptyState, Icon, PageHead, Pill, Progress, SkeletonRows } from '@/components/ui';
import { cx } from '@/components/utils';
import { useAuth } from '@/lib/auth-context';
import { getMyTraining, type MyTrainingItem } from '@/lib/assignments-api';

function dueInfo(dueDate: string | null): { label: string; overdue: boolean } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return { label: `Overdue by ${Math.abs(days)}d`, overdue: true };
  if (days === 0) return { label: 'Due today', overdue: true };
  if (days <= 7) return { label: `Due in ${days}d`, overdue: true };
  return { label: `Due ${due.toLocaleDateString()}`, overdue: false };
}

function TrainingRow({ item }: { item: MyTrainingItem }) {
  const percent =
    item.slideCount === 0
      ? 0
      : Math.min(100, Math.round((item.slidesViewed / item.slideCount) * 100));
  const due = dueInfo(item.dueDate);
  const hasQuiz = (item.quizQuestionCount ?? 0) > 0;

  const action = item.quizPassed
    ? { href: `/viewer?courseId=${item.courseId}`, label: 'Review course' }
    : item.slideCount === 0
      ? null
      : { href: `/viewer?courseId=${item.courseId}`, label: 'Continue' };

  return (
    <div className="courserow">
      <div className="grow">
        <p className="courserow__title">{item.courseTitle}</p>
        {item.courseDescription && <p className="courserow__meta">{item.courseDescription}</p>}
        <div className="row mt-sm" style={{ gap: 'var(--space-md)' }}>
          <span className="mono">
            {item.slidesViewed} / {item.slideCount} slides · {percent}%
          </span>
          {item.quizPassed && (
            <Pill tone="pass">
              <Icon name="check" className="st--pass" /> Passed
            </Pill>
          )}
          {!item.quizPassed && item.allSlidesViewed && hasQuiz && (
            <Pill tone="info">Quiz unlocked</Pill>
          )}
          {!item.quizPassed && !hasQuiz && item.allSlidesViewed && (
            <Pill>No quiz</Pill>
          )}
        </div>
        <div className="mt-sm" style={{ maxWidth: '22rem' }}>
          <Progress value={percent} done={item.quizPassed ?? false} />
        </div>
      </div>

      <div className="courserow__due mono">
        {due ? <strong className={cx(due.overdue && 'st--fail')}>{due.label}</strong> : '—'}
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {item.allSlidesViewed && !item.quizPassed && hasQuiz && (
          <ButtonLink href={`/quiz-taking?courseId=${item.courseId}`} variant="primary" sm>
            Take quiz
          </ButtonLink>
        )}
        {action ? (
          <ButtonLink href={action.href} sm>
            {action.label}
          </ButtonLink>
        ) : (
          <Pill>No slides</Pill>
        )}
      </div>
    </div>
  );
}

function MyTrainingContent() {
  const { token } = useAuth();

  const trainingQuery = useQuery({
    queryKey: ['my-training'],
    queryFn: () => getMyTraining(token!),
    enabled: Boolean(token),
  });

  const items = trainingQuery.data ?? [];
  const active = items.filter((i) => !i.quizPassed);
  const done = items.filter((i) => i.quizPassed);

  return (
    <div>
      <PageHead
        eyebrow="My training"
        title="Assigned courses"
        sub="Courses assigned to you. Read all slides to unlock the quiz."
      />

      {trainingQuery.isLoading && <SkeletonRows rows={4} cols={3} />}
      {trainingQuery.isError && (
        <div className="alert alert--error">Failed to load your training.</div>
      )}

      {!trainingQuery.isLoading && items.length === 0 && (
        <EmptyState
          icon="book"
          title="No assigned courses"
          action={
            <ButtonLink href="/catalog" variant="primary" sm>
              Browse catalog
            </ButtonLink>
          }
        >
          Nothing assigned yet. Browse the training catalog to see what&apos;s available.
        </EmptyState>
      )}

      {active.length > 0 && (
        <div className="section">
          <h2>In progress ({active.length})</h2>
          <div className="courselist">
            {active.map((item) => (
              <TrainingRow key={item.assignmentId} item={item} />
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div className="section">
          <h2>Completed ({done.length})</h2>
          <div className="courselist">
            {done.map((item) => (
              <TrainingRow key={item.assignmentId} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyTrainingPage() {
  return (
    <ProtectedRoute>
      <MyTrainingContent />
    </ProtectedRoute>
  );
}
