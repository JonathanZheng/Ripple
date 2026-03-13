/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand colours
        background:  '#0f0f14',
        surface:     '#1a1a24',
        'surface-2': '#24243a',
        accent:      '#6c63ff',
        'accent-2':  '#ff6584',
        // Quest tag colours
        food:        '#f97316',
        transport:   '#3b82f6',
        social:      '#a855f7',
        skills:      '#22c55e',
        errands:     '#eab308',
        // Trust tiers
        wanderer:    '#94a3b8',
        explorer:    '#60a5fa',
        champion:    '#fbbf24',
        // Status
        success:     '#22c55e',
        warning:     '#f59e0b',
        danger:      '#ef4444',
        muted:       '#6b7280',
      },
    },
  },
  plugins: [],
};
