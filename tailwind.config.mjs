/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        void: '#0c0e14',
        slate: {
          850: '#141822',
          900: '#0f172a',
          950: '#0b0f19',
        },
        gold: {
          400: '#f59e0b',
          500: '#d4af37',
          600: '#b48a1c',
          700: '#854d0e',
        },
        crimson: {
          500: '#e11d48',
          600: '#be123c',
          700: '#9f1239',
        },
      },
      fontFamily: {
        serif: ['Cinzel', 'Trajan Pro', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
