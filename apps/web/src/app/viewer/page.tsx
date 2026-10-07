'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { Slideshow } from '@/components/slideshow';
import { useAuth } from '@/lib/auth-context';
import { listSlides } from '@/lib/slides-api';
import { getCourseProgress, recordSlideView } from '@/lib/progress-api';
import { getQuizEligibility } from '@/lib/quiz-attempts-api';


function SlideshowScreen({ courseId }: { courseId: string }) {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  const slidesQuery = useQuery({
    queryKey: ['slides', courseId],
    queryFn: () => listSlides(token!, courseId),
    enabled: Boolean(token) && Boolean(courseId),
  });

  const progressQuery = useQuery({
    queryKey: ['progress', courseId],
    queryFn: () => getCourseProgress(token!, courseId),
    enabled: Boolean(token) && Boolean(courseId),
  });

  /* Quiz readiness = assigned + valid set configured (server-side truth). */
  const eligibilityQuery = useQuery({
    queryKey: ['quiz-eligibility', courseId],
    queryFn: () => getQuizEligibility(token!, courseId),
    enabled: Boolean(token) && Boolean(courseId),
    retry: false,
  });

  const slides = slidesQuery.data ?? [];
  const progress = progressQuery.data;
  const eligibility = eligibilityQuery.data;

  const { mutate: recordSlideViewMutation } = useMutation({
    mutationFn: (id: string) => recordSlideView(token!, courseId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress', courseId] });
      queryClient.invalidateQueries({ queryKey: ['my-training'] });
    },
  });

  /* Local mirror of viewed slide ids for instant CTA updates. */
  useEffect(() => {
    if (!progress) return;
    setViewedIds(new Set(progress.viewed.map((v) => v.slideId)));
  }, [progress]);

  const markSlideViewed = useCallback(
    (id: string) => {
      setViewedIds((current) => {
        if (current.has(id)) return current;
        const next = new Set(current);
        next.add(id);
        return next;
      });
      recordSlideViewMutation(id);
    },
    [recordSlideViewMutation],
  );

  const allViewed = slides.length > 0 && slides.every((s) => viewedIds.has(s.id));
  const quizConfigured = Boolean(eligibility?.quizConfigured);

  const handleExit = useCallback(() => {
    router.push('/my-training');
  }, [router]);

  const handleStartQuiz = useCallback(() => {
    router.push(`/quiz-taking?courseId=${courseId}`);
  }, [courseId, router]);

  if (slidesQuery.isLoading) {
    return (
      <div className="slideshow slideshow--loading">
        <p className="mono slideshow__error">Loading slides…</p>
      </div>
    );
  }

  if (slidesQuery.isError) {
    return (
      <div className="slideshow slideshow--loading">
        <p className="mono slideshow__error">
          Failed to load slides.{' '}
          <a href="/my-training" className="backlink">
            Back to my training
          </a>
        </p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="slideshow slideshow--loading">
        <p className="mono slideshow__error">
          This course has no slides yet.{' '}
          <a href="/my-training" className="backlink">
            Back to my training
          </a>
        </p>
      </div>
    );
  }

  return (
    <Slideshow
      courseId={courseId}
      slides={slides}
      startIndex={0}
      onSlideViewed={markSlideViewed}
      quizReady={allViewed && quizConfigured}
      onStartQuiz={handleStartQuiz}
      onExit={handleExit}
    />
  );
}

function ViewerContent() {
  const params = useSearchParams();
  const courseId = params.get('courseId') ?? '';

  if (!courseId) {
    return (
      <div className="slideshow slideshow--loading">
        <p className="mono slideshow__error">
          Missing courseId. <a href="/my-training" className="backlink">Back to my training</a>
        </p>
      </div>
    );
  }

  return <SlideshowScreen courseId={courseId} />;
}

export default function ViewerPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="slideshow slideshow--loading">
            <p className="mono slideshow__error">Loading…</p>
          </div>
        }
      >
        <ViewerContent />
      </Suspense>
    </ProtectedRoute>
  );
}
