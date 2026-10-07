'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import { cx } from '@/components/utils';
import { useAuth } from '@/lib/auth-context';
import type { Slide } from '@/lib/slides-api';
import {
  getSlideImage,
  peekSlideImage,
  preloadSlideImage,
  type SlideImage,
} from '@/lib/pdf-render';

const IDLE_TIMEOUT_MS = 2600;

/** A slide that is (or was just) on screen, so the crossfade can stack two. */
interface SlideView {
  slideId: string;
  title: string;
  image: SlideImage;
}

interface SlideshowProps {
  courseId: string;
  slides: Slide[];
  startIndex: number;
  /** Marks the slide as viewed (same mutation the inline viewer used). */
  onSlideViewed: (slideId: string) => void;
  /** True when every slide has been viewed AND a quiz is configured. */
  quizReady: boolean;
  /** Called when the user presses Start quiz inside the slideshow. */
  onStartQuiz: () => void;
  /** Called when the user exits (Esc / Exit presentation). */
  onExit: () => void;
}

export function Slideshow({
  courseId,
  slides,
  startIndex,
  onSlideViewed,
  quizReady,
  onStartQuiz,
  onExit,
}: SlideshowProps) {
  const { token } = useAuth();
  const [index, setIndex] = useState(() => Math.min(Math.max(0, startIndex), slides.length - 1));
  const [layers, setLayers] = useState<SlideView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const lastReportedId = useRef<string | null>(null);

  const slide = slides[index];
  const total = slides.length;

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current);
    }
    idleTimer.current = window.setTimeout(() => setChromeVisible(false), IDLE_TIMEOUT_MS);
  }, []);

  const next = useCallback(() => {
    setIndex((current) => Math.min(current + 1, slidesRef.current.length - 1));
    showChrome();
  }, [showChrome]);

  const previous = useCallback(() => {
    setIndex((current) => Math.max(current - 1, 0));
    showChrome();
  }, [showChrome]);

  const exit = useCallback(() => {
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
    onExit();
  }, [onExit]);

  /* Enter browser fullscreen when the overlay mounts (graceful fallback: overlay only). */
  useEffect(() => {
    const element = rootRef.current;
    if (element && element.requestFullscreen) {
      element
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen(false));
    }
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  /* Keyboard navigation. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          event.preventDefault();
          next();
          break;
        case 'Enter':
          event.preventDefault();
          if (quizReady) onStartQuiz();
          else next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          previous();
          break;
        case 'Escape':
          event.preventDefault();
          exit();
          break;
        case 'Home':
          event.preventDefault();
          setIndex(0);
          showChrome();
          break;
        case 'End':
          event.preventDefault();
          setIndex(slidesRef.current.length - 1);
          showChrome();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [next, previous, exit, showChrome, quizReady, onStartQuiz]);

  /* Reveal chrome on pointer activity anywhere in the overlay. */
  useEffect(() => {
    const onPointerMove = () => showChrome();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerMove);
    showChrome();
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
      if (idleTimer.current !== null) {
        window.clearTimeout(idleTimer.current);
      }
    };
  }, [showChrome]);

  /* Track the displayed slide (same idempotent endpoint the viewer uses). */
  useEffect(() => {
    if (!slide || lastReportedId.current === slide.id) return;
    lastReportedId.current = slide.id;
    onSlideViewed(slide.id);
  }, [slide, onSlideViewed]);

  /* Load the current slide into a stack of layers (previous + current). */
  useEffect(() => {
    if (!token || !slide) return;
    let active = true;

    const view = (image: SlideImage): SlideView => ({
      slideId: slide.id,
      title: slide.title,
      image,
    });

    const show = (image: SlideImage) => {
      setLayers((previous) => {
        const top = previous[previous.length - 1];
        if (top?.slideId === slide.id) return previous;
        // Keep the outgoing layer beneath for a crossfade when one is visible.
        return top ? [top, view(image)] : [view(image)];
      });
    };

    setLoadError(null);
    const cached = peekSlideImage(slide.id);
    if (cached) {
      show(cached);
      return;
    }

    getSlideImage(token, slide)
      .then((image) => {
        if (active) show(image);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Failed to load slide.');
      });

    return () => {
      active = false;
    };
  }, [token, slide]);

  /* Drop the outgoing layer once the crossfade has finished. */
  useEffect(() => {
    if (layers.length < 2) return;
    const timer = window.setTimeout(() => {
      setLayers((previous) => (previous.length > 1 ? previous.slice(-1) : previous));
    }, 340);
    return () => window.clearTimeout(timer);
  }, [layers]);

  /* Preload the neighbours so Next/Previous are instant. */
  useEffect(() => {
    if (!token) return;
    for (const neighbour of [slides[index + 1], slides[index - 1]]) {
      if (neighbour) preloadSlideImage(token, neighbour);
    }
  }, [token, index, slides]);

  const isLastSlide = index === total - 1;

  return (
    <div
      ref={rootRef}
      className="slideshow"
      role="dialog"
      aria-modal="true"
      aria-label={`Slideshow — slide ${index + 1} of ${total}`}
      tabIndex={-1}
    >
      <div className="slideshow__stage" data-chrome={chromeVisible ? 'on' : 'off'}>
        {layers.length === 0 ? (
          <p className="mono slideshow__error">{loadError ?? 'Loading slide…'}</p>
        ) : (
          <div className="slideshow__stack">
            {layers.map((layer, layerIndex) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={layer.slideId}
                className={cx('slideshow__frame', 'slideshow__layer', layerIndex > 0 && 'is-incoming')}
                src={layer.image.url}
                alt={layer.title}
                draggable={false}
              />
            ))}
          </div>
        )}

        {loadError && layers.length > 0 && (
          <p className="mono slideshow__error slideshow__error--overlay">{loadError}</p>
        )}

        <button
          type="button"
          className="slideshow__tapzone"
          aria-label="Previous slide"
          onClick={previous}
          disabled={index === 0}
        />
        <button
          type="button"
          className="slideshow__tapzone slideshow__tapzone--next"
          aria-label="Next slide"
          onClick={next}
          disabled={isLastSlide}
        />
      </div>

      <div className={cx('slideshow__chrome', chromeVisible && 'is-visible')} aria-hidden={!chromeVisible}>
        <div className="slideshow__top">
          <span className="mono slideshow__title" title={slide?.title}>
            {slide?.title}
          </span>
          <span className="mono slideshow__count">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            className="slideshow__exit"
            onClick={() => exit()}
            title="Exit slideshow (Esc)"
          >
            <Icon name="x" />
            Exit presentation
          </button>
        </div>

        <div className="slideshow__bottom">
          <button
            type="button"
            className="slideshow__nav"
            onClick={previous}
            disabled={index === 0}
            aria-label="Previous slide"
            title="Previous (←)"
          >
            <Icon name="chevron-left" />
          </button>

          {quizReady ? (
            <button
              type="button"
              className="slideshow__quiz"
              onClick={onStartQuiz}
              title="Start quiz (Enter)"
            >
              <Icon name="check" />
              Start quiz
            </button>
          ) : (
            <span className="mono gate">
              {isLastSlide ? 'Last slide' : `${index + 1} / ${total}`}
            </span>
          )}

          <button
            type="button"
            className="slideshow__nav"
            onClick={next}
            disabled={isLastSlide}
            aria-label="Next slide"
            title="Next (→ / Space)"
          >
            <Icon name="chevron-right" />
          </button>
        </div>
      </div>

      {!isFullscreen && (
        <p className="mono slideshow__fs-hint" aria-hidden="true">
          Press F for fullscreen
        </p>
      )}

      <p className="visually-hidden" aria-live="polite">
        Slide {index + 1} of {total}
      </p>

      <button type="button" className="visually-hidden" onClick={() => exit()} aria-hidden="true" tabIndex={-1} />

      <span className={cx('slideshow__hint', chromeVisible && 'is-visible')} aria-hidden="true">
        <span className="mono">Esc</span> exit · <span className="mono">←/→</span> navigate
      </span>

      <FullscreenKeyHandler />
    </div>
  );
}

/** F11-style toggle for the fallback (non-native-fullscreen) mode. */
function FullscreenKeyHandler() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'f' && event.key !== 'F') return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
