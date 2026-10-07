'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { ButtonLink, EmptyState, PageHead, Pill, SkeletonCards } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { listCatalog } from '@/lib/admin-api';

function CatalogContent() {
  const { token } = useAuth();

  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: () => listCatalog(token!),
    enabled: Boolean(token),
  });

  const courses = catalogQuery.data ?? [];

  return (
    <div>
      <PageHead
        eyebrow="Catalog"
        title="Training catalog"
        sub="Published courses available to you."
      />

      {catalogQuery.isLoading && <SkeletonCards count={3} />}
      {catalogQuery.isError && <div className="alert alert--error">Failed to load the catalog.</div>}

      {!catalogQuery.isLoading && courses.length === 0 && (
        <EmptyState icon="layers" title="No published courses yet">
          Check back later — courses appear here once an administrator publishes them.
        </EmptyState>
      )}

      <div className="cardgrid">
        {courses.map((c) => (
          <div key={c.id} className="cardlink">
            <span className="cardlink__title">{c.title}</span>
            {c.description && <span className="cardlink__desc">{c.description}</span>}
            <span className="cardlink__meta mono">
              Pass {c.passingScore}% · {c.slideCount} slides
              {c.allowRetake
                ? ` · retake${c.maxAttempts ? ` (max ${c.maxAttempts})` : ''}`
                : ' · no retake'}
            </span>
            <span className="mt-md">
              {c.slideCount > 0 ? (
                <ButtonLink href={`/viewer?courseId=${c.id}`} variant="primary" sm>
                  Start course
                </ButtonLink>
              ) : (
                <Pill>No slides yet</Pill>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CatalogPage(): ReactNode {
  return (
    <ProtectedRoute>
      <CatalogContent />
    </ProtectedRoute>
  );
}
