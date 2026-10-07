'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Icon,
  Modal,
  PageHead,
  Pill,
  SkeletonRows,
} from '@/components/ui';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import { getCourse } from '@/lib/admin-api';
import {
  bulkCreateQuestions,
  createQuestion,
  deleteQuestion,
  deleteQuestionImage,
  fetchQuestionImage,
  listQuestions,
  reorderQuestions,
  updateQuestion,
  uploadQuestionImage,
  type BulkImportResult,
  type Question,
  type QuestionType,
} from '@/lib/questions-api';
import { getQuizConfig } from '@/lib/quiz-config-api';
import { ApiError } from '@/lib/api';

const typeLabel: Record<QuestionType, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
};

const SETS = [1, 2, 3] as const;

function counterTone(count: number, min: number): 'neutral' | 'info' | 'pass' {
  if (count === 0) return 'neutral';
  if (count < min) return 'info';
  return 'pass';
}

function setCounterText(count: number, min: number): string {
  if (count === 0) return `Set needs ${min}+ questions`;
  if (count < min) return `need ${min - count} more`;
  return 'valid';
}

/* ================= question thumbnail (loads image if present) ================= */
function QuestionThumb({ courseId, question }: { courseId: string; question: Question }) {
  const { token } = useAuth();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!question.imagePath) return;
    let active = true;
    let objectUrl: string | null = null;
    fetchQuestionImage(token!, courseId, question.id).then((result) => {
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
  }, [courseId, question.id, question.imagePath, token]);

  if (!question.imagePath) {
    return (
      <span className="qcard__thumb qcard__thumb--empty" aria-hidden="true">
        <Icon name="question" />
      </span>
    );
  }
  if (!url) {
    return <span className="qcard__thumb qcard__thumb--empty" aria-hidden="true" />;
  }
  return (
    <span className="qcard__thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" />
    </span>
  );
}

