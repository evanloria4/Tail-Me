// Colors the app uses resolve to CSS variables (RGB channels) defined in
// src/styles/main.css: light by default, the original dark palette under
// `html.dark`. Classes keep their dark-era names (`bg-gray-950` = page,
// `text-white` = primary text), so components don't change per theme.
const themed = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (name: string, steps: number[]) =>
  Object.fromEntries(steps.map((s) => [s, themed(`${name}-${s}`)]));

module.exports = {
  content: [
    './dist/index.html', // The HTML file you're serving
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        white: themed('white'),
        // Payouts on won bets
        win: themed('win'),
        gray: scale(
          'gray',
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
        ),
        emerald: scale('emerald', [400, 500]),
        red: scale('red', [400]),
        yellow: scale('yellow', [300]),
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(0.75rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'toast-in': 'toast-in 200ms ease-out',
      },
    },
  },
};
