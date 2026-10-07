'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui';
import { cx } from './utils';

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

export function ActionMenu({ items, label = 'Actions' }: { items: ActionMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    const position = () => {
      const trigger = triggerRef.current;
      const list = listRef.current;
      if (!trigger || !list) return;

      const margin = 8;
      const rect = trigger.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const listWidth = listRect.width;
      const listHeight = listRect.height;

      let top = rect.bottom + 4;
      if (top + listHeight + margin > window.innerHeight) {
        const above = rect.top - listHeight - 4;
        top = above >= margin ? above : Math.max(margin, window.innerHeight - listHeight - margin);
      }

      let left = rect.right - listWidth;
      if (left < margin) left = margin;
      if (left + listWidth + margin > window.innerWidth) {
        left = window.innerWidth - listWidth - margin;
      }

      setCoords({ top, left });
    };

    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={listRef}
            className="actionmenu__list"
            role="menu"
            style={{
              position: 'fixed',
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              visibility: coords ? 'visible' : 'hidden',
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={cx('actionmenu__item', item.tone === 'danger' && 'is-danger')}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="actionmenu">
      <button
        ref={triggerRef}
        type="button"
        className="iconbtn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="more-horizontal" />
      </button>
      {menu}
    </div>
  );
}
