/** @type {import('tailwindcss').Config} */

/**
 * Design tokens ported from the original three DairyDrop apps.
 *
 * The palette, type scale, shadows and radii are the ones the old
 * `client-customer` / `client-milkman` / `client-admin` builds shipped — the
 * emerald-forward look, the soft `0 10px 24px` card shadow, Plus Jakarta Sans
 * for body and Outfit for headings.
 *
 * What changed is only how they are *reached*: semantic names on top of CSS
 * variables, so one set of components serves light and dark instead of three
 * copies hard-coding hex values.
 */
export default {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Semantic layer (drives light/dark) ─────────────────────────────
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-muted': 'rgb(var(--surface-muted) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        'ink-muted': 'rgb(var(--ink-muted) / <alpha-value>)',
        'ink-subtle': 'rgb(var(--ink-subtle) / <alpha-value>)',
        brand: 'rgb(var(--brand) / <alpha-value>)',
        'brand-ink': 'rgb(var(--brand-ink) / <alpha-value>)',
        'brand-soft': 'rgb(var(--brand-soft) / <alpha-value>)',
        positive: 'rgb(var(--positive) / <alpha-value>)',
        'positive-soft': 'rgb(var(--positive-soft) / <alpha-value>)',
        caution: 'rgb(var(--caution) / <alpha-value>)',
        'caution-soft': 'rgb(var(--caution-soft) / <alpha-value>)',
        critical: 'rgb(var(--critical) / <alpha-value>)',
        'critical-soft': 'rgb(var(--critical-soft) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        'info-soft': 'rgb(var(--info-soft) / <alpha-value>)',

        // ── Literal scales, carried over unchanged ─────────────────────────
        // Kept so ported markup that reaches for `primary-600` still lands on
        // the exact colour it used to.
        primary: {
          50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
          400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
          800: '#166534', 900: '#14532d', 950: '#052e16',
        },
        promotional: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a',
        },
        accent: {
          50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe',
          400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce',
          800: '#6b21a8', 900: '#581c87',
        },
      },

      fontFamily: {
        sans: ['var(--font-body)', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'Outfit', 'system-ui', 'sans-serif'],
        // Hindi and Gujarati need Devanagari coverage the Latin faces lack.
        deva: ['var(--font-deva)', '"Noto Sans Devanagari"', 'sans-serif'],
        numeric: ['var(--font-heading)', 'ui-monospace', 'monospace'],
      },

      boxShadow: {
        card: '0 10px 24px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 14px 26px rgba(15, 23, 42, 0.06)',
        soft: '0 8px 18px rgba(15, 23, 42, 0.04)',
        dropdown: '0 8px 24px -4px rgba(0, 0, 0, 0.12)',
        lifted: '0 20px 50px rgba(16, 185, 129, 0.12), 0 4px 16px rgba(0, 0, 0, 0.04)',
        hero: '0 18px 40px -12px rgba(6, 78, 59, 0.45)',
        nav: '0 8px 30px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(16, 185, 129, 0.15)',
      },

      borderRadius: { xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.5rem' },

      backgroundImage: {
        // The signature dashboard banner.
        'hero-emerald': 'linear-gradient(135deg, #065f46 0%, #134e4a 55%, #020617 100%)',
        'hero-gradient': 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
      },

      screens: { xs: '375px' },

      keyframes: {
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'none' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-12px) rotate(1deg)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.06)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'scale-in': 'scaleIn 0.25s ease-out forwards',
        'bounce-in': 'bounceIn 0.4s cubic-bezier(0.68,-0.55,0.265,1.55)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'pulse-glow': 'pulseGlow 4s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        'float-slow': 'floatSlow 6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
      },

      transitionTimingFunction: { 'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)' },
    },
  },
  plugins: [],
};
