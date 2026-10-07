'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  Field,
  Icon,
  PageHead,
  Pill,
  SkeletonRows,
} from '@/components/ui';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import { getCourse } from '@/lib/admin-api';
import { getQuizConfig, updateQuizConfig } from '@/lib/quiz-config-api';
import { ApiError } from '@/lib/api';

function counterTone(count: number, min: number): 'neutral' | 'info' | 'pass' {
  if (count === 0) return 'neutral';
  if (count < min) return 'info';
  return 'pass';
}

function useCourse(courseId: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourse(token!, courseId!),
    enabled: Boolean(token && courseId),
  });
}

function SettingsForm({
  courseId,
  initial: { passingScore, allowRetake, maxAttempts, shuffleQuestions, shuffleOptions },
  onError,
}: {
  courseId: string;
  initial: {
    passingScore: number;
    allowRetake: boolean;
    maxAttempts: number | null;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
  };
  onError: (message: string) => void;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [score, setScore] = useState(String(passingScore));
  const [retake, setRetake] = useState(allowRetake);
  const [attempts, setAttempts] = useState(maxAttempts?.toString() ?? '');
  const [shuffleQ, setShuffleQ] = useState(shuffleQuestions);
  const [shuffleO, setShuffleO] = useState(shuffleOptions);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setScore(String(passingScore));
    setRetake(allowRetake);
    setAttempts(maxAttempts?.toString() ?? '');
    setShuffleQ(shuffleQuestions);
    setShuffleO(shuffleOptions);
  }, [passingScore, allowRetake, maxAttempts, shuffleQuestions, shuffleOptions]);

  const parsedScore = Number(score);
  const parsedAttempts = attempts === '' ? null : Number(attempts);
  const valid =
    Number.isInteger(parsedScore) &&
    parsedScore >= 1 &&
    parsedScore <= 100 &&
    (parsedAttempts === null || (Number.isInteger(parsedAttempts) && parsedAttempts >= 1));

  const saveMutation = useMutation({
    mutationFn: () =>
      updateQuizConfig(token!, courseId, {
        passingScore: parsedScore,
        allowRetake: retake,
        maxAttempts: retake ? parsedAttempts : null,
        shuffleQuestions: shuffleQ,
        shuffleOptions: shuffleO,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-config', courseId] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setSaved(true);
      toast.success('Quiz rules saved.');
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => onError(e instanceof ApiError ? e.message : 'Save failed.'),
  });

  return (
    <div className="card">
      <h2>Scoring &amp; retry rules</h2>
      <div className="grid2 mt-md">
        <Field label="Pass score %" htmlFor="quiz-pass-score">
          <input
            id="quiz-pass-score"
            type="number"
            min={1}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </Field>
        <Field label="Allow retake" htmlFor="quiz-allow-retake">
          <select
            id="quiz-allow-retake"
            value={retake ? 'yes' : 'no'}
            onChange={(e) => setRetake(e.target.value === 'yes')}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="Max attempts" htmlFor="quiz-max-attempts">
          <input
            id="quiz-max-attempts"
            type="number"
            min={1}
            placeholder="∞"
            value={attempts}
            onChange={(e) => setAttempts(e.target.value)}
            disabled={!retake}
          />
        </Field>
        <Field label="Shuffle questions" htmlFor="quiz-shuffle-questions">
          <select
            id="quiz-shuffle-questions"
            value={shuffleQ ? 'yes' : 'no'}
            onChange={(e) => setShuffleQ(e.target.value === 'yes')}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="Shuffle options" htmlFor="quiz-shuffle-options">
          <select
            id="quiz-shuffle-options"
            value={shuffleO ? 'yes' : 'no'}
            onChange={(e) => setShuffleO(e.target.value === 'yes')}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      </div>
      <p className="text-muted text-sm mt-sm">
        Shuffling presents each staff member a different question and option order.
      </p>
      {localError && (
        <Alert tone="error" className="mt-sm">
          {localError}
        </Alert>
      )}
      <div className="row mt-md" style={{ justifyContent: 'flex-end' }}>
        {saved && <span className="st--pass text-sm">Saved ✓</span>}
        <Button
          variant="primary"
          onClick={() => {
            setSaved(false);
            setLocalError(null);
            if (!valid) {
              setLocalError('Pass score must be 1–100; max attempts must be ≥1.');
              return;
            }
            saveMutation.mutate();
          }}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save rules'}
        </Button>
      </div>
    </div>
  );
}

function QuizBuilder({ courseId }: { courseId: string }) {
  const { token } = useAuth();
  const courseQuery = useCourse(courseId);
  const configQuery = useQuery({
    queryKey: ['quiz-config', courseId],
    queryFn: () => getQuizConfig(token!, courseId),
    enabled: Boolean(token),
  });
  const [error, setError] = useState<string | null>(null);

  if (courseQuery.isLoading || configQuery.isLoading) {
    return (
      <div className="stack">
        <SkeletonRows rows={3} cols={2} />
        <SkeletonRows rows={3} cols={2} />
      </div>
    );
  }
  if (courseQuery.isError || configQuery.isError) {
    return (
      <Alert tone="error">
        Failed to load quiz data.{' '}
        <Link href="/courses" className="backlink">
          Back to courses
        </Link>
      </Alert>
    );
  }

  const course = courseQuery.data!;
  const config = configQuery.data!;
  const setCounts = new Map(config.sets.map((s) => [s.setIndex, s.count]));

  return (
    <div className="stack">
      <div className="card">
        <div className="row">
          <div className="grow">
            <h2>{course.title}</h2>
            <p className="text-muted text-sm">
              Status: {course.status}
              {course.status !== 'published' &&
                config.isValid &&
                ' · quiz valid — course ready to publish (slides permitting)'}
            </p>
          </div>
          <Pill tone={config.isValid ? 'pass' : 'neutral'}>
            {config.isValid ? 'Quiz valid' : 'No valid set yet'}
          </Pill>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="card">
        <div className="row">
          <div className="grow">
            <h2>Question sets</h2>
            <p className="text-muted text-sm">
              Question templates belong to this course. Build up to 3 sets so each staff member
              receives a different randomized set. Each set needs at least{' '}
              {config.minQuestions} questions.
            </p>
          </div>
          <ButtonLink variant="primary" href={`/questions?courseId=${courseId}`}>
            <Icon name="question" /> Manage questions
          </ButtonLink>
        </div>
        <div className="row mt-md" style={{ gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          {[1, 2, 3].map((n) => {
            const count = setCounts.get(n) ?? 0;
            return (
              <Pill
                key={n}
                tone={counterTone(count, config.minQuestions)}
              >
                Set {n}: {count}
                {count > 0 &&
                  (count >= config.minQuestions
                    ? ' · valid'
                    : ` · need ${config.minQuestions - count} more`)}
              </Pill>
            );
          })}
        </div>
        {config.questionCount === 0 && (
          <EmptyState icon="question" title="No questions yet">
            Create questions one by one or bulk-import them into a set from the{' '}
            <Link href={`/questions?courseId=${courseId}`} className="backlink">
              question bank
            </Link>
            .
          </EmptyState>
        )}
      </div>

      <SettingsForm
        courseId={courseId}
        initial={{
          passingScore: config.passingScore,
          allowRetake: config.allowRetake,
          maxAttempts: config.maxAttempts,
          shuffleQuestions: config.shuffleQuestions,
          shuffleOptions: config.shuffleOptions,
        }}
        onError={setError}
      />
    </div>
  );
}

function QuizBuilderContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  return (
    <div>
      <PageHead
        title="Quiz builder"
        sub="Review question sets and set scoring rules (Module 8)."
        back={{ href: '/courses', label: 'Back to courses' }}
      />
      {courseId ? (
        <QuizBuilder courseId={courseId} />
      ) : (
        <Alert>
          No course selected.{' '}
          <Link href="/courses" className="backlink">
            Pick a course
          </Link>
          .
        </Alert>
      )}
    </div>
  );
}

export default function QuizBuilderPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <QuizBuilderContent />
      </Suspense>
    </ProtectedRoute>
  );
}
