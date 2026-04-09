import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './entrypoints/**/*.{ts,tsx,html}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#059669',
          dark: '#065f46',
          light: '#ecfdf5',
          border: '#a7f3d0',
        },
      },
    },
  },
  plugins: [],
};

export default config;
