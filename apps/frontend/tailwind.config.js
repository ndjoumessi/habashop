/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5B4EE8',
          hover: '#7C6FF0',
          light: '#A89CF5',
        },
        accent: { DEFAULT: '#F0A500', green: '#0EC47E', danger: '#E8404A' },
        bg: {
          DEFAULT: '#0C0B14',
          2: '#13121F',
          3: '#1C1A2E',
          4: '#252340',
        },
        card: { DEFAULT: '#181628', 2: '#201E34' },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          2: 'rgba(255,255,255,0.12)',
        },
        text: {
          DEFAULT: '#EEEDF8',
          2: '#8886A8',
          3: '#5A5878',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { DEFAULT: '12px' },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
