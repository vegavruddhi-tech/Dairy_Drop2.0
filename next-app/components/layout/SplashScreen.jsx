'use client';

/**
 * SplashScreen — Pure Procedural Vector & Hydrodynamic Fluid Animation
 *
 * Designed from scratch with ZERO static image files:
 * 1. Droplet descent with aerodynamic squash & stretch physics
 * 2. High-speed photography "Milk Crown Splash" eruption with parabolic droplet coronets
 * 3. Animated vector glass bottle drawing with dynamic liquid milk wave sloshing inside
 * 4. Fresh organic green leaf bloom & droplet badge assembly
 * 5. Kinetic typography wave wipe + live precision progress counter (0% -> 100%)
 * 6. Flawless execution across both Desktop browsers and Mobile PWA
 */

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 2600;

export function SplashScreen() {
  const [phase, setPhase] = useState('splash'); // 'splash' | 'exit' | 'done'
  const [progress, setProgress] = useState(0);
  const [waveHeight, setWaveHeight] = useState(0); // 0% to 100% inside bottle
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    // ── PROGRESS COUNTER & BOTTLE FILL ──
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(Math.floor((elapsed / (DURATION_MS - 500)) * 100), 100);
      setProgress(pct);

      // Bottle fill starts after splash impact at 600ms
      if (elapsed > 500) {
        const fillElapsed = elapsed - 500;
        const fillPct = Math.min(Math.floor((fillElapsed / 1400) * 100), 100);
        setWaveHeight(fillPct);
      }
    }, 25);

    const exitTimer = setTimeout(() => setPhase('exit'), DURATION_MS - 350);
    const doneTimer = setTimeout(() => setPhase('done'), DURATION_MS + 250);

    return () => {
      clearInterval(interval);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  // ── CANVAS CROWN SPLASH & FLUID DYNAMICS ──
  useEffect(() => {
    if (phase === 'done') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const centerX = width / 2;
    // Splash impact point sits near top of the bottle neck
    const centerY = height * 0.38;

    // ── 1. The Falling Droplet ──
    let dropY = centerY - 180;
    let dropVel = 0;
    const dropGrav = 0.55;
    let dropImpacted = false;

    // ── 2. Crown Splash Droplets ──
    const crownCount = 12;
    const crownDroplets = [];
    for (let i = 0; i < crownCount; i++) {
      const angle = (i / crownCount) * Math.PI * 2;
      const radSpeed = Math.random() * 2.8 + 2.2;
      crownDroplets.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * radSpeed,
        vy: -Math.random() * 6 - 4.5, // initial upward burst
        gravity: 0.22,
        radius: Math.random() * 3.5 + 2.5,
        alpha: 1,
        active: false,
      });
    }

    // ── 3. Concentric Surface Ripples ──
    const ripples = [];
    for (let i = 0; i < 5; i++) {
      ripples.push({
        r: 0,
        maxR: 160 + i * 50,
        alpha: 0,
        active: false,
        delay: i * 8,
      });
    }

    // ── 4. Ambient Floating Milk Micro-Pearls ──
    const ambientPearls = Array.from({ length: 30 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -Math.random() * 0.8 - 0.2, // rising gently like effervescence
      radius: Math.random() * 2.5 + 1,
      alpha: Math.random() * 0.4 + 0.2,
    }));

    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      // Render Ambient Micro-Pearls
      ambientPearls.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) p.y = height;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.shadowColor = 'rgba(147, 197, 253, 0.8)';
        ctx.shadowBlur = 6;
        ctx.fill();
      });

      // ── RENDER FALLING DROPLET (frames 0 to impact) ──
      if (!dropImpacted) {
        dropVel += dropGrav;
        dropY += dropVel;

        if (dropY >= centerY) {
          dropImpacted = true;
          // Trigger crown droplets
          crownDroplets.forEach((d) => (d.active = true));
          // Trigger ripples
          ripples.forEach((r) => (r.active = true));
        } else {
          // Draw falling droplet with stretch physics
          ctx.save();
          ctx.translate(centerX, dropY);
          const stretch = Math.min(1.4, 1 + dropVel * 0.035);
          ctx.scale(1 / stretch, stretch);

          // Liquid drop gradient
          const grad = ctx.createRadialGradient(-3, -5, 2, 0, 0, 14);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.7, '#f0f9ff');
          grad.addColorStop(1, '#93c5fd');

          ctx.beginPath();
          ctx.moveTo(0, -18);
          ctx.bezierCurveTo(12, -6, 14, 12, 0, 16);
          ctx.bezierCurveTo(-14, 12, -12, -6, 0, -18);
          ctx.fillStyle = grad;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
          ctx.shadowBlur = 14;
          ctx.fill();
          ctx.restore();
        }
      }

      // ── RENDER CROWN SPLASH DROPLETS ──
      crownDroplets.forEach((d) => {
        if (!d.active) return;
        d.x += d.vx;
        d.vy += d.gravity;
        d.y += d.vy;
        d.alpha = Math.max(0, d.alpha - 0.014);

        if (d.alpha > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.radius * d.alpha, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${d.alpha * 0.95})`;
          ctx.shadowColor = 'rgba(147, 197, 253, 0.9)';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.restore();
        }
      });

      // ── RENDER CONCENTRIC LIQUID RIPPLES ──
      ripples.forEach((r) => {
        if (!r.active) return;
        if (r.delay > 0) {
          r.delay--;
          return;
        }
        r.r += (r.maxR - r.r) * 0.06 + 1.2;
        r.alpha = Math.max(0, 0.65 * (1 - r.r / r.maxR));

        if (r.alpha > 0.01) {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, r.r, r.r * 0.36, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
          ctx.lineWidth = Math.max(1, 2.8 * (1 - r.r / r.maxR));
          ctx.shadowColor = 'rgba(96, 165, 250, 0.7)';
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.restore();
        }
      });

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      aria-hidden="true"
      className="splash-cinema-root"
      data-phase={phase}
    >
      {/* Dynamic Fluid Canvas Background */}
      <canvas ref={canvasRef} className="splash-canvas" />

      {/* Atmospheric Caustic Glow */}
      <div className="splash-aurora" />

      {/* Skip Button for Desktop / Quick Test */}
      <button
        type="button"
        onClick={() => setPhase('exit')}
        className="splash-skip-btn"
        aria-label="Skip loading animation"
      >
        <span>Skip</span>
        <span>→</span>
      </button>

      {/* ── CENTRAL PROCEDURAL ANIMATION STAGE ── */}
      <div className="splash-stage">
        {/* Animated Vector Milk Bottle Lockup */}
        <div className="bottle-anim-container">
          {/* Ambient Glow Aura */}
          <div className="bottle-glow" />

          {/* Pure SVG Animated Glass Milk Bottle & Dynamic Fluid Slosh */}
          <svg
            viewBox="0 0 160 220"
            className="bottle-svg"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Milk Fluid Gradient */}
              <linearGradient id="milkFluid" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#f0f9ff" />
                <stop offset="100%" stopColor="#dbeafe" />
              </linearGradient>

              {/* Glass Rim Stroke Gradient */}
              <linearGradient id="glassStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#93c5fd" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.95" />
              </linearGradient>

              {/* Leaf Gradient */}
              <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>

              {/* Clip path matching inside of the bottle */}
              <clipPath id="bottleInsideClip">
                <path d="M52 28 C52 28 62 28 80 28 C98 28 108 28 108 28 C108 28 104 55 118 72 C126 82 128 98 128 120 C128 175 120 196 80 196 C40 196 32 175 32 120 C32 98 34 82 42 72 C56 55 52 28 52 28 Z" />
              </clipPath>
            </defs>

            {/* 1. Inside Milk Liquid with Live Animated Sine Wave */}
            <g clipPath="url(#bottleInsideClip)">
              {/* Fluid Fill Rectangle raised by waveHeight */}
              <g
                style={{
                  transform: `translateY(${196 - (waveHeight / 100) * 168}px)`,
                  transition: 'transform 0.08s linear',
                }}
              >
                {/* Sine Wave Crest Path */}
                <path
                  d="M0 12 Q20 2, 40 12 T80 12 T120 12 T160 12 L160 220 L0 220 Z"
                  fill="url(#milkFluid)"
                  className="milk-wave-slosh"
                />
                {/* Secondary highlight foam crest */}
                <path
                  d="M0 14 Q20 6, 40 14 T80 14 T120 14 T160 14"
                  stroke="#ffffff"
                  strokeWidth="3"
                  fill="none"
                  opacity="0.85"
                />
              </g>
            </g>

            {/* 2. Vector Glass Bottle Outline with Stroke Draw Animation */}
            <path
              d="M52 28 C52 28 62 28 80 28 C98 28 108 28 108 28 C108 28 104 55 118 72 C126 82 128 98 128 120 C128 175 120 196 80 196 C40 196 32 175 32 120 C32 98 34 82 42 72 C56 55 52 28 52 28 Z"
              stroke="url(#glassStroke)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="bottle-outline-path"
            />

            {/* Bottle Rim Lip */}
            <rect
              x="48"
              y="22"
              width="64"
              height="8"
              rx="4"
              stroke="url(#glassStroke)"
              strokeWidth="3.5"
              fill="rgba(255,255,255,0.25)"
              className="bottle-lip-path"
            />

            {/* Glass Specular Reflection Highlight */}
            <path
              d="M42 85 C39 96 38 112 38 135 C38 160 41 175 48 185"
              stroke="#ffffff"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.65"
              className="bottle-specular"
            />

            {/* 3. Blooming Fresh Green Leaf Vector (Blooms when bottle is half full) */}
            <g
              className="leaf-bloom-group"
              style={{
                transform: waveHeight > 35 ? 'scale(1) rotate(0deg)' : 'scale(0) rotate(-45deg)',
                transformOrigin: '76px 126px',
                transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <path
                d="M76 128 C64 128 54 118 54 104 C68 104 78 114 78 128 Z"
                fill="url(#leafGrad)"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <path
                d="M58 118 Q66 116 74 125"
                stroke="#ffffff"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.8"
              />
            </g>

            {/* Speed Streamlines on the Left */}
            <g className="streamlines" opacity={waveHeight > 50 ? 0.9 : 0}>
              <line x1="16" y1="92" x2="28" y2="92" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
              <line x1="10" y1="104" x2="26" y2="104" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" />
              <line x1="14" y1="116" x2="28" y2="116" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
            </g>
          </svg>
        </div>

        {/* ── KINETIC TYPOGRAPHY REVEAL ── */}
        <div className="splash-brand-lockup">
          <div className="splash-title">
            <span className="title-dairy">Dairy</span>
            <span className="title-drop">Drop</span>
          </div>

          <p className="splash-tagline">
            Daily Milk Delivery, Managed.
          </p>
        </div>

        {/* ── LIVE LIQUID PROGRESS METER (0% to 100%) ── */}
        <div className="splash-progress-unit">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            >
              <span className="progress-glow-head" />
            </div>
          </div>
          <div className="progress-label">
            <span>Farm Fresh Doorstep by 6:00 AM</span>
            <span className="progress-number">{progress}%</span>
          </div>
        </div>
      </div>

      <style>{`
        .splash-cinema-root {
          position: fixed;
          inset: 0;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: radial-gradient(circle at 50% 36%, #1e40af 0%, #172554 55%, #080c16 100%);
          opacity: 1;
          transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                      transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                      filter 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Iris Exit Transition */
        .splash-cinema-root[data-phase='exit'] {
          opacity: 0;
          transform: scale(1.06);
          filter: blur(10px);
          pointer-events: none;
        }

        .splash-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        .splash-aurora {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 65% 50% at 50% 40%, rgba(37, 99, 235, 0.4) 0%, transparent 75%);
          pointer-events: none;
          z-index: 2;
        }

        /* Skip Button */
        .splash-skip-btn {
          position: absolute;
          top: max(20px, env(safe-area-inset-top, 20px));
          right: max(20px, env(safe-area-inset-right, 20px));
          z-index: 50;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px);
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .splash-skip-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          color: #ffffff;
          transform: scale(1.05);
        }

        /* Stage */
        .splash-stage {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 20px;
        }

        /* ── BOTTLE CONTAINER ── */
        .bottle-anim-container {
          position: relative;
          width: 140px;
          height: 190px;
          display: flex;
          align-items: center;
          justify-content: center;
          perspective: 800px;
          animation: bottleEntrance 0.8s 0.2s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
          opacity: 0;
          transform: scale(0.65) translateY(30px);
        }

        @keyframes bottleEntrance {
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .bottle-glow {
          position: absolute;
          inset: 0;
          border-radius: 40px;
          background: radial-gradient(circle, rgba(96, 165, 250, 0.5) 0%, rgba(37, 99, 235, 0.15) 60%, transparent 80%);
          filter: blur(24px);
          animation: glowBreathe 2s ease-in-out infinite alternate;
        }

        @keyframes glowBreathe {
          from { opacity: 0.5; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1.15); }
        }

        .bottle-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
          filter: drop-shadow(0 18px 36px rgba(0, 0, 0, 0.4));
        }

        /* Path stroke drawing animation */
        .bottle-outline-path {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: strokeDraw 1s 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .bottle-lip-path {
          opacity: 0;
          animation: fadeIn 0.4s 0.8s forwards;
        }

        .bottle-specular {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: strokeDraw 0.8s 0.9s ease-out forwards;
        }

        @keyframes strokeDraw {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }

        /* Milk Liquid Slosh Wave */
        .milk-wave-slosh {
          animation: sloshWave 1.8s ease-in-out infinite alternate;
        }

        @keyframes sloshWave {
          0% {
            transform: translateX(-15px) skewX(2deg);
          }
          100% {
            transform: translateX(15px) skewX(-2deg);
          }
        }

        /* Streamlines animation */
        .streamlines {
          transition: opacity 0.4s;
          animation: streamlinesPulse 1.2s ease-in-out infinite alternate;
        }

        @keyframes streamlinesPulse {
          0% { transform: translateX(0); }
          100% { transform: translateX(4px); }
        }

        /* ── BRAND LOCKUP ── */
        .splash-brand-lockup {
          margin-top: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0;
          transform: translateY(12px);
          animation: textReveal 0.6s 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes textReveal {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .splash-title {
          font-family: var(--font-heading, 'Outfit', sans-serif);
          font-size: 2.25rem;
          font-weight: 900;
          letter-spacing: -0.035em;
          line-height: 1.1;
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .title-dairy {
          color: #ffffff;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
        }

        .title-drop {
          background: linear-gradient(135deg, #60a5fa 0%, #93c5fd 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 10px rgba(96, 165, 250, 0.4));
        }

        .splash-tagline {
          margin-top: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(224, 242, 254, 0.78);
          letter-spacing: 0.01em;
        }

        /* ── PROGRESS BAR ── */
        .splash-progress-unit {
          margin-top: 26px;
          width: 220px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          opacity: 0;
          animation: textReveal 0.5s 0.7s ease-out forwards;
        }

        .progress-track {
          width: 100%;
          height: 5px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.16);
          overflow: hidden;
          position: relative;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .progress-fill {
          height: 100%;
          border-radius: 9999px;
          background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 65%, #ffffff 100%);
          position: relative;
          box-shadow: 0 0 14px rgba(96, 165, 250, 0.85);
          transition: width 0.08s linear;
        }

        .progress-glow-head {
          position: absolute;
          right: 0;
          top: -2px;
          bottom: -2px;
          width: 8px;
          border-radius: 9999px;
          background: #ffffff;
          box-shadow: 0 0 10px 2px #ffffff, 0 0 18px 4px #60a5fa;
        }

        .progress-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.7rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.65);
          letter-spacing: 0.02em;
        }

        .progress-number {
          font-family: var(--font-heading, sans-serif);
          font-weight: 800;
          color: #93c5fd;
        }

        /* ── ACCESSIBILITY ── */
        @media (prefers-reduced-motion: reduce) {
          .splash-cinema-root {
            transition-duration: 0.01ms !important;
          }
          .bottle-anim-container,
          .splash-brand-lockup,
          .splash-progress-unit {
            animation-duration: 0.01ms !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}


