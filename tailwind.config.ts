import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        'sidebar-bg-light': '#ffffff',
        'sidebar-bg-dark': '#0F1A2E',
        'sidebar-hover-dark': '#16243C',
        'sidebar-active-dark': '#1F3A5F',
        'main-bg-light': '#F8FAFC',
        'main-bg-dark': '#0B1220',
        'card-bg-light': '#ffffff',
        'card-bg-dark': '#111C2E',
        'border-light': '#E2E8F0',
        'border-dark': '#22324A',
        'primary-accent': '#10b981',
        'secondary-accent': '#FBBF24',
      },
    },
  },
  plugins: [],
};

export default config;
