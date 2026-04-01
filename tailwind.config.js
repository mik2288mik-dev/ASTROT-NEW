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
        'bg-warm': '#FDFCFB',
        'accent-gold': '#D4AF37',
        'text-main': '#2D2D2D',
        'text-muted': '#717171',
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
        serif: ['"Outfit"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
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
  plugins: [],
}
