'use client';

/**
 * SplashScreen — app open animation.
 *
 * Plays once per browser session (sessionStorage flag). On subsequent
 * navigations within the tab the splash is skipped entirely so it never
 * interrupts in-app routing.
 *
 * Sequence:
 *   0 ms   — overlay is visible, logo is invisible
 *   100 ms — logo + ring scale in
 *   900 ms — rings pulse, tagline fades up
 *   1700 ms — everything fades + scales out, overlay lifts
 *   1900 ms — component unmounts
 */

import { useEffect, useState } from 'react';

const DURATION_MS = 1900;
const SKIP_KEY = 'dd_splash_shown';

export function SplashScreen() {
  // Three states: 'splash' | 'exit' | 'done'
  const [phase, setPhase] = useState(() => {
    // SSR guard — always start visible, then check sessionStorage in effect
    return 'splash';
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Skip if already shown this session
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SKIP_KEY)) {
      setPhase('done');
      return;
    }

    setMounted(true);
    sessionStorage.setItem(SKIP_KEY, '1');

    // Begin exit animation
    const exitTimer = setTimeout(() => setPhase('exit'), DURATION_MS - 300);
    // Unmount after exit animation completes
    const doneTimer = setTimeout(() => setPhase('done'), DURATION_MS + 100);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      aria-hidden="true"
      className="splash-root"
      data-phase={phase}
      data-mounted={mounted}
    >
      {/* Background gradient */}
      <div className="splash-bg" />

      {/* Animated rings */}
      <div className="splash-rings">
        <span className="ring ring-1" />
        <span className="ring ring-2" />
        <span className="ring ring-3" />
      </div>

      {/* Logo lockup */}
      <div className="splash-logo-wrap">
        <div className="splash-icon-frame">
          {/* Drop SVG */}
          <svg
            viewBox="0 0 48 60"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="splash-drop"
          >
            {/* Drop body */}
            <path
              d="M24 2C24 2 4 22 4 36C4 48.15 13.4 58 24 58C34.6 58 44 48.15 44 36C44 22 24 2 24 2Z"
              fill="white"
              fillOpacity="0.95"
            />
            {/* Inner highlight */}
            <path
              d="M17 26C17 26 11 33 11 38.5C11 43.75 15.25 48 20 47"
              stroke="rgba(37,99,235,0.35)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Letter D centred inside drop */}
          <span className="splash-letter">D</span>
        </div>

        {/* Brand name */}
        <p className="splash-brand">DairyDrop</p>
        <p className="splash-tagline">Daily milk delivery, managed.</p>
      </div>

      {/* Bottom loading bar */}
      <div className="splash-bar-track">
        <div className="splash-bar-fill" />
      </div>

      <style>{`
        .splash-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          /* Start visible */
          opacity: 1;
          transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                      transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Exit: fade + tiny scale-down */
        .splash-root[data-phase='exit'] {
          opacity: 0;
          transform: scale(1.04);
          pointer-events: none;
        }

        /* ── Background ─────────────────────────────────────────────── */
        .splash-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(145deg, #1e40af 0%, #2563eb 45%, #1d4ed8 100%);
        }

        /* Soft radial glow behind logo */
        .splash-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse 65% 55% at 50% 44%,
            rgba(255,255,255,0.13) 0%,
            transparent 70%
          );
        }

        /* ── Animated rings ─────────────────────────────────────────── */
        .splash-rings {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .ring {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 9999px;
          border: 1.5px solid rgba(255,255,255,0.18);
          transform: translate(-50%, -60%) scale(0);
          opacity: 0;
        }

        /* Only animate when actually mounted (not on SSR) */
        .splash-root[data-mounted='true'] .ring-1 {
          width: 220px; height: 220px;
          animation: ring-pulse 1.6s 0.2s ease-out forwards;
        }
        .splash-root[data-mounted='true'] .ring-2 {
          width: 320px; height: 320px;
          animation: ring-pulse 1.6s 0.4s ease-out forwards;
        }
        .splash-root[data-mounted='true'] .ring-3 {
          width: 440px; height: 440px;
          animation: ring-pulse 1.6s 0.6s ease-out forwards;
        }

        @keyframes ring-pulse {
          0%   { transform: translate(-50%, -60%) scale(0.5); opacity: 0; }
          30%  { opacity: 1; }
          100% { transform: translate(-50%, -60%) scale(1); opacity: 0; }
        }

        /* ── Logo lockup ────────────────────────────────────────────── */
        .splash-logo-wrap {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          /* Hidden until mounted */
          opacity: 0;
          transform: translateY(16px) scale(0.92);
        }

        .splash-root[data-mounted='true'] .splash-logo-wrap {
          animation: logo-in 0.55s 0.1s cubic-bezier(0.34, 1.48, 0.64, 1) forwards;
        }

        @keyframes logo-in {
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Icon frame ─────────────────────────────────────────────── */
        .splash-icon-frame {
          position: relative;
          width: 96px;
          height: 96px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 12px 32px rgba(0,0,0,0.28));
        }

        .splash-drop {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          transform-origin: center bottom;
          animation: drop-bounce 1s 0.65s ease-in-out;
        }

        @keyframes drop-bounce {
          0%   { transform: scaleY(1); }
          30%  { transform: scaleY(0.88) scaleX(1.08); }
          55%  { transform: scaleY(1.06) scaleX(0.96); }
          75%  { transform: scaleY(0.97) scaleX(1.02); }
          100% { transform: scaleY(1) scaleX(1); }
        }

        .splash-letter {
          position: relative;
          z-index: 1;
          font-family: var(--font-heading, 'Outfit', sans-serif);
          font-size: 2.5rem;
          font-weight: 900;
          color: #2563eb;
          letter-spacing: -0.04em;
          line-height: 1;
          margin-top: 6px; /* optical centering inside drop shape */
          user-select: none;
        }

        /* ── Text labels ────────────────────────────────────────────── */
        .splash-brand {
          margin-top: 16px;
          font-family: var(--font-heading, 'Outfit', sans-serif);
          font-size: 1.75rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }

        .splash-tagline {
          margin-top: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
          color: rgba(255,255,255,0.65);
          letter-spacing: 0.01em;
          opacity: 0;
        }

        .splash-root[data-mounted='true'] .splash-tagline {
          animation: fade-up 0.5s 0.75s ease-out forwards;
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Loading bar ────────────────────────────────────────────── */
        .splash-bar-track {
          position: absolute;
          bottom: max(40px, calc(env(safe-area-inset-bottom, 0px) + 32px));
          left: 50%;
          transform: translateX(-50%);
          width: 120px;
          height: 3px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.18);
          overflow: hidden;
          opacity: 0;
        }

        .splash-root[data-mounted='true'] .splash-bar-track {
          animation: bar-appear 0.3s 0.3s ease-out forwards;
        }

        @keyframes bar-appear {
          to { opacity: 1; }
        }

        .splash-bar-fill {
          height: 100%;
          width: 0%;
          border-radius: 9999px;
          background: rgba(255,255,255,0.85);
        }

        .splash-root[data-mounted='true'] .splash-bar-fill {
          animation: bar-fill ${DURATION_MS - 200}ms 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes bar-fill {
          0%   { width: 0%; }
          60%  { width: 75%; }
          85%  { width: 90%; }
          100% { width: 100%; }
        }

        /* ── Reduced motion ─────────────────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .splash-root {
            transition-duration: 0.01ms !important;
          }
          .splash-root[data-mounted='true'] .ring-1,
          .splash-root[data-mounted='true'] .ring-2,
          .splash-root[data-mounted='true'] .ring-3,
          .splash-root[data-mounted='true'] .splash-logo-wrap,
          .splash-root[data-mounted='true'] .splash-drop,
          .splash-root[data-mounted='true'] .splash-tagline,
          .splash-root[data-mounted='true'] .splash-bar-track,
          .splash-root[data-mounted='true'] .splash-bar-fill {
            animation-duration: 0.01ms !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
