export const lumiaHomeTokens = {
  color: {
    bg: 'var(--lumia-home-bg)',
    surface: 'var(--lumia-home-surface)',
    surfaceSoft: 'var(--lumia-home-surface-soft)',
    text: 'var(--lumia-home-text)',
    muted: 'var(--lumia-home-muted)',
    purple: 'var(--lumia-home-purple)',
    purpleDeep: 'var(--lumia-home-purple-deep)',
    lavender: 'var(--lumia-home-lavender)',
    plum: 'var(--lumia-home-plum)',
    peach: 'var(--lumia-home-peach)',
    line: 'var(--lumia-home-line)',
  },
  radius: {
    pill: 'var(--lumia-home-radius-pill)',
    button: 'var(--lumia-home-radius-button)',
    card: 'var(--lumia-home-radius-card)',
    panel: 'var(--lumia-home-radius-panel)',
    nav: 'var(--lumia-home-radius-nav)',
  },
  space: {
    pageX: 'var(--lumia-home-page-x)',
    gapSm: 'var(--lumia-home-gap-sm)',
    gapMd: 'var(--lumia-home-gap-md)',
    gapLg: 'var(--lumia-home-gap-lg)',
  },
  shadow: {
    card: 'var(--lumia-home-shadow-card)',
    lifted: 'var(--lumia-home-shadow-lifted)',
    nav: 'var(--lumia-home-shadow-nav)',
  },
  typography: {
    sans: 'var(--lumia-home-font-sans)',
    display: 'var(--lumia-home-font-display)',
  },
} as const;

export type LumiaHomeTokens = typeof lumiaHomeTokens;
