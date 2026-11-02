/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          canvas: 'rgb(var(--bg-canvas) / <alpha-value>)',
          surface: 'rgb(var(--bg-surface) / <alpha-value>)',
          muted: 'rgb(var(--bg-muted) / <alpha-value>)',
          strong: 'rgb(var(--bg-strong) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
          placeholder: 'rgb(var(--text-placeholder) / <alpha-value>)',
          onBrand: 'rgb(var(--text-on-brand) / <alpha-value>)',
          onElevated: 'rgb(var(--text-on-elevated) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border-default) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand-default) / <alpha-value>)',
          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          softBorder: 'rgb(var(--brand-soft-border) / <alpha-value>)',
        },
        error: {
          DEFAULT: 'rgb(var(--status-error) / <alpha-value>)',
          strong: 'rgb(var(--status-error-strong) / <alpha-value>)',
          soft: 'rgb(var(--status-error-soft) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--status-success) / <alpha-value>)',
          strong: 'rgb(var(--status-success-strong) / <alpha-value>)',
          soft: 'rgb(var(--status-success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--status-warning) / <alpha-value>)',
          strong: 'rgb(var(--status-warning-strong) / <alpha-value>)',
          soft: 'rgb(var(--status-warning-soft) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--status-info) / <alpha-value>)',
          strong: 'rgb(var(--status-info-strong) / <alpha-value>)',
          soft: 'rgb(var(--status-info-soft) / <alpha-value>)',
        },
      },
      borderRadius: {
        sm: '10px',
        md: '14px',
        lg: '18px',
        xl: '22px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.10)',
        popover: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 10px 24px -6px rgb(0 0 0 / 0.12)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
