'use client';

/**
 * NavigationProgress — thin top bar that appears instantly on any link
 * click and disappears when the new page is ready.
 *
 * Strategy:
 *   • `usePathname` change = navigation complete → hide bar
 *   • Any `<a>` click that is an internal same-origin link → show bar
 *
 * This gives the feel of instant feedback without needing an external
 * library. The bar animates to ~80% then waits; on pathname change it
 * jumps to 100% and fades out.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const prevPathname = useRef(pathname);
  const timerRef = useRef(null);
  const rafRef = useRef(null);

  // Start the bar
  function start() {
    clearTimeout(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    setVisible(true);
    setWidth(0);

    // Step up in increments to fake progress
    let w = 0;
    function step() {
      if (w < 20) w += 8;
      else if (w < 50) w += 5;
      else if (w < 70) w += 3;
      else if (w < 82) w += 1;
      else return; // hold at 82%, wait for pathname change
      setWidth(w);
      rafRef.current = requestAnimationFrame(() => {
        timerRef.current = setTimeout(step, 80);
      });
    }
    timerRef.current = setTimeout(step, 50);
  }

  // Complete the bar
  function complete() {
    clearTimeout(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    setWidth(100);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 350);
  }

  // Detect pathname change = navigation done
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      complete();
    }
  }, [pathname]);

  // Intercept all internal link clicks
  useEffect(() => {
    function handleClick(e) {
      const anchor = e.target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      // Only internal same-origin links, not hash-only, not external
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (anchor.target === '_blank') return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === pathname && url.search === window.location.search) return;
        start();
      } catch {
        // relative url that failed to parse — still internal
        if (!href.startsWith('http')) start();
      }
    }

    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }, [pathname]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    cancelAnimationFrame(rafRef.current);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Page loading"
      aria-valuenow={width}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        height: '3px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: 'linear-gradient(90deg, #2563eb 0%, #10b981 60%, #2563eb 100%)',
          backgroundSize: '200% 100%',
          transition: width === 100
            ? 'width 0.2s ease-out'
            : 'width 0.08s linear',
          animation: visible && width < 100 ? 'nprogress-shimmer 1.8s linear infinite' : 'none',
          borderRadius: '0 2px 2px 0',
          boxShadow: '0 0 8px rgba(37,99,235,0.6)',
          opacity: width === 0 ? 0 : 1,
        }}
      />
      <style>{`
        @keyframes nprogress-shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
}
