/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Tight', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: '#050608',
        surface: '#0B0D10',
        card: '#10141A',
        line: '#1C2128',
        line2: '#262C36',
        muted: '#6B7280',
        soft: '#9CA3AF',
        emerald: {
          DEFAULT: '#10B981',
          glow: 'rgba(16,185,129,0.15)',
        },
        danger: '#EF4444',
        warn: '#F59E0B',
        // Legacy app colors kept for /app route
        bg: '#000000',
        bg2: '#050505',
        bg3: '#080808',
        green: '#10d98a',
        red: '#ff4d6a',
        orange: '#ff8c42',
        blue: '#4db8ff',
        textMuted: '#666666',
        textMain: '#f0f0f0',
      }
    }
  },
  plugins: []
}
