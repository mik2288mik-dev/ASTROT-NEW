import { useEffect } from 'react';

/**
 * One soft shadow under every card and tile in the app. Styles are spread over many screens and the flat editorial
 * rules switch shadows off in places, so instead of listing classes the shell looks at what is drawn: a rounded,
 * filled or bordered block of card size gets `data-nebo-card`, and one CSS rule (styles/cardShadows.css) draws the shadow.
 */

const MIN_WIDTH = 120;
const MIN_HEIGHT = 52;
const MIN_RADIUS = 14;
const SKIP_INSIDE = '.lumia-bottom-tab-shell, .app-top-bar, .video-bg, .asset-slot, .sky-hero, [data-no-card-shadow]';
const SKIP_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'SVG', 'CANVAS', 'IMG', 'VIDEO', 'OPTION']);
const CANDIDATES = 'button, a, article, section, li, div, label, details, summary';

function hasFill(style: CSSStyleDeclaration): boolean {
  if (style.backgroundImage !== 'none') return true;
  const match = /rgba?\(([^)]+)\)/.exec(style.backgroundColor);
  if (!match) return false;
  const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return (parts.length < 4 ? 1 : parts[3]) > 0.4;
}

function hasBorder(style: CSSStyleDeclaration): boolean {
  return parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none' && !/rgba\(\d+, \d+, \d+, 0\)/.test(style.borderTopColor);
}

function looksLikeCard(element: HTMLElement, viewportWidth: number): boolean {
  if (SKIP_TAGS.has(element.tagName.toUpperCase()) || element.closest(SKIP_INSIDE)) return false;
  const box = element.getBoundingClientRect();
  if (box.width < MIN_WIDTH || box.height < MIN_HEIGHT || box.width >= viewportWidth - 6) return false;
  const style = getComputedStyle(element);
  if (parseFloat(style.borderTopLeftRadius) < MIN_RADIUS) return false;
  if (style.position === 'fixed' || style.position === 'absolute') return false;
  if (!hasFill(style) && !hasBorder(style)) return false;
  // A pill-shaped button is a control, not a card.
  if (box.height < 64 && parseFloat(style.borderTopLeftRadius) >= box.height / 2 - 1) return false;
  // Rows inside a card stay flat: only the outer block lifts.
  const parent = element.parentElement?.closest('[data-nebo-card]');
  return !parent;
}

export function useCardShadows(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return undefined;
    const pending = new Set<HTMLElement>();
    let timer = 0;

    const mark = (root: HTMLElement) => {
      const viewportWidth = window.innerWidth;
      const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>(CANDIDATES))];
      // Outer blocks first, so a card claims its area before the rows inside it are looked at.
      nodes.forEach((node) => {
        if (node.hasAttribute('data-nebo-card')) return;
        if (looksLikeCard(node, viewportWidth)) node.setAttribute('data-nebo-card', '');
      });
    };

    const flush = () => {
      timer = 0;
      pending.forEach((node) => { if (node.isConnected) mark(node); });
      pending.clear();
    };
    const schedule = () => { if (!timer) timer = window.setTimeout(flush, 350); };

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => { if (node instanceof HTMLElement) pending.add(node); });
      });
      if (pending.size) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    pending.add(document.body);
    schedule();
    // Content that appears through classes or images shortly after mount.
    const late = window.setInterval(() => { pending.add(document.body); schedule(); }, 4000);
    return () => { observer.disconnect(); window.clearTimeout(timer); window.clearInterval(late); };
  }, []);
}
