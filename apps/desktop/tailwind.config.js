/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--text)',
        canvas: 'var(--canvas)',
        primary: 'var(--primary)',
        positive: 'var(--positive)',
        negative: 'var(--negative)',
        warning: 'var(--warning)'
      },
      boxShadow: { panel: '0 1px 2px rgba(15, 23, 42, .04), 0 8px 26px rgba(15, 23, 42, .04)' }
    }
  },
  plugins: []
}
