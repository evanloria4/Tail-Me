// Runs in <head> before the page paints (a file, since the CSP blocks inline
// scripts): sets dark mode and the top-of-screen color right away, so phones
// never flash the wrong color while the app loads. Same rules as lib/theme:
// a stored choice wins, otherwise follow the phone's own setting.
(function boot() {
  const COLORS = { light: '#f2f4f6', dark: '#030712' };
  let choice = null;
  try {
    choice = localStorage.getItem('tailme-theme');
  } catch (e) {
    choice = null;
  }
  const phoneDark =
    !!window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  let theme = phoneDark ? 'dark' : 'light';
  if (choice === 'dark' || choice === 'light') theme = choice;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', COLORS[theme]);
})();
