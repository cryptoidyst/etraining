import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ClassValue } from './utils';

type ButtonVariant = 'primary' | 'ghost' | 'danger';

function btnClass(variant: ButtonVariant, sm: boolean, className?: ClassValue): string {
  return ['btn', `btn--${variant}`, sm ? 'btn--sm' : '', className]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant = 'ghost',
  sm = false,
  className,
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  sm?: boolean;
  className?: ClassValue;
  children: ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) {
  return (
    <button className={btnClass(variant, sm, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'ghost',
  sm = false,
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  sm?: boolean;
  className?: ClassValue;
  children: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'>) {
  return (
    <Link href={href} className={btnClass(variant, sm, className)} {...rest}>
      {children}
    </Link>
  );
}

export function PageHead({
  eyebrow,
  title,
  sub,
  actions,
  back,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="pagehead">
      {back && (
        <p style={{ marginBottom: 'var(--space-sm)' }}>
          <Link href={back.href} className="backlink">
            <Icon name="arrow-left" />
            {back.label}
          </Link>
        </p>
      )}
      <div className="pagehead__row">
        <div>
          {eyebrow && <p className="mono eyebrow">{eyebrow}</p>}
          <h1 tabIndex={-1}>{title}</h1>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: ClassValue;
}) {
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? (
        <p className="hint-error">{error}</p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'error' | 'pass';
  children: ReactNode;
  className?: ClassValue;
}) {
  const toneClass = tone === 'error' ? 'alert--error' : tone === 'pass' ? 'alert--pass' : '';
  return <div className={['alert', toneClass, className].filter(Boolean).join(' ')}>{children}</div>;
}

export function Progress({ value, done = false }: { value: number; done?: boolean }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={['progress__fill', done ? 'is-done' : ''].filter(Boolean).join(' ')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Skeleton({
  width,
  height = '1rem',
  className,
}: {
  width?: string;
  height?: string;
  className?: ClassValue;
}) {
  return (
    <span
      className={['skeleton', className].filter(Boolean).join(' ')}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-rows" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-row">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height="0.85rem" width={c === 0 ? '60%' : '4rem'} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="cardgrid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="cardlink">
          <Skeleton height="1.1rem" width="70%" />
          <Skeleton height="0.8rem" width="90%" />
          <div className="mt-md">
            <Skeleton height="0.8rem" width="40%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Pill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'pass' | 'fail' | 'info';
  children: ReactNode;
  className?: ClassValue;
}) {
  const toneClass =
    tone === 'pass' ? 'pill--pass' : tone === 'fail' ? 'pill--fail' : tone === 'info' ? 'pill--info' : '';
  return <span className={['pill', toneClass, className].filter(Boolean).join(' ')}>{children}</span>;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: IconName;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && (
        <span className="empty__icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
      )}
      {title && <p className="empty__title">{title}</p>}
      {children && <p className="empty__text">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  icon,
  tone,
  delta,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: IconName;
  tone?: 'neutral' | 'pass' | 'fail' | 'info';
  delta?: ReactNode;
}) {
  return (
    <div className={['kpi', tone ? `kpi--${tone}` : ''].filter(Boolean).join(' ')}>
      {icon && (
        <span className="kpi__icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
      )}
      <p className="mono kpi__label">{label}</p>
      <p className="kpi__value">{value}</p>
      {delta && <p className="kpi__delta">{delta}</p>}
    </div>
  );
}

export function Pager({
  from,
  to,
  total,
  onPrev,
  onNext,
}: {
  from: number;
  to: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="pager">
      <span className="mono">
        Showing {from}–{to} of {total}
      </span>
      <div className="pager__actions">
        <Button sm onClick={onPrev} disabled={from <= 1}>
          Prev
        </Button>
        <Button sm onClick={onNext} disabled={to >= total}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="modal-scrim" role="presentation" onClick={onClose}>
      <div
        className={['modal', size === 'lg' ? 'modal--lg' : ''].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2>{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

export type IconName =
  | 'check'
  | 'x'
  | 'arrow-left'
  | 'arrow-right'
  | 'retry'
  | 'circle'
  | 'bell'
  | 'search'
  | 'plus'
  | 'trash'
  | 'edit'
  | 'eye'
  | 'up'
  | 'down'
  | 'logout'
  | 'dashboard'
  | 'book'
  | 'layers'
  | 'users'
  | 'user'
  | 'building'
  | 'clipboard'
  | 'chart'
  | 'question'
  | 'settings'
  | 'shield'
  | 'menu'
  | 'chevrons-left'
  | 'chevrons-right'
  | 'more-horizontal'
  | 'play'
  | 'chevron-left'
  | 'chevron-right'
  | 'maximize'
  | 'minimize'
  | 'sun'
  | 'moon';

const ICON_PATHS: Record<IconName, ReactNode> = {
  check: <path d="M20 6 9 17l-5-5" />,
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  retry: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="9" />,
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  edit: (
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  up: (
    <>
      <path d="m18 15-6-6-6 6" />
    </>
  ),
  down: (
    <>
      <path d="m6 9 6 6 6-6" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  clipboard: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="10" width="3" height="7" rx="0.5" />
      <rect x="12" y="6" width="3" height="11" rx="0.5" />
      <rect x="17" y="13" width="3" height="4" rx="0.5" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9a2.8 2.8 0 0 1 5.5.8c0 1.9-2.7 2.2-2.7 4" />
      <path d="M12 17h.01" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  menu: (
    <>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </>
  ),
  'chevrons-left': (
    <>
      <path d="m11 17-5-5 5-5" />
      <path d="m18 17-5-5 5-5" />
    </>
  ),
  'chevrons-right': (
    <>
      <path d="m13 17 5-5-5-5" />
      <path d="m6 17 5-5-5-5" />
    </>
  ),
  'more-horizontal': (
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>
  ),
  play: <polygon points="6 3 20 12 6 21 6 3" />,
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  maximize: (
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </>
  ),
  minimize: (
    <>
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
