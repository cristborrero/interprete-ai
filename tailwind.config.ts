import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#000000', // Black
          1: '#0F0F0F',       // Very Dark Panel
          2: '#1A1A1A',       // Dark Panel
          3: '#262626',       // Control Background
        },
        border: {
          DEFAULT: '#333333', // Dark Gray
          active: '#646464',  // Gray
        },
        brand: {
          orange: '#FF600C',
          red: '#FF1300',
        },
        text: {
          primary: '#ffffff', // White
          secondary: '#C3C3C3', // Light Gray
          muted: '#646464', // Gray
        },
      },
      boxShadow: {
        'premium': '0 8px 30px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'premium-hover': '0 12px 40px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'glow-es': '0 0 40px -8px rgba(255, 96, 12, 0.28)', // Brand Orange
        'glow-en': '0 0 40px -8px rgba(255, 19, 0, 0.28)', // Brand Red
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        'fade-up': 'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'waveform': 'waveform 0.8s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '0.2', transform: 'scale(1.1)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'waveform': {
          from: { transform: 'scaleY(0.3)' },
          to: { transform: 'scaleY(1)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
