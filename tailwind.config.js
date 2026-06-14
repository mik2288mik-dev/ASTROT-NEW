/* eslint-disable @typescript-eslint/no-require-imports */
const flattenColorPalette =
  require('tailwindcss/lib/util/flattenColorPalette').default;

/**
 * @type {import('tailwindcss').Config}
 * Phase 8 AIR UI: порядок экранов — docs/AIR_UI_ROLLOUT.md
 */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './components/brand/**/*.{js,ts,jsx,tsx,mdx}',
    './components/layout/**/*.{js,ts,jsx,tsx,mdx}',
    './views/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        astro: {
          bg: 'var(--bg-primary)',
          card: 'var(--bg-card)',
          primary: 'var(--accent-primary)',
          secondary: 'var(--accent-secondary)',
          text: 'var(--text-main)',
          subtext: 'var(--text-sub)',
          highlight: 'var(--highlight)',
          border: 'var(--border-color)',
          orbit: 'var(--orbit-color)',
        },
        /** Lumia Studio AIR (Google) — matches lumia 2.0/src/index.css */
        'bg-warm': '#FFFFFF',
        'accent-gold': '#D4AF37',
        'text-main': '#2D2D2D',
        'text-muted': '#717171',
        lumiaHome: {
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
        /** Doodle / diary skin — hand-drawn personal-diary direction (docs/doodle-redesign.md) */
        doodle: {
          ink: '#20242A',
          paper: '#FFFFFF',
          muted: '#7C7770',
          hl: '#FFE36E',
          coral: '#FF6B6B',
          blue: '#4DA6FF',
          violet: '#9B7FD6',
          green: '#54C28A',
          pink: '#FF8FC4',
          syellow: '#FFE6A0',
          sblue: '#CFE6F7',
          sviolet: '#EFE8FC',
          spink: '#FFD3E6',
          sgreen: '#D8F0E2',
        },
      },
      fontSize: {
        'base': ['1rem', { lineHeight: '1.6' }],
        'lg': ['1.125rem', { lineHeight: '1.65' }],
        'xl': ['1.25rem', { lineHeight: '1.6' }],
        '2xl': ['1.5rem', { lineHeight: '1.4' }],
        '3xl': ['1.875rem', { lineHeight: '1.3' }],
      },
      maxWidth: {
        reading: '38rem',
        'reading-narrow': '34rem',
        'reading-wide': '42rem',
      },
      boxShadow: {
        'soft': '0 4px 20px var(--shadow-color)',
        'glow': '0 0 15px var(--highlight)',
      },
      fontFamily: {
        /** Display / section titles — Outfit (no Times/Cormorant). `font-serif` maps here for legacy classes. */
        serif: ['"Outfit"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        outfit: ['"Outfit"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        lumiaHome: ['"Manrope"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        lumiaHomeDisplay: ['"Geologica"', '"Manrope"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        lora: ['"Lora"', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        /** Doodle skin: handwritten display + small hand labels; body stays lumiaHome (Manrope) */
        doodleDisplay: ['"Caveat"', '"Ink Free"', '"Segoe Print"', 'cursive'],
        doodleHand: ['"Neucha"', '"Ink Free"', '"Segoe Print"', 'cursive'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      spacing: {
        reading: '0.75em',
        air: 'var(--space-air)',
        'air-sm': 'var(--space-air-sm)',
        'air-lg': 'var(--space-air-lg)',
      },
      borderRadius: {
        air: 'var(--radius-air)',
        'air-sm': 'var(--radius-air-sm)',
        'air-panel': 'var(--radius-air-panel)',
      },
    },
  },
  plugins: [addVariablesForColors],
}

function addVariablesForColors({ addBase, theme }) {
  const allColors = flattenColorPalette(theme('colors'));
  const newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, value]) => [`--${key}`, value])
  );

  addBase({
    ':root': newVars,
  });
}
