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

      /*
       * Shadows are tinted with the ink and brand colours, not neutral black:
       * a warm palette with grey shadows looks like it was pasted onto a
       * different page. Low and soft — nothing here should look lifted more
       * than a few millimetres.
       */
      boxShadow: {
        card: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.02)',
        'card-hover': '0 12px 28px -4px rgba(37, 99, 235, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.04)',
        soft: '0 4px 16px rgba(15, 23, 42, 0.04)',
        dropdown: '0 12px 32px -6px rgba(15, 23, 42, 0.14)',
        lifted: '0 20px 40px -10px rgba(37, 99, 235, 0.18), 0 4px 12px rgba(15, 23, 42, 0.04)',
        hero: '0 20px 40px -12px rgba(37, 99, 235, 0.35)',
        nav: '0 -1px 0 rgba(226, 232, 240, 0.8), 0 10px 30px rgba(15, 23, 42, 0.1)',
      },

      borderRadius: { xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.5rem' },

      backgroundImage: {
        // Modern royal blue dashboard hero gradients
        'hero-pasture': 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
        'hero-gradient': 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        'hero-blue': 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #2563eb 100%)',
        // Subtle cool radial dots for background depth
        'linen': 'radial-gradient(rgba(15, 23, 42, 0.035) 0.6px, transparent 0.6px)',
      },
      backgroundSize: { linen: '18px 18px' },

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
