/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: { DEFAULT: '#14161a', soft: '#3b3f47', mute: '#6b7079' },
        paper: { DEFAULT: '#faf8f4', card: '#ffffff', line: '#e7e2d8' },
        brand: { DEFAULT: '#7a2e1f', soft: '#f3e6e1', deep: '#5a1f14' },
      },
    },
  },
  plugins: [],
}
