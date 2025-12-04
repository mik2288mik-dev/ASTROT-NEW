/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
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
        }
      },
      fontSize: {
        'base': ['1rem', { lineHeight: '1.6' }],
        'lg': ['1.125rem', { lineHeight: '1.65' }],
        'xl': ['1.25rem', { lineHeight: '1.6' }],
        '2xl': ['1.5rem', { lineHeight: '1.4' }],
        '3xl': ['1.875rem', { lineHeight: '1.3' }],
      },
      maxWidth: {
        'reading': '65ch',
        'reading-narrow': '55ch',
        'reading-wide': '75ch',
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
        'reading': '0.75em',
      }
    },
  },
  plugins: [],
}
