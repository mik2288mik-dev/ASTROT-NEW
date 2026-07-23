import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PeriodExtraCard } from '../../types';
import {
  cardBackgroundStyle,
  type CardBackgroundAsset,
} from '../../lib/cardBackgrounds';

type Props = {
  activeCard: PeriodExtraCard | null;
  background: CardBackgroundAsset | null;
  eyebrow: string;
  language: 'ru' | 'en';
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
};

export function PeriodExtraCardModal({
  activeCard,
  background,
  eyebrow,
  language,
  scrollRef,
  onClose,
}: Props) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!activeCard || typeof document === 'undefined') return;
    const scrollNode = scrollRef?.current || null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousScrollOverflow = scrollNode?.style.overflowY ?? '';
    const previousScrollTouchAction = scrollNode?.style.touchAction ?? '';
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    document.body.classList.add('period-extra-reader-open');
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    if (scrollNode) {
      scrollNode.style.overflowY = 'hidden';
      scrollNode.style.touchAction = 'none';
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
      ) || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const focusFrame = window.requestAnimationFrame(
      () => closeRef.current?.focus({ preventScroll: true }),
    );

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('period-extra-reader-open');
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      if (scrollNode) {
        scrollNode.style.overflowY = previousScrollOverflow;
        scrollNode.style.touchAction = previousScrollTouchAction;
      }
      openerRef.current?.focus({ preventScroll: true });
      openerRef.current = null;
    };
  }, [activeCard, onClose, scrollRef]);

  if (!portalRoot || !activeCard) return null;

  const paragraphs = activeCard.fullText
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return createPortal(
    <div className="period-extra-reader-layer" role="presentation">
      <section
        ref={dialogRef}
        className={`period-extra-reader${background ? ' has-card-background' : ''}`}
        style={cardBackgroundStyle(background)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`period-extra-title-${activeCard.id}`}
        aria-describedby={`period-extra-teaser-${activeCard.id}`}
      >
        <div className="period-extra-reader-shade" aria-hidden />
        <button
          ref={closeRef}
          type="button"
          className="period-extra-reader-close"
          onClick={onClose}
          aria-label={language === 'ru' ? 'Закрыть разбор' : 'Close reading'}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="period-extra-reader-scroll">
          <div className="period-extra-reader-copy">
            <p className="period-extra-reader-eyebrow">{eyebrow}</p>
            <h2 id={`period-extra-title-${activeCard.id}`}>{activeCard.title}</h2>
            <p
              className="period-extra-reader-teaser"
              id={`period-extra-teaser-${activeCard.id}`}
            >
              {activeCard.teaser}
            </p>
            <div className="period-extra-reader-body">
              {paragraphs.map((paragraph, index) => (
                <p key={`${activeCard.id}-${index}`}>{paragraph}</p>
              ))}
            </div>
            {activeCard.basisSummary ? (
              <aside className="period-extra-reader-basis">
                <h3>{language === 'ru' ? 'Почему такой вывод' : 'Why this conclusion'}</h3>
                <p>{activeCard.basisSummary}</p>
                {activeCard.basisDetails?.length ? (
                  <details>
                    <summary>{language === 'ru' ? 'Техническая основа' : 'Technical basis'}</summary>
                    <ul>
                      {activeCard.basisDetails.map((detail, index) => (
                        <li key={`${activeCard.id}-basis-${index}`}>{detail}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </aside>
            ) : null}
          </div>
        </div>
      </section>
    </div>,
    portalRoot,
  );
}
