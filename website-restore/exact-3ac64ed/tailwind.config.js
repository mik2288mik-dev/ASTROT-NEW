/* eslint-disable @typescript-eslint/no-require-imports */
const flattenColorPalette =
  require('tailwindcss/lib/util/flattenColorPalette').default;

/**
 * @type {import('tailwindcss').Config}
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
        /** Studio AIR (Google) - matches the imported design source. */
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
        /** Fresh 2026 skin — white surfaces, blue accent (bridged from --fresh-*) */
        mono: {
          bg: '#FFFFFF',
          white: '#FFFFFF',
          plate: '#F7F8FA',
          ink: '#111827',
          muted: '#6B7280',
          line: 'rgba(17, 24, 39, 0.08)',
          // FRESH accent — blue, replaces the old pure-black accent
          accent: '#007AFF',
          black: '#111111',
        },
        /** Legacy doodle tokens — migrate away; kept for gradual removal */
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
        /** Approved product typography: Manrope everywhere. Legacy aliases stay for compatibility. */
        serif: ['"Manrope"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        sans: ['"Manrope"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        outfit: ['"Manrope"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        lumiaHome: ['"Manrope"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        lumiaHomeDisplay: ['"Manrope"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        lora: ['"Manrope"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        doodleDisplay: ['"Manrope"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        doodleHand: ['"Manrope"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
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
        'mono-card': 'var(--mono-radius-card)',
        'mono-pill': 'var(--mono-radius-pill)',
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
