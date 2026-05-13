export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        primary:  '#6366F1',
        primary2: '#818CF8',
        teal:     '#14B8A6',
        amber:    '#F59E0B',
        green:    '#10B981',
        danger:   '#EF4444',
      },
      borderRadius: { '2xl': '16px', '3xl': '20px' },
      boxShadow: {
        card:    '0 4px 24px rgba(0,0,0,0.20)',
        glow:    '0 8px 32px rgba(99,102,241,0.30)',
        'glow-teal': '0 8px 32px rgba(20,184,166,0.25)',
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease',
        'slide-up': 'slideUp 0.25s ease',
      },
    },
  },
  plugins: [],
}
