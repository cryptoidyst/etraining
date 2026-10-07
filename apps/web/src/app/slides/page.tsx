'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Suspense, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { Alert, Button, ButtonLink, EmptyState, PageHead, SkeletonRows } from '@/components/ui';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import { deleteSlide, listSlides, renameSlide, uploadSlide } from '@/lib/slides-api';
import { ApiError } from '@/lib/api';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SlideManager({ courseId }: { courseId: string }) {
  const { token } = useAuth();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const slidesQuery = useQuery({
    queryKey: ['slides', courseId],
    queryFn: () => listSlides(token!, courseId),
    enabled: Boolean(token),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['slides', courseId] });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadSlide(token!, courseId, file),
    onSuccess: (created) => {
      setUploading(false);
      invalidate();
      toast.success(
        created.length > 1
          ? `Split into ${created.length} slides.`
          : 'Slide uploaded.',
      );
    },
    onError: (e) => {
      setUploading(false);
      const message = e instanceof ApiError ? e.message : 'Upload failed.';
      setError(message);
      toast.error('Upload failed', message);
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameSlide(token!, id, title),
    onSuccess: () => {
      invalidate();
      toast.success('Slide renamed.');
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Rename failed.';
      setError(message);
      toast.error('Rename failed', message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSlide(token!, id),
    onSuccess: () => {
      invalidate();
      toast.success('Slide deleted.');
    },
    onError: (e) => {
      const message = e instanceof ApiError ? e.message : 'Delete failed.';
      setError(message);
      toast.error('Delete failed', message);
    },
  });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    uploadMutation.mutate(files[0]);
  };

  const slides = slidesQuery.data ?? [];

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...slides];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      const { reorderSlides } = await import('@/lib/slides-api');
      await reorderSlides(token!, courseId, next.map((s) => s.id));
      invalidate();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Reorder failed.');
    }
  };

  return (
    <div className="stack">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        className={dragOver ? 'dropzone is-over' : 'dropzone'}
        style={{ cursor: 'pointer' }}
      >
        <p>{uploading ? 'Uploading… (PPTX conversion may take a moment)' : 'Drop a file here or click to upload'}</p>
        <p className="text-muted text-sm mt-sm">
          PDF, PPTX (converted to PDF), PNG, JPEG, WebP · max 100 MB
        </p>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.pptx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,image/webp"
          className="visually-hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {slidesQuery.isLoading ? (
        <SkeletonRows rows={4} cols={4} />
      ) : slides.length === 0 ? (
        <EmptyState icon="layers" title="No slides yet">
          Upload the first slide using the dropzone above.
        </EmptyState>
      ) : (
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Type</th>
                <th>Size</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {slides.map((s, i) => (
                <tr key={s.id}>
                  <td className="num">{i + 1}</td>
                  <td className="cell-strong">{s.title}</td>
                  <td className="mono">{s.mimeType}</td>
                  <td className="num">{formatSize(s.fileSize)}</td>
                  <td>
                    <div className="rowactions">
                      <Button sm onClick={() => move(i, -1)} disabled={i === 0}>
                        ↑
                      </Button>
                      <Button
                        sm
                        onClick={() => move(i, 1)}
                        disabled={i === slides.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        sm
                        onClick={() => {
                          const title = window.prompt('Slide title', s.title);
                          if (title && title.trim())
                            renameMutation.mutate({ id: s.id, title: title.trim() });
                        }}
                      >
                        Rename
                      </Button>
                      <ButtonLink href={`/viewer?courseId=${courseId}&slide=${i}`} sm>
                        View
                      </ButtonLink>
                      <Button
                        sm
                        variant="danger"
                        onClick={() => {
                          if (window.confirm(`Delete "${s.title}"?`)) deleteMutation.mutate(s.id);
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
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

function SlidesContent({ courseId }: { courseId: string }) {
  return (
    <div>
      <PageHead
        eyebrow="Administration"
        title="Slides"
        sub="Upload and order slides. A course needs at least one slide before publishing."
        back={{ href: '/courses', label: 'Back to courses' }}
      />
      <SlideManager courseId={courseId} />
    </div>
  );
}

function MissingCourse() {
  return (
    <div>
      <PageHead eyebrow="Administration" title="Slides" back={{ href: '/courses', label: 'Back to courses' }} />
      <EmptyState>
        Missing courseId.{' '}
        <Link href="/courses" style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
          Pick a course
        </Link>
      </EmptyState>
    </div>
  );
}

function SlidesPageInner() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId') ?? '';
  if (!courseId) return <MissingCourse />;
  return <SlidesContent courseId={courseId} />;
}

export default function SlidesPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SlidesPageInner />
      </Suspense>
    </ProtectedRoute>
  );
}
