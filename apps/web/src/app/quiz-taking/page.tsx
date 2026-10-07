'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { Button, ButtonLink, Icon, PageHead, Pill, Progress } from '@/components/ui';
import { cx } from '@/components/utils';
import { useAuth } from '@/lib/auth-context';
import { fetchQuestionImage } from '@/lib/questions-api';
import {
  getAttempt,
  getQuizEligibility,
  startQuizAttempt,
  submitQuizAttempt,
  type Attempt,
  type SubmitResult,
} from '@/lib/quiz-attempts-api';
import { ApiError } from '@/lib/api';

function QuestionImage({
  courseId,
  questionId,
  hasImage,
}: {
  courseId: string;
  questionId: string;
  hasImage: boolean;
}) {
  const { token } = useAuth();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasImage) return;
    let active = true;
    let objectUrl: string | null = null;
    fetchQuestionImage(token!, courseId, questionId).then((result) => {
      if (!active) {
        if (result) URL.revokeObjectURL(result);
        return;
      }
      objectUrl = result;
      setUrl(result);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [courseId, questionId, hasImage, token]);

  if (!hasImage || !url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Question" style={{ maxHeight: '14rem' }} />
  );
}

function EligibilityGate({ courseId, onGoBack }: { courseId: string; onGoBack: () => void }) {
  const { token } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const eligibilityQuery = useQuery({
    queryKey: ['quiz-eligibility', courseId],
    queryFn: () => getQuizEligibility(token!, courseId),
    enabled: Boolean(token),
  });

  const startMutation = useMutation({
    mutationFn: () => startQuizAttempt(token!, courseId),
    onSuccess: (attempt: Attempt) => {
      window.location.href = `/quiz-taking?courseId=${courseId}&attemptId=${attempt.attemptId}`;
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not start the quiz.'),
  });

  if (eligibilityQuery.isLoading) {
    return <p className="mono text-muted">Checking quiz availability…</p>;
  }
  if (eligibilityQuery.isError) {
    return <div className="alert alert--error">Failed to check quiz availability.</div>;
  }

  const e = eligibilityQuery.data!;
  const quizConfigured = e.quizConfigured;
  const blockers: string[] = [];
  if (!e.assigned) blockers.push('You are not assigned to this course.');
  if (!quizConfigured) {
    blockers.push(
      `Quiz is not configured yet (needs at least one set of ${e.minQuestions}+ questions).`,
    );
  }
  if (!e.allSlidesViewed) blockers.push('View all slides before starting the quiz.');
  if (e.passed) blockers.push('Course already completed — nothing to do.');

  const check = (ok: boolean, label: string) => (
    <li className={cx('row', ok ? 'st--pass' : 'st--fail')} style={{ gap: 'var(--space-xs)' }}>
      <span className="st">
        <Icon name={ok ? 'check' : 'x'} />
      </span>
      {label}
    </li>
  );

  return (
    <div className="card" style={{ maxWidth: '34rem' }}>
      <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>Quiz status</h2>
      <ul className="mt-md" style={{ listStyle: 'none', padding: 0 }}>
        {check(e.assigned, 'Assigned to course')}
        {check(e.allSlidesViewed, 'All slides viewed')}
        {check(
          quizConfigured,
          `Quiz configured (${e.validSetCount} set${e.validSetCount === 1 ? '' : 's'})`,
        )}
      </ul>

      {(e.attemptsUsed > 0 || e.bestScore !== null) && (
        <div className="strip" style={{ marginTop: 'var(--space-md)', marginBottom: 0 }}>
          {e.attemptsUsed > 0 && (
            <span className="mono">
              Attempts ·{' '}
              <strong>
                {e.attemptsUsed}
                {e.attemptsLeft !== null ? ` · ${e.attemptsLeft} left` : ' · unlimited'}
              </strong>
            </span>
          )}
          {e.bestScore !== null && (
            <span className="mono">
              Best · <strong>{e.bestScore}%</strong>
            </span>
          )}
        </div>
      )}

      {blockers.length > 0 && !e.resumeAttemptId && (
        <div className="alert mt-md">
          <ul style={{ margin: 0, paddingInlineStart: '1.1em' }}>
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="alert alert--error mt-md">{error}</div>}

      <div className="row mt-lg">
        {e.resumeAttemptId && (
          <ButtonLink
            href={`/quiz-taking?courseId=${courseId}&attemptId=${e.resumeAttemptId}`}
            variant="primary"
          >
            Resume attempt
          </ButtonLink>
        )}
        {!e.resumeAttemptId && e.quizReady && (
          <Button
            variant="primary"
            onClick={() => {
              setError(null);
              startMutation.mutate();
            }}
            disabled={startMutation.isPending}
          >
            {startMutation.isPending ? 'Starting…' : 'Start quiz'}
          </Button>
        )}
        <Button variant="ghost" onClick={onGoBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function Runner({
  attempt,
  onFinished,
  onGoBack,
}: {
  attempt: Attempt;
  onFinished: (result: SubmitResult) => void;
  onGoBack: () => void;
}) {
  const { token } = useAuth();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const question = attempt.questions[index];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === attempt.questions.length;

  const submitMutation = useMutation({
    mutationFn: () =>
      submitQuizAttempt(
        token!,
        attempt.attemptId,
        attempt.questions.map((q) => ({
          questionId: q.questionId,
          selectedOptionIds: answers[q.questionId] ?? [],
        })),
      ),
    onSuccess: onFinished,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Submit failed.'),
  });

  const select = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: [optionId] }));
  };

  return (
    <div style={{ maxWidth: '44rem' }}>
      <div className="qprogress">
        <span className="mono">
          Question {index + 1} / {attempt.questions.length}
        </span>
        <Progress value={(answeredCount / attempt.questions.length) * 100} />
        <span className="mono">
          {answeredCount}/{attempt.questions.length} answered
        </span>
      </div>

      <div className="question">
        <span className="mono qtype">
          {question.type === 'true_false' ? 'True / false' : 'Multiple choice'}
        </span>
        <h2 tabIndex={-1}>{question.text}</h2>

        {question.imagePath && (
          <figure className="qfigure" style={{ padding: 'var(--space-md)' }}>
            <QuestionImage courseId={attempt.courseId} questionId={question.questionId} hasImage />
          </figure>
        )}

        <div className="opts" role="radiogroup" aria-labelledby="q-text">
          {question.options.map((o) => {
            const selected = answers[question.questionId]?.includes(o.optionId) ?? false;
            return (
              <label key={o.optionId} className={cx('opt', selected && 'is-checked')}>
                <input
                  type="radio"
                  name={question.questionId}
                  checked={selected}
                  onChange={() => select(question.questionId, o.optionId)}
                />
                <span className="opt__dot" aria-hidden="true" />
                <span className="opt__text">{o.text}</span>
              </label>
            );
          })}
        </div>
      </div>

      {error && <div className="alert alert--error mt-md">{error}</div>}

      <div className="quiz__actions">
        <Button variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          <Icon name="arrow-left" />
          Back
        </Button>
        <span className="spacer" />
        {!allAnswered && (
          <span className="quiz__hint">Answer all questions to submit</span>
        )}
        {index < attempt.questions.length - 1 ? (
          <Button variant="primary" onClick={() => setIndex((i) => i + 1)}>
            Next question
            <Icon name="arrow-right" />
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => {
              if (!allAnswered) {
                setError('Answer all questions before submitting.');
                return;
              }
              setError(null);
              if (window.confirm(`Submit ${attempt.questions.length} answers for scoring?`)) {
                submitMutation.mutate();
              }
            }}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Scoring…' : 'Submit quiz'}
          </Button>
        )}
      </div>

      <div className="tabs mt-lg">
        {attempt.questions.map((q, i) => (
          <button
            key={q.questionId}
            type="button"
            className="tab"
            aria-pressed={i === index}
            title={`Question ${i + 1}`}
            onClick={() => setIndex(i)}
          >
            {String(i + 1).padStart(2, '0')}
            {answers[q.questionId] ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <button type="button" className="backlink mt-md" onClick={onGoBack}>
        Quit for now — progress is kept in this attempt
      </button>
    </div>
  );
}

function Results({
  result,
  onRetry,
  onGoBack,
}: {
  result: SubmitResult;
  onRetry: () => void;
  onGoBack: () => void;
}) {
  return (
    <div className="results" style={{ maxWidth: '44rem' }}>
      <p className="mono eyebrow">Result · attempt {result.attemptNumber}</p>
      <div className="results__score">
        <span className="score">{result.scorePercent}%</span>
        <span className={cx('verdict', result.passed ? 'verdict--pass' : 'verdict--fail')}>
          <Icon name={result.passed ? 'check' : 'x'} />
          {result.passed ? 'Passed' : 'Not passed'}
        </span>
      </div>
      <p className="results__sub">
        {result.correctAnswers}/{result.totalQuestions} correct · passing score {result.passingScore}
        %{result.passed ? ' · course complete' : ''}
      </p>

      <div className="results__actions">
        {result.passed ? (
          <ButtonLink href="/my-training" variant="primary">
            Back to My Training
          </ButtonLink>
        ) : result.canRetry ? (
          <Button variant="primary" onClick={onRetry}>
            Retry quiz
            {result.attemptsLeft !== null ? ` (${result.attemptsLeft} left)` : ''}
          </Button>
        ) : (
          <Pill tone="fail">No retries remaining</Pill>
        )}
        <Button variant="ghost" onClick={onGoBack}>
          Back
        </Button>
      </div>

      <div className="review">
        <h2>Answer review</h2>
        <div>
          {result.results.map((r, i) => (
            <div key={r.questionId} className="reviewrow">
              <span className={cx('st', r.isCorrect ? 'st--pass' : 'st--fail')}>
                <Icon name={r.isCorrect ? 'check' : 'x'} />
              </span>
              <div>
                <p className="reviewrow__q">
                  Question {i + 1}. {r.questionText}
                </p>
                {!r.isCorrect && r.selectedOptionTexts.length > 0 && (
                  <p className="reviewrow__a is-wrong">
                    <strong>Your answer:</strong> {r.selectedOptionTexts.join(', ')}
                  </p>
                )}
                <p className={cx('reviewrow__a', r.isCorrect ? 'is-right' : 'is-correct')}>
                  <strong>Correct answer:</strong> {r.correctOptionTexts.join(', ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuizTakingContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');
  const attemptId = searchParams.get('attemptId');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { token } = useAuth();

  const resumeQuery = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => getAttempt(token!, attemptId!),
    enabled: Boolean(token && attemptId),
  });

  useEffect(() => {
    if (resumeQuery.data) setAttempt(resumeQuery.data);
  }, [resumeQuery.data]);

  const goBack = () => {
    window.location.href = `/my-training`;
  };

  const content = useMemo(() => {
    if (!courseId) {
      return (
        <div className="alert">
          No course selected.{' '}
          <Link href="/my-training" style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
            Go to My Training
          </Link>
          .
        </div>
      );
    }
    if (loadError) {
      return (
        <div className="alert alert--error">
          {loadError}{' '}
          <button
            onClick={() => {
              setAttempt(null);
              setLoadError(null);
            }}
            className="backlink"
          >
            Back to status
          </button>
        </div>
      );
    }
    if (result) {
      return (
        <Results
          result={result}
          onRetry={() => {
            setResult(null);
            setAttempt(null);
          }}
          onGoBack={goBack}
        />
      );
    }
    if (attempt) {
      return <Runner attempt={attempt} onFinished={setResult} onGoBack={goBack} />;
    }
    if (attemptId && resumeQuery.isLoading) {
      return <p className="mono text-muted">Loading attempt…</p>;
    }
    return <EligibilityGate courseId={courseId} onGoBack={goBack} />;
  }, [courseId, attemptId, attempt, result, loadError, resumeQuery.isLoading]);

  return (
    <div>
      <PageHead eyebrow="Quiz" title="Knowledge check" />
      {content}
    </div>
  );
}

export default function QuizTakingPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <p className="mono text-muted" style={{ paddingBlock: 'var(--space-xl)' }}>
            Loading…
          </p>
        }
      >
        <QuizTakingContent />
      </Suspense>
    </ProtectedRoute>
  );
}
