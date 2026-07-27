// Keep the standalone website isolated from the mobile app's root Tailwind setup.
// The marketing site currently uses plain CSS, so it must not inherit
// ../postcss.config.js, which requires Tailwind dependencies from the app.
const config = {
  plugins: {},
};

export default config;
