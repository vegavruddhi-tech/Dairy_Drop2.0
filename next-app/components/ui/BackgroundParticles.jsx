'use client';

import React, { useEffect, useRef } from 'react';

/**
 * High-Performance Interactive Canvas Particle Background.
 * Renders smooth floating glowing particles, subtle connection lines,
 * and ambient blue radiant lighting for the Blue & White design system.
 */
export function BackgroundParticles({ count = 38 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Particle nodes
    const particles = [];
    const colors = [
      'rgba(37, 99, 235, 0.65)',   // primary blue
      'rgba(59, 130, 246, 0.6)',   // light blue
      'rgba(96, 165, 250, 0.5)',   // sky blue
      'rgba(79, 70, 229, 0.55)',   // indigo blue
    ];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 3 + 2, // 2px to 5px
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 0.7, // gentle velocity X
        vy: (Math.random() - 0.5) * 0.7, // gentle velocity Y
        pulse: Math.random() * Math.PI,
        pulseSpeed: Math.random() * 0.02 + 0.01,
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle connective links between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.15 * (1 - dist / 130)})`;
            ctx.lineWidth = 1;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and update each particle
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Bounce on boundaries
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Pulsing glow
        p.pulse += p.pulseSpeed;
        const currentRadius = p.radius + Math.sin(p.pulse) * 0.8;

        // Outer glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          currentRadius * 2.5
        );
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, currentRadius * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Inner solid core
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, currentRadius), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [count]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* ── AMBIENT GLOW ORBS ──────────────────────────────────────────────── */}
      <div className="absolute -top-32 left-1/2 h-[500px] w-[850px] -translate-x-1/2 rounded-full bg-gradient-to-b from-blue-300/30 via-blue-100/20 to-transparent blur-3xl animate-pulse-glow" />
      <div className="absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-blue-200/25 blur-3xl animate-float-slow" />
      <div className="absolute top-2/3 -right-32 h-96 w-96 rounded-full bg-indigo-200/25 blur-3xl animate-float" />

      {/* ── ARCHITECTURAL GRID BACKGROUND ──────────────────────────────────── */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f070_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f070_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_10%,#000_60%,transparent_100%)]" />

      {/* ── LIVE INTERACTIVE CANVAS PARTICLES ───────────────────────────────── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-80"
      />
    </div>
  );
}