/* ================= option editor (single create) ================= */
function OptionEditor({
  options,
  onChange,
}: {
  options: { text: string; isCorrect: boolean }[];
  onChange: (next: { text: string; isCorrect: boolean }[]) => void;
}) {
  const setCorrect = (index: number) =>
    onChange(options.map((o, i) => ({ ...o, isCorrect: i === index })));

  return (
    <div className="stack">
      {options.map((o, i) => (
        <div key={i} className="optedit">
          <button
            type="button"
            className={`optedit__radio${o.isCorrect ? ' is-correct' : ''}`}
            onClick={() => setCorrect(i)}
            title={o.isCorrect ? 'Correct answer' : 'Mark as correct'}
            aria-pressed={o.isCorrect}
          >
            {o.isCorrect && <Icon name="check" />}
          </button>
          <input
            className="optedit__input"
            value={o.text}
            onChange={(e) =>
              onChange(options.map((opt, j) => (j === i ? { ...opt, text: e.target.value } : opt)))
            }
            placeholder={`Option ${String.fromCharCode(65 + i)}`}
            aria-label={`Option ${String.fromCharCode(65 + i)}`}
          />
          {options.length > 2 && (
            <button
              type="button"
              className="optedit__remove"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              title="Remove option"
              aria-label="Remove option"
            >
              <Icon name="x" />
            </button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <Button sm onClick={() => onChange([...options, { text: '', isCorrect: false }])}>
          + Add option
        </Button>
      )}
      <p className="text-muted text-sm">
        Click the circle next to the correct answer. At least 2 options, exactly 1 correct.
      </p>
    </div>
  );
}

/* ================= single create / edit form ================= */
function QuestionForm({
  courseId,
  activeSet,
  question,
  onClose,
}: {
  courseId: string;
  activeSet: number;
  question: Question | null;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState<QuestionType>(question?.type ?? 'multiple_choice');
  const [text, setText] = useState(question?.text ?? '');
  const [setIndex, setSetIndex] = useState(question?.setIndex ?? activeSet);
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean }[]>(
    question?.type === 'true_false'
      ? [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false },
        ]
      : (question?.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) ?? [
          { text: '', isCorrect: true },
          { text: '', isCorrect: false },
        ]),
  );
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // local preview of a newly chosen file
  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['questions', courseId] });
    queryClient.invalidateQueries({ queryKey: ['quiz-config', courseId] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (question) {
        const updated = await updateQuestion(token!, courseId, question.id, {
          text,
          options,
          setIndex,
        });
        if (imageFile) return uploadQuestionImage(token!, courseId, updated.id, imageFile);
        return updated;
      }
      const created = await createQuestion(token!, courseId, { type, text, options, setIndex });
      if (imageFile) return uploadQuestionImage(token!, courseId, created.id, imageFile);
      return created;
    },
    onSuccess: () => {
      invalidate();
      toast.success(question ? 'Question updated.' : 'Question created.');
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Save failed.'),
  });

  const removeImageMutation = useMutation({
    mutationFn: () => deleteQuestionImage(token!, courseId, question!.id),
    onSuccess: () => {
      invalidate();
      toast.success('Question image removed.');
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Image removal failed.'),
  });

  const switchType = (next: QuestionType) => {
    setType(next);
    if (next === 'true_false') {
      setOptions([
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ]);
    } else if (question?.type === 'true_false') {
      setOptions([
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
      ]);
    }
  };

  const valid =
    text.trim().length >= 3 &&
    options.filter((o) => o.text.trim()).length >= 2 &&
    options.some((o) => o.isCorrect && o.text.trim());

  return (
    <Modal
      title={question ? 'Edit question' : 'New question'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              setError(null);
              saveMutation.mutate();
            }}
            disabled={!valid || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving…' : question ? 'Save changes' : 'Create question'}
          </Button>
        </>
      }
    >
      {/* type picker (segmented) */}
      <div className="seg" role="tablist" aria-label="Question type">
        {(['multiple_choice', 'true_false'] as QuestionType[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            className={`seg__btn${type === t ? ' is-active' : ''}`}
            disabled={Boolean(question)}
            onClick={() => switchType(t)}
          >
            {typeLabel[t]}
          </button>
        ))}
      </div>

      <Field label="Quiz set" htmlFor="question-set" hint="Which set of this course's quiz the question belongs to.">
        <select
          id="question-set"
          value={setIndex}
          onChange={(e) => setSetIndex(Number(e.target.value))}
        >
          {SETS.map((n) => (
            <option key={n} value={n}>
              Set {n}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Question text" htmlFor="question-text">
        <textarea
          id="question-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="e.g. Which of these is a sign of a phishing email?"
        />
      </Field>

      {type === 'multiple_choice' ? (
        <OptionEditor options={options} onChange={setOptions} />
      ) : (
        <div className="stack">
          <p className="text-muted text-sm" style={{ marginBottom: '-4px' }}>
            Which statement is correct?
          </p>
          <div className="row">
            {options.map((o, i) => (
              <button
                key={o.text}
                type="button"
                className={`btn ${o.isCorrect ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() =>
                  setOptions(options.map((opt, j) => ({ ...opt, isCorrect: j === i })))
                }
              >
                {o.text}
                {o.isCorrect && <Icon name="check" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* image */}
      <Field
        label="Picture (optional)"
        htmlFor="question-image"
        hint="PNG, JPEG or WebP, up to 5 MB. Shown above the question."
      >
        <input
          id="question-image"
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
        />
      </Field>

      {imagePreview && (
        <div className="qimgprev">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="Preview" />
          <button
            type="button"
            className="qimgprev__clear"
            onClick={() => setImageFile(null)}
            title="Remove chosen image"
          >
            <Icon name="x" />
          </button>
        </div>
      )}

      {!imagePreview && question?.imagePath && (
        <div className="row">
          <Pill tone="info">
            <Icon name="eye" /> Image attached
          </Pill>
          <Button
            sm
            variant="danger"
            onClick={() => removeImageMutation.mutate()}
            disabled={removeImageMutation.isPending}
          >
            Remove image
          </Button>
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}
    </Modal>
  );
}

/* ================= bulk import ================= */
function BulkImportForm({
  courseId,
  activeSet,
  onClose,
}: {
  courseId: string;
  activeSet: number;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState('');
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const example = `1. What is the capital of France?
A. London
B. Paris
C. Berlin
D. Madrid
Answer: B

2. The sky is blue.
A. True
B. False
Answer: A`;

  const importMutation = useMutation({
    mutationFn: () => bulkCreateQuestions(token!, courseId, text, activeSet),
    onSuccess: (res) => {
      setResult(res);
      setError(null);
      if (res.created > 0) {
        queryClient.invalidateQueries({ queryKey: ['questions', courseId] });
        queryClient.invalidateQueries({ queryKey: ['quiz-config', courseId] });
        toast.success(`Imported ${res.created} question${res.created === 1 ? '' : 's'}.`);
      }
    },
    onError: (e) => {
      setResult(null);
      setError(e instanceof ApiError ? e.message : 'Import failed.');
    },
  });

  return (
    <Modal
      title={`Bulk import into Set ${activeSet}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="primary"
            onClick={() => {
              setError(null);
              setResult(null);
              importMutation.mutate();
            }}
            disabled={importMutation.isPending || text.trim().length === 0}
          >
            {importMutation.isPending ? 'Importing…' : 'Import questions'}
          </Button>
        </>
      }
    >
      <div className="alert" style={{ display: 'block' }}>
        <p style={{ marginBottom: 'var(--space-xs)' }}>
          <strong>Paste many questions at once.</strong> Number each question, letter the options,
          and mark the answer with <code>Answer: B</code>. Blank line between questions. Two-option
          True/False questions are detected automatically. Images can be added afterwards by
          editing each question.
        </p>
        <pre
          className="mono"
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-ink-2)',
          }}
        >
          {example}
        </pre>
      </div>

      <Field label="Paste questions" htmlFor="bulk-questions">
        <textarea
          id="bulk-questions"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder={example}
          spellCheck={false}
        />
      </Field>

      {error && <Alert tone="error">{error}</Alert>}

      {result && (
        <Alert tone={result.created > 0 ? 'pass' : 'error'}>
          <p>
            Imported <strong>{result.created}</strong>
            {result.failed > 0 ? ` · ${result.failed} problem(s)` : ''}
          </p>
          {result.errors.length > 0 && (
            <ul style={{ margin: 'var(--space-xs) 0 0', paddingInlineStart: '1.1em' }}>
              {result.errors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}
    </Modal>
  );
}

/* ================= preview modal ================= */
function QuestionPreviewModal({
  courseId,
  question,
  onClose,
}: {
  courseId: string;
  question: Question;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!question.imagePath) return;
    let active = true;
    let url: string | null = null;
    fetchQuestionImage(token!, courseId, question.id).then((result) => {
      if (!active) {
        if (result) URL.revokeObjectURL(result);
        return;
      }
      url = result;
      setImageUrl(result);
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [courseId, question.id, question.imagePath, token]);

  return (
    <Modal
      title="Question preview"
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="stack">
        <div className="row">
          <Pill tone="info">{typeLabel[question.type]}</Pill>
          <Pill>Set {question.setIndex}</Pill>
        </div>
        <p className="cell-strong" style={{ fontSize: 'var(--text-md)' }}>
          {question.text}
        </p>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Question"
            style={{ maxWidth: '100%', borderRadius: 'var(--radius-ctl)', border: '1px solid var(--color-rule)' }}
          />
        )}
        <div className="opts" style={{ maxWidth: 'none' }}>
          {question.options.map((o) => (
            <div key={o.id ?? o.text} className={`opt${o.isCorrect ? ' is-checked' : ''}`}>
              <span className="opt__dot" aria-hidden="true" />
              <span className="opt__text">
                {o.text}
                {o.isCorrect && (
                  <span className="st--pass" style={{ marginLeft: 'var(--space-xs)', fontWeight: 600 }}>
                    ✓ correct
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/* ================= main per-course set manager ================= */
function CourseQuestions({ courseId }: { courseId: string }) {
  const { token } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeSet, setActiveSet] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'' | QuestionType>('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'new' | Question | null>(null);
  const [preview, setPreview] = useState<Question | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const courseQuery = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourse(token!, courseId),
    enabled: Boolean(token),
  });

  const configQuery = useQuery({
    queryKey: ['quiz-config', courseId],
    queryFn: () => getQuizConfig(token!, courseId),
    enabled: Boolean(token),
  });

  const questionsQuery = useQuery({
    queryKey: ['questions', courseId, activeSet, typeFilter, search],
    queryFn: () =>
      listQuestions(token!, courseId, {
        setIndex: activeSet,
        type: typeFilter || undefined,
        search: search || undefined,
        limit: 200,
      }),
    enabled: Boolean(token),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['questions', courseId] });
    queryClient.invalidateQueries({ queryKey: ['quiz-config', courseId] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuestion(token!, courseId, id),
    onSuccess: () => {
      invalidate();
      toast.success('Question deleted.');
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Delete failed.';
      setActionError(message);
      toast.error('Delete failed', message);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => reorderQuestions(token!, courseId, activeSet, ids),
    onSuccess: invalidate,
    onError: (e) => setActionError(e instanceof ApiError ? e.message : 'Reorder failed.'),
  });

  if (courseQuery.isLoading || configQuery.isLoading) {
    return <SkeletonRows rows={4} cols={3} />;
  }
  if (courseQuery.isError || configQuery.isError || !courseQuery.data) {
    return (
      <Alert tone="error">
        Failed to load the course.{' '}
        <Link href="/courses" className="backlink">
          Back to courses
        </Link>
      </Alert>
    );
  }

  const course = courseQuery.data;
  const config = configQuery.data!;
  const items = questionsQuery.data?.items ?? [];
  const total = questionsQuery.data?.total ?? 0;

  const setCounts = new Map(config.sets.map((s) => [s.setIndex, s.count]));
  const activeCount = setCounts.get(activeSet) ?? 0;

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((q) => q.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };

  return (
    <div>
      <PageHead
        eyebrow="Question bank"
        title={course.title}
        sub={`Every question template belongs to this course. Build up to 3 quiz sets of at least ${config.minQuestions} questions each — staff receive one randomized set.`}
        back={{ href: '/courses', label: 'Back to courses' }}
        actions={
          <>
            <Button onClick={() => { setActionError(null); setBulkOpen(true); }}>
              <Icon name="layers" />
              Bulk import
            </Button>
            <Button variant="primary" onClick={() => { setActionError(null); setModal('new'); }}>
              <Icon name="plus" />
              New question
            </Button>
          </>
        }
      />

      {/* set tabs */}
      <div className="tabs">
        {SETS.map((n) => {
          const count = setCounts.get(n) ?? 0;
          return (
            <button
              key={n}
              type="button"
              className="tab"
              aria-pressed={activeSet === n}
              onClick={() => setActiveSet(n)}
            >
              Set {n}
              {count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
        <div className="spacer" />
        <Pill tone={counterTone(activeCount, config.minQuestions)}>
          Set {activeSet}: {activeCount} · {setCounterText(activeCount, config.minQuestions)}
        </Pill>
      </div>

      {/* filter bar */}
      <div className="qbank-bar">
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 0, paddingBottom: 0 }}>
          {(
            [
              ['', 'All'],
              ['multiple_choice', 'Multiple choice'],
              ['true_false', 'True / False'],
            ] as ['' | QuestionType, string][]
          ).map(([key, label]) => (
            <button
              key={key || 'all'}
              onClick={() => setTypeFilter(key)}
              className="tab"
              aria-pressed={typeFilter === key}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="qbank-bar__search">
          <input
            className="qbank-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions…"
            aria-label="Search questions"
          />
        </div>
        <span className="mono text-muted qbank-bar__count">
          {total} question{total === 1 ? '' : 's'}
        </span>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      {questionsQuery.isLoading && <SkeletonRows rows={5} cols={3} />}
      {questionsQuery.isError && <Alert tone="error">Failed to load questions.</Alert>}

      {!questionsQuery.isLoading && items.length === 0 && (
        <EmptyState
          icon="question"
          title={search || typeFilter ? 'No questions match your filters' : `Set ${activeSet} is empty`}
          action={
            !search && !typeFilter ? (
              <>
                <Button variant="primary" sm onClick={() => setModal('new')}>
                  <Icon name="plus" /> New question
                </Button>
                <Button sm onClick={() => setBulkOpen(true)}>
                  <Icon name="layers" /> Bulk import
                </Button>
              </>
            ) : undefined
          }
        >
          {search || typeFilter
            ? 'Try a different search or filter.'
            : `Add at least ${config.minQuestions} questions to this set so the course can be published.`}
        </EmptyState>
      )}

      {!questionsQuery.isLoading && items.length > 0 && (
        <div className="qgrid">
          {items.map((q, index) => {
            const correct = q.options.find((o) => o.isCorrect);
            return (
              <div key={q.id} className="qcard">
                <div className="qcard__head">
                  <QuestionThumb courseId={courseId} question={q} />
                  <div className="qcard__headtext">
                    <p className="qcard__text">
                      <span className="mono text-muted" style={{ marginRight: 'var(--space-xs)' }}>
                        {index + 1}.
                      </span>
                      {q.text}
                    </p>
                    <p className="mono qcard__meta">
                      {typeLabel[q.type]}
                      {q.imagePath ? ' · picture' : ''}
                    </p>
                  </div>
                </div>
                <ul className="qcard__opts">
                  {q.options.slice(0, 4).map((o, i) => (
                    <li key={o.id ?? i} className={o.isCorrect ? 'is-correct' : ''}>
                      <span className="qcard__letter">{String.fromCharCode(65 + i)}</span>
                      <span className="qcard__opttext">{o.text}</span>
                      {o.isCorrect && (
                        <span className="qcard__check" aria-label="Correct answer">
                          <Icon name="check" />
                        </span>
                      )}
                    </li>
                  ))}
                  {q.options.length > 4 && (
                    <li className="qcard__more text-muted">+{q.options.length - 4} more options</li>
                  )}
                </ul>
                {correct && q.type === 'true_false' && (
                  <p className="text-muted text-sm">Answer: {correct.text}</p>
                )}
                <div className="qcard__actions">
                  <Button
                    sm
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || reorderMutation.isPending || Boolean(search || typeFilter)}
                    title={search || typeFilter ? 'Clear filters to reorder' : 'Move up'}
                  >
                    ↑
                  </Button>
                  <Button
                    sm
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1 || reorderMutation.isPending || Boolean(search || typeFilter)}
                    title={search || typeFilter ? 'Clear filters to reorder' : 'Move down'}
                  >
                    ↓
                  </Button>
                  <Button sm onClick={() => setPreview(q)}>
                    <Icon name="eye" /> Preview
                  </Button>
                  <Button
                    sm
                    onClick={() => {
                      setActionError(null);
                      setModal(q);
                    }}
                  >
                    <Icon name="edit" /> Edit
                  </Button>
                  <Button
                    sm
                    variant="danger"
                    onClick={() => {
                      if (window.confirm('Delete this question? This cannot be undone.'))
                        deleteMutation.mutate(q.id);
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Icon name="trash" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal !== null && (
        <QuestionForm
          courseId={courseId}
          activeSet={activeSet}
          question={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
      {bulkOpen && (
        <BulkImportForm courseId={courseId} activeSet={activeSet} onClose={() => setBulkOpen(false)} />
      )}
      {preview && (
        <QuestionPreviewModal courseId={courseId} question={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function QuestionsContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  if (!courseId) {
    return (
      <div>
        <PageHead
          eyebrow="Administration"
          title="Question bank"
          sub="Question templates belong to a course. Pick a course to manage its questions."
        />
        <EmptyState icon="question" title="No course selected">
          Open a course from the{' '}
          <Link href="/courses" className="backlink">
            Courses
          </Link>{' '}
          page and choose <strong>Questions</strong> to build its quiz sets.
        </EmptyState>
      </div>
    );
  }

  return <CourseQuestions courseId={courseId} />;
}

export default function QuestionsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <QuestionsContent />
      </Suspense>
    </ProtectedRoute>
  );
}
