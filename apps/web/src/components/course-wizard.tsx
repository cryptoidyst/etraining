'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Alert, Button, Field, Modal, Pill } from '@/components/ui';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import { createCourse, updateCourse, type Course } from '@/lib/admin-api';
import { uploadSlide, listSlides } from '@/lib/slides-api';
import { getQuizConfig } from '@/lib/quiz-config-api';
import { bulkCreateQuestions } from '@/lib/questions-api';
import { ApiError } from '@/lib/api';

type Step = 'details' | 'slides' | 'questions' | 'done';

const stepOrder: Step[] = ['details', 'slides', 'questions', 'done'];

function StepDots({ current }: { current: Step }) {
  const labels: Record<Step, string> = {
    details: 'Details',
    slides: 'Slides',
    questions: 'Questions',
    done: 'Finish',
  };
  const currentIndex = stepOrder.indexOf(current);
  return (
    <div className="row" style={{ gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
      {stepOrder.slice(0, 3).map((step, i) => (
        <span key={step} className="row" style={{ gap: 'var(--space-xs)' }}>
          <Pill tone={i < currentIndex ? 'pass' : i === currentIndex ? 'info' : 'neutral'}>
            {i + 1}. {labels[step]}
          </Pill>
          {i < 2 && <span className="text-muted">→</span>}
        </span>
      ))}
    </div>
  );
}

export function CourseWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('details');
  const [error, setError] = useState<string | null>(null);

  // details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState(80);
  const [allowRetake, setAllowRetake] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState('');

  // created course
  const [course, setCourse] = useState<Course | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // bulk import
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);

  const reset = () => {
    setStep('details');
    setError(null);
    setTitle('');
    setDescription('');
    setPassingScore(80);
    setAllowRetake(true);
    setMaxAttempts('');
    setCourse(null);
    setSlideCount(0);
    setQuestionCount(0);
    setBulkText('');
    setBulkResult(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createCourse(token!, {
        title: title.trim(),
        description: description || undefined,
        passingScore,
        allowRetake,
        maxAttempts: maxAttempts ? Number(maxAttempts) : null,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setCourse(created);
      setError(null);
      setStep('slides');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not create the course.'),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadSlide(token!, course!.id, file),
    onSuccess: (created) => {
      setUploading(false);
      setSlideCount((n) => n + created.length);
      toast.success(
        created.length > 1
          ? `Split into ${created.length} slides.`
          : 'Slide uploaded.',
      );
      void refreshSlideCount();
    },
    onError: (e) => {
      setUploading(false);
      setError(e instanceof ApiError ? e.message : 'Upload failed.');
    },
  });

  const refreshSlideCount = async () => {
    if (!course) return;
    try {
      const slides = await listSlides(token!, course.id);
      setSlideCount(slides.length);
    } catch {
      /* ignore */
    }
  };

  const bulkMutation = useMutation({
    mutationFn: () => bulkCreateQuestions(token!, course!.id, bulkText, 1),
    onSuccess: async (res) => {
      setBulkResult(res);
      if (res.created > 0) {
        queryClient.invalidateQueries({ queryKey: ['questions', course!.id] });
        queryClient.invalidateQueries({ queryKey: ['quiz-config', course!.id] });
        toast.success(`Imported ${res.created} question${res.created === 1 ? '' : 's'}.`);
      }
      await refreshQuestionCount();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Import failed.'),
  });

  const refreshQuestionCount = async () => {
    if (!course) return;
    try {
      const config = await getQuizConfig(token!, course.id);
      const set1 = config.sets.find((s) => s.setIndex === 1);
      setQuestionCount(set1?.count ?? 0);
    } catch {
      /* count can be checked later in the quiz builder */
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || !course) return;
    setError(null);
    setUploading(true);
    uploadMutation.mutate(files[0]);
  };

  if (!open) return null;

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

  const detailsValid = title.trim().length >= 3;

  return (
    <Modal
      title="Create a course"
      onClose={close}
      size="lg"
      footer={
        step === 'done' ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            {step === 'details' && (
              <Button
                variant="primary"
                disabled={!detailsValid || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Creating…' : 'Next: Slides'}
              </Button>
            )}
            {step === 'slides' && (
              <>
                <Button onClick={() => setStep('questions')}>Next: Questions</Button>
                <Button variant="ghost" onClick={() => setStep('done')}>
                  Set up later
                </Button>
              </>
            )}
            {step === 'questions' && (
              <>
                <Button variant="primary" onClick={() => setStep('done')}>
                  Finish
                </Button>
                <Button variant="ghost" onClick={() => setStep('done')}>
                  Set up later
                </Button>
              </>
            )}
          </>
        )
      }
    >
      <StepDots current={step} />

      {error && (
        <Alert tone="error" className="mt-md">
          {error}
        </Alert>
      )}

      {step === 'details' && (
        <div className="stack mt-md">
          <Field label="Title" htmlFor="wiz-title">
            <input
              id="wiz-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Workplace Safety Essentials"
            />
          </Field>
          <Field label="Description" htmlFor="wiz-desc">
            <textarea
              id="wiz-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
          <div className="grid2">
            <Field label="Pass score %" htmlFor="wiz-score">
              <input
                id="wiz-score"
                type="number"
                min={1}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
              />
            </Field>
            <Field label="Allow retake" htmlFor="wiz-retake">
              <select
                id="wiz-retake"
                value={allowRetake ? 'yes' : 'no'}
                onChange={(e) => setAllowRetake(e.target.value === 'yes')}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Max attempts" htmlFor="wiz-max">
              <input
                id="wiz-max"
                type="number"
                min={1}
                placeholder="∞"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                disabled={!allowRetake}
              />
            </Field>
          </div>
        </div>
      )}

      {step === 'slides' && course && (
        <div className="stack mt-md">
          <p className="text-muted text-sm">
            Upload slides for <strong>{course.title}</strong>. You can add more later.
          </p>
          <div
            className="dropzone"
            style={{ cursor: 'pointer' }}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
          >
            <p>{uploading ? 'Uploading…' : 'Drop a file here or click to upload'}</p>
            <p className="text-muted text-sm mt-sm">PDF, PNG, JPEG, WebP · max 20 MB</p>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="visually-hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
          <Pill tone={slideCount > 0 ? 'pass' : 'neutral'}>
            {slideCount} slide{slideCount === 1 ? '' : 's'} uploaded
          </Pill>
        </div>
      )}

      {step === 'questions' && course && (
        <div className="stack mt-md">
          <p className="text-muted text-sm">
            Paste questions for <strong>{course.title}</strong>. They are added to this
            course&apos;s question bank, in Set 1.
          </p>
          <Alert>
            <p style={{ marginBottom: 'var(--space-xs)' }}>
              <strong>Supported format</strong> — number each question, letter the options, and mark
              the correct one with <code>Answer: B</code>.
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
          </Alert>
          <Field label="Paste questions" htmlFor="wiz-bulk">
            <textarea
              id="wiz-bulk"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={10}
              placeholder={example}
              spellCheck={false}
            />
          </Field>
          <div className="row">
            <Button
              variant="primary"
              disabled={bulkMutation.isPending || bulkText.trim().length === 0}
              onClick={() => {
                setError(null);
                setBulkResult(null);
                bulkMutation.mutate();
              }}
            >
              {bulkMutation.isPending ? 'Importing…' : 'Import questions'}
            </Button>
            <Pill tone={questionCount >= 10 ? 'pass' : 'neutral'}>
              Set 1: {questionCount} {questionCount >= 10 ? '· ready' : '/ need 10+'}
            </Pill>
          </div>
          {bulkResult && (
            <Alert tone={bulkResult.created > 0 ? 'pass' : 'error'}>
              <p>
                Imported <strong>{bulkResult.created}</strong>
                {bulkResult.failed > 0 ? ` · ${bulkResult.failed} problem(s)` : ''}
              </p>
              {bulkResult.errors.length > 0 && (
                <ul style={{ margin: 'var(--space-xs) 0 0', paddingInlineStart: '1.1em' }}>
                  {bulkResult.errors.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}
        </div>
      )}

      {step === 'done' && course && (
        <div className="stack mt-md">
          <Alert tone="pass">
            <strong>{course.title}</strong> created as a draft.
          </Alert>
          <ul style={{ margin: 0, paddingInlineStart: '1.1em' }}>
            <li>
              Slides: <strong>{slideCount}</strong>
            </li>
            <li>
              Set 1 questions: <strong>{questionCount}</strong>
            </li>
          </ul>
          <p className="text-muted text-sm">
            You can add slides, more question sets, and scoring rules any time from the course&apos;s
            menu. Publish the course once it has at least one slide and a valid quiz set.
          </p>
        </div>
      )}
    </Modal>
  );
}
