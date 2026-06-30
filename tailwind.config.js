/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#07070A',
        card: '#111114',
        border: '#1E1E24',
        accent: '#F5C418',
        'accent-dim': '#C49B0D',
        muted: '#8B8B9A',
        surface: '#18181D',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
