'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Icon, type IconName } from './ui';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from './theme-toggle';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

interface NavGroup {
  label?: string;
  hue?: 'learning' | 'people' | 'insights';
  items: NavItem[];
}

const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Home',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' }],
  },
  {
    label: 'Learning',
      hue: 'learning',
      items: [
        { href: '/courses', label: 'Courses', icon: 'book' },
        { href: '/assignments', label: 'Assignments', icon: 'clipboard' },
      ],
  },
  {
    label: 'People',
    hue: 'people',
    items: [
      { href: '/users', label: 'Users', icon: 'users' },
      { href: '/staff', label: 'Staff', icon: 'user' },
      { href: '/departments', label: 'Departments', icon: 'building' },
    ],
  },
  {
    label: 'Insights',
    hue: 'insights',
    items: [
      { href: '/reports', label: 'Reports', icon: 'chart' },
      { href: '/audit', label: 'Audit log', icon: 'shield' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const STAFF_NAV: NavGroup[] = [
  {
    label: 'Home',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' }],
  },
  {
    label: 'Learning',
    hue: 'learning',
    items: [
      { href: '/my-training', label: 'My training', icon: 'book' },
      { href: '/catalog', label: 'Catalog', icon: 'layers' },
    ],
  },
];

const ADMIN_COMMANDS: NavItem[] = ADMIN_NAV.flatMap((g) => g.items);
const STAFF_COMMANDS: NavItem[] = STAFF_NAV.flatMap((g) => g.items);

const RAIL_KEY = 'etraining-rail';

function CommandPalette({ items, onClose }: { items: NavItem[]; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && filtered[index]) {
        onClose();
        router.push(filtered[index].href);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, index, onClose, router]);

  return (
    <div className="palette-backdrop" role="presentation" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          placeholder="Type a command…"
          aria-label="Filter commands"
          autoComplete="off"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="palette__list" role="listbox" aria-label="Commands">
          {filtered.length === 0 && <p className="palette__empty">No matching commands.</p>}
          {filtered.map((item, i) => (
            <button
              key={item.href}
              type="button"
              role="option"
              aria-selected={i === index}
              className="pal-item"
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                onClose();
                router.push(item.href);
              }}
            >
              {item.label}
              <span className="mono">Go</span>
            </button>
          ))}
        </div>
        <div className="palette__foot mono">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="sidenav" aria-label="Primary">
      {groups.map((group, gi) => (
        <div key={group.label ?? `group-${gi}`} data-hue={group.hue}>
          {group.label && (
            <p className="mono sidenav__group" data-hue={group.hue}>
              {group.label}
            </p>
          )}
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="sidenav__link"
              aria-current={isCurrent(item.href) ? 'page' : undefined}
              data-tip={item.label}
              title={item.label}
              onClick={onNavigate}
            >
              <Icon name={item.icon} />
              <span className="sidenav__label">{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function SidebarUser() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'administrator';
  const name = user?.fullName ?? user?.username ?? '—';
  const firstName = name.split(/\s+/)[0];
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="sidebar__foot">
      <div className="userchip">
        <span className="userchip__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="userchip__meta">
          <span className="userchip__name">{firstName}</span>
          <span className="userchip__role">{isAdmin ? 'Admin' : 'Staff'}</span>
        </span>
      </div>
      <button
        type="button"
        className="sidenav__link"
        onClick={logout}
        data-tip="Log out"
        title="Log out"
        style={{ background: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
      >
        <Icon name="logout" />
        <span className="sidenav__label">Log out</span>
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = user?.role === 'administrator';
  const groups = isAdmin ? ADMIN_NAV : STAFF_NAV;
  const commands = isAdmin ? ADMIN_COMMANDS : STAFF_COMMANDS;

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(RAIL_KEY) === 'collapsed');
  }, []);

  const toggleRail = () => {
    setCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem(RAIL_KEY, next ? 'collapsed' : 'expanded');
      return next;
    });
  };

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const trail = useMemo(() => {
    const home = isAdmin ? '/dashboard' : '/my-training';
    const crumbs: { label: string; href?: string }[] = [
      { label: isAdmin ? 'Admin' : 'Home', href: pathname === home ? undefined : home },
    ];
    for (const group of groups) {
      for (const item of group.items) {
        if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
          if (group.label) crumbs.push({ label: group.label });
          crumbs.push({ label: item.label });
          return crumbs;
        }
      }
    }
    return crumbs;
  }, [groups, pathname, isAdmin]);

  return (
    <div className="shell" data-rail={collapsed ? 'collapsed' : 'expanded'}>
      <aside className="sidebar">
        <div className="sidebar__head">
          <Link href={isAdmin ? '/dashboard' : '/my-training'} className="brand">
            <span className="brand__mark">TL</span>
            <span className="brand__name">Traininglah</span>
          </Link>
          <button
            type="button"
            className="sidebar__collapse"
            onClick={toggleRail}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <Icon name="chevrons-left" />
          </button>
          <button
            type="button"
            className="sidebar__expand"
            onClick={toggleRail}
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <Icon name="chevrons-right" />
          </button>
        </div>
        <NavList groups={groups} />
        <SidebarUser />
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <button
            type="button"
            className="iconbtn topbar__menu"
            onClick={() => setDrawerOpen(true)}
            title="Open menu"
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>
          <nav className="crumb" aria-label="Breadcrumb">
            {trail.map((c, i) => (
              <span key={`${c.label}-${i}`} className="crumb__item">
                {i > 0 && <span className="crumb__sep">/</span>}
                {c.href ? (
                  <Link href={c.href}>{c.label}</Link>
                ) : (
                  <strong>{c.label}</strong>
                )}
              </span>
            ))}
          </nav>
          <div className="topbar__right">
            <button
              type="button"
              className="kbtn"
              onClick={() => setPaletteOpen(true)}
              aria-haspopup="dialog"
            >
              <span className="kbtn__label">Search commands</span>
              <kbd>⌘K</kbd>
            </button>
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        <main>
          <div className="container content">{children}</div>
        </main>
      </div>

      {drawerOpen && (
        <>
          <div
            className="drawer-scrim"
            role="presentation"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="sidebar__head">
              <Link href={isAdmin ? '/dashboard' : '/my-training'} className="brand">
                <span className="brand__mark">TL</span>
                <span className="brand__name">Traininglah</span>
              </Link>
            </div>
            <NavList groups={groups} onNavigate={() => setDrawerOpen(false)} />
            <SidebarUser />
          </aside>
        </>
      )}

      {paletteOpen && <CommandPalette items={commands} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
