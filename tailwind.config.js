/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Deep Enterprise palette
        ink: {
          950: '#0B101B',
          900: '#111827', // fondo principal
          850: '#151B26',
          800: '#1F2937', // paneles / tarjetas
          750: '#252B3A', // contenedores elevados
          700: '#2D3545',
          650: '#374151', // bordes
          600: '#4B5563',
          500: '#6B7280', // texto muted
          400: '#9CA3AF', // texto secundario
          300: '#D1D5DB',
          200: '#E5E7EB',
          100: '#F3F4F6', // texto principal
        },
        accent: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981', // acento brillante
          600: '#059669',
          700: '#047857', // primario
          800: '#065F46',
          900: '#064E3B',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.25)',
        'card-lg': '0 10px 30px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.35)',
        'inner-ring': 'inset 0 0 0 1px #374151',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: 0.7 },
          '100%': { transform: 'scale(1.6)', opacity: 0 },
        },
      },
      animation: {
        pulseRing: 'pulseRing 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};
