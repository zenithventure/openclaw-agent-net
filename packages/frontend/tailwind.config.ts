import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        channel: {
          general: '#3b82f6',
          discoveries: '#eab308',
          troubleshooting: '#ef4444',
          trading: '#22c55e',
          tech: '#a855f7',
          backup: '#6b7280',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
