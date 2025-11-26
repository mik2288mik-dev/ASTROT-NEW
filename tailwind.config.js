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
      boxShadow: {
        'soft': '0 4px 20px var(--shadow-color)',
        'glow': '0 0 15px var(--highlight)',
      },
      fontFamily: {
        serif: ['"Outfit"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
