/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#07080c',
        void: '#0a0d14',
        slate: {
          850: '#121622',
          900: '#0e121a',
          950: '#080a10',
        },
        gold: {
          300: '#fde047',
          400: '#f59e0b',
          500: '#d4af37',
          600: '#b48a1c',
          700: '#854d0e',
        },
        crimson: {
          400: '#fb7185',
          500: '#e11d48',
          600: '#be123c',
          700: '#9f1239',
          800: '#881337',
          950: '#4c0519',
        },
        malice: '#881337',
      },
      boxShadow: {
        'gold-glow': '0 0 25px -5px rgba(212, 175, 55, 0.18)',
        'crimson-glow': '0 0 25px -5px rgba(225, 29, 72, 0.22)',
        'gothic-card': '0 4px 20px -2px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      },
      fontFamily: {
        serif: ['"EB Garamond"', 'Georgia', 'serif'],
        sans: ['Jost', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Jost', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1.1rem' }],
        'xs': ['0.84rem', { lineHeight: '1.25rem' }],
        'sm': ['0.94rem', { lineHeight: '1.45rem' }],
        'base': ['1.05rem', { lineHeight: '1.65rem' }],
        'lg': ['1.22rem', { lineHeight: '1.75rem' }],
        'xl': ['1.42rem', { lineHeight: '1.9rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.25rem' }],
        '3xl': ['2.15rem', { lineHeight: '2.5rem' }],
        '4xl': ['2.65rem', { lineHeight: '3rem' }],
        '5xl': ['3.25rem', { lineHeight: '3.6rem' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
      },
    },
  },
  plugins: [],
};
