import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
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
                  }
                }
              }
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
