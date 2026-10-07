'use client';

import { useState } from 'react';
import Link from 'next/link';

/* ---------- inline icons (stroke, currentColor) ---------- */
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const GradCapIcon = () => (
  <svg {...iconProps}>
    <path d="M22 10 12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    <path d="M22 10v6" />
  </svg>
);
const ShieldIcon = () => (
  <svg {...iconProps}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const ChartIcon = () => (
  <svg {...iconProps}>
    <path d="M3 3v18h18" />
    <path d="m7 14 4-4 3 3 5-6" />
  </svg>
);
const BadgeIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="9" r="6" />
    <path d="m8.5 14-1.5 7 5-3 5 3-1.5-7" />
  </svg>
);
const ClockIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const UsersIcon = () => (
  <svg {...iconProps}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const FlameIcon = () => (
  <svg {...iconProps}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);
const BellIcon = () => (
  <svg {...iconProps}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const CheckIcon = () => (
  <svg {...iconProps}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const MenuIcon = () => (
  <svg {...iconProps}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);
const XIcon = () => (
  <svg {...iconProps}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
const LockIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const ZapIcon = () => (
  <svg {...iconProps}>
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <Link href="/" className={`brandlock brandlock--${size}`} aria-label="Traininglah home">
      <span className="brandlock__mark">
        <GradCapIcon />
      </span>
      <span className="brandlock__word">
        <span className="brandlock__name">Traininglah</span>
        <span className="brandlock__tag">Training Academy</span>
      </span>
    </Link>
  );
}

const NAV_LINKS = [
  { href: '#courses', label: 'Courses' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#about', label: 'About' },
];

function SiteHeader() {
  const [open, setOpen] = useState(false);

  const signInHref = '/login';

  return (
    <header className="sitehead">
      <div className="container sitehead__inner">
        <BrandMark />
        <nav className="sitehead__nav" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="sitehead__link">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="sitehead__right">
          <Link href={signInHref} className="btn btn--primary btn--sm sitehead__cta">
            Sign In
          </Link>
          <button
            type="button"
            className="sitehead__burger"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="sitehead__mobile" aria-label="Mobile">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="sitehead__mlink"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <Link
            href={signInHref}
            className="btn btn--primary sitehead__mcta"
            onClick={() => setOpen(false)}
          >
            Sign In
          </Link>
        </nav>
      )}
    </header>
  );
}

function DashboardPreview() {
  return (
    <div className="dashprev" aria-hidden="true">
      <div className="dashprev__chrome">
        <span className="dashprev__dot" />
        <span className="dashprev__dot" />
        <span className="dashprev__dot" />
        <span className="dashprev__url mono">traininglah.internal/dashboard</span>
      </div>
      <div className="dashprev__body">
        <aside className="dashprev__rail">
          <span className="dashprev__logo">
            <GradCapIcon />
          </span>
          <span className="dashprev__railitem is-active">
            <ChartIcon />
          </span>
          <span className="dashprev__railitem">
            <ShieldIcon />
          </span>
          <span className="dashprev__railitem">
            <UsersIcon />
          </span>
          <span className="dashprev__railitem">
            <BellIcon />
          </span>
        </aside>
        <div className="dashprev__main">
          <div className="dashprev__topbar">
            <p className="mono dashprev__section">Training Dashboard</p>
            <span className="dashprev__avatar">ST</span>
          </div>
          <div className="dashprev__kpis">
            <div className="dashprev__kpi">
              <p className="mono dashprev__kpilabel">In progress</p>
              <p className="dashprev__kpival">3</p>
            </div>
            <div className="dashprev__kpi">
              <p className="mono dashprev__kpilabel">Completed</p>
              <p className="dashprev__kpival">12</p>
            </div>
            <div className="dashprev__kpi">
              <p className="mono dashprev__kpilabel">Avg. score</p>
              <p className="dashprev__kpival">91%</p>
            </div>
          </div>
          <div className="dashprev__course">
            <div className="dashprev__courserow">
              <div className="dashprev__courseinfo">
                <p className="dashprev__coursetitle">Information Security Essentials</p>
                <p className="dashprev__coursemeta">8 of 11 lessons · due Fri</p>
              </div>
              <span className="dashprev__pct">72%</span>
            </div>
            <div className="dashprev__bar">
              <i style={{ width: '72%' }} />
            </div>
            <ul className="dashprev__lessons">
              <li className="is-done">
                <span className="dashprev__tick">
                  <CheckIcon />
                </span>
                Security Awareness
              </li>
              <li className="is-done">
                <span className="dashprev__tick">
                  <CheckIcon />
                </span>
                Data Privacy
              </li>
              <li>
                <span className="dashprev__tick dashprev__tick--todo" />
                Incident Response
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: <BadgeIcon />,
    title: 'Certified Courses',
    desc: 'Earn certificates your department actually tracks.',
  },
  {
    icon: <ClockIcon />,
    title: 'Learn in Minutes',
    desc: 'Bite-sized lessons that fit between meetings.',
  },
  {
    icon: <ChartIcon />,
    title: 'Track Your Progress',
    desc: 'See scores, progress, streaks, and deadlines at a glance.',
  },
];

const COURSES = [
  {
    icon: <ShieldIcon />,
    title: 'Security Awareness',
    desc: 'Learn the fundamentals of staying safe online.',
    lessons: 8,
    mins: 15,
  },
  {
    icon: <LockIcon />,
    title: 'Data Privacy',
    desc: 'Handle personal and company data with confidence.',
    lessons: 6,
    mins: 12,
  },
  {
    icon: <UsersIcon />,
    title: 'Leadership',
    desc: 'Practical skills for leading teams day to day.',
    lessons: 10,
    mins: 20,
  },
  {
    icon: <FlameIcon />,
    title: 'Fire Safety',
    desc: 'Evacuation steps and prevention basics for every site.',
    lessons: 5,
    mins: 10,
  },
  {
    icon: <ZapIcon />,
    title: 'Incident Response',
    desc: 'What to do in the first minutes of an incident.',
    lessons: 8,
    mins: 15,
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Sign In',
    desc: 'Use your company account to access your assigned training.',
  },
  {
    n: '02',
    title: 'Learn',
    desc: 'Complete short, focused courses at your own pace.',
  },
  {
    n: '03',
    title: 'Track Progress',
    desc: 'Monitor completion, scores, and certificates.',
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <SiteHeader />

      <main>
        {/* ---------- HERO ---------- */}
        <section className="hero">
          <div className="container hero__inner">
            <div className="hero__copy">
              <p className="mono eyebrow">Corporate training, made simple</p>
              <h1 className="hero__title">
                Level up your skills,
                <span className="grad">one course at a time.</span>
              </h1>
              <p className="hero__sub">
                Company training courses designed around your team&apos;s needs.
                Learn at your own pace and track your progress.
              </p>
              <div className="hero__ctas">
                <Link href="/login" className="btn btn--primary">
                  Start Learning
                </Link>
                <Link href="/login" className="btn btn--ghost">
                  Sign In
                </Link>
              </div>
            </div>
            <div className="hero__visual">
              <DashboardPreview />
            </div>
          </div>
        </section>

        {/* ---------- STATS ---------- */}
        <section className="stats" aria-label="Traininglah at a glance">
          <div className="container stats__grid">
            <div className="stat">
              <p className="stat__n">120+</p>
              <p className="mono stat__l">Courses</p>
            </div>
            <div className="stat">
              <p className="stat__n">98%</p>
              <p className="mono stat__l">Completion</p>
            </div>
            <div className="stat">
              <p className="stat__n">24/7</p>
              <p className="mono stat__l">Access</p>
            </div>
          </div>
        </section>

        {/* ---------- WHY ---------- */}
        <section className="section-block" id="features">
          <div className="container">
            <div className="sechead">
              <p className="mono eyebrow">Features</p>
              <h2 className="sechead__title">Why Traininglah</h2>
              <p className="sechead__sub">
                A focused learning platform built for busy teams — nothing more,
                nothing less.
              </p>
            </div>
            <div className="featgrid">
              {FEATURES.map((f) => (
                <div key={f.title} className="featcard">
                  <span className="featcard__icon">{f.icon}</span>
                  <p className="featcard__title">{f.title}</p>
                  <p className="featcard__desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- POPULAR COURSES ---------- */}
        <section className="section-block section-block--tint" id="courses">
          <div className="container">
            <div className="sechead">
              <p className="mono eyebrow">Catalog</p>
              <h2 className="sechead__title">Popular Courses</h2>
              <p className="sechead__sub">
                Short, practical courses your teams actually finish.
              </p>
            </div>
            <div className="coursegrid">
              {COURSES.map((c) => (
                <div key={c.title} className="coursecard">
                  <span className="coursecard__icon">{c.icon}</span>
                  <p className="coursecard__title">{c.title}</p>
                  <p className="coursecard__desc">{c.desc}</p>
                  <p className="mono coursecard__meta">
                    {c.lessons} lessons · {c.mins} min
                  </p>
                  <Link href="/login" className="coursecard__link">
                    View Course
                    <svg {...iconProps} className="coursecard__arrow">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- HOW IT WORKS ---------- */}
        <section className="section-block" id="how-it-works">
          <div className="container">
            <div className="sechead">
              <p className="mono eyebrow">Process</p>
              <h2 className="sechead__title">How It Works</h2>
              <p className="sechead__sub">
                From sign-in to certificate in three steps.
              </p>
            </div>
            <div className="steps">
              {STEPS.map((s) => (
                <div key={s.n} className="step">
                  <p className="step__n mono">{s.n}</p>
                  <p className="step__title">{s.title}</p>
                  <p className="step__desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- ABOUT ---------- */}
        <section className="section-block section-block--tint" id="about">
          <div className="container about">
            <div className="about__copy">
              <p className="mono eyebrow">About</p>
              <h2 className="sechead__title">Built for internal teams</h2>
              <p className="sechead__sub">
                Traininglah is your company&apos;s internal training academy.
                Courses are assigned by your department, progress is tracked
                automatically, and certificates are recorded where your managers
                can see them.
              </p>
              <ul className="about__list">
                <li>
                  <span className="about__tick">
                    <CheckIcon />
                  </span>
                  Assigned by your department, synced with your staff directory
                </li>
                <li>
                  <span className="about__tick">
                    <CheckIcon />
                  </span>
                  Short slide-based lessons with quizzes that unlock as you go
                </li>
                <li>
                  <span className="about__tick">
                    <CheckIcon />
                  </span>
                  Completion, scores, and certificates in one place
                </li>
              </ul>
            </div>
            <figure className="quote">
              <blockquote className="quote__text">
                “The security course took fifteen minutes and genuinely changed
                how our team handles email.”
              </blockquote>
              <figcaption className="quote__by mono">
                S. Tan · Operations · completed 6 courses
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ---------- FINAL CTA ---------- */}
        <section className="finalcta">
          <div className="container finalcta__inner">
            <h2 className="finalcta__title">Ready to start learning?</h2>
            <p className="finalcta__sub">
              Build your skills, complete your training, and keep your progress
              on track.
            </p>
            <Link href="/login" className="btn btn--primary">
              Sign In
            </Link>
          </div>
        </section>
      </main>

      {/* ---------- FOOTER ---------- */}
      <footer className="sitefoot">
        <div className="container sitefoot__inner">
          <BrandMark size="sm" />
          <nav className="sitefoot__links" aria-label="Footer">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="sitefoot__link">
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="container">
          <p className="sitefoot__copy mono">
            © {new Date().getFullYear()} Traininglah · Training Academy · Internal learning system
          </p>
        </div>
      </footer>
    </div>
  );
}
