import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        surface: '#1a1d27',
        border: '#2a2d3e',
        accent: '#20c4cb',
        'text-primary': '#e2e8f0',
        'text-secondary': '#6b7280',
      },
    },
  },
  plugins: [],
} satisfies Config
