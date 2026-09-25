'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const SNOOZE_STORAGE_KEY = 'dairydrop_pwa_dismissed_until';
const SNOOZE_DAYS = 3; // Snooze banner for 3 days if dismissed

// Global listener store for beforeinstallprompt so any component gets the event
let globalDeferredPrompt = null;
const promptListeners = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    promptListeners.forEach((listener) => listener(e));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((listener) => listener(null));
    try {
      localStorage.setItem('dairydrop_pwa_installed', 'true');
    } catch {
      // ignore
    }
    toast.success('DairyDrop has been installed to your home screen!');
  });
}

/**
 * Universal Hook for PWA installation handling across all platforms:
 * - Android / Chrome / Edge (Native beforeinstallprompt)
 * - iOS / iPhone / iPad (Safari Add to Home Screen modal guide)
 * - Desktop (Chrome, Edge, Safari, Firefox)
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(globalDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // default true to prevent SSR flash
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Detect Standalone / Already Installed Mode
    const checkStandalone = () => {
      const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavStandalone = window.navigator.standalone === true;
      const isAndroidApp = document.referrer.includes('android-app://');
      const savedInstalled = localStorage.getItem('dairydrop_pwa_installed') === 'true';
      return isDisplayStandalone || isNavStandalone || isAndroidApp || savedInstalled;
    };

    const standalone = checkStandalone();
    setIsStandalone(standalone);
    setIsInstalled(standalone);

    // 2. Detect Platform
    const ua = window.navigator.userAgent || '';
    const isIosDevice =
      (/iPad|iPhone|iPod/.test(ua) ||
        (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)) &&
      !window.MSStream;
    const isAndroidDevice = /Android/i.test(ua);
    const isDesktopDevice = !isIosDevice && !isAndroidDevice;

    setIsIos(isIosDevice);
    setIsAndroid(isAndroidDevice);
    setIsDesktop(isDesktopDevice);

    // 3. Register Service Worker if supported
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.debug('SW Registration:', err));
    }

    // 4. Check dismissal snooze
    try {
      const dismissedUntil = localStorage.getItem(SNOOZE_STORAGE_KEY);
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    } catch {
      setIsDismissed(false);
    }

    // 5. Subscribe to deferred prompt changes
    const onPromptChange = (prompt) => {
      setDeferredPrompt(prompt);
    };
    promptListeners.add(onPromptChange);

    // Listen to display-mode changes
    const mql = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e) => {
      if (e.matches) {
        setIsStandalone(true);
        setIsInstalled(true);
      }
    };
    mql.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      promptListeners.delete(onPromptChange);
      mql.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  // Dismiss / Snooze banner
  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
    try {
      const snoozeUntil = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(SNOOZE_STORAGE_KEY, String(snoozeUntil));
    } catch {
      // ignore
    }
  }, []);

  // Main install trigger
  const triggerInstall = useCallback(async () => {
    // If native prompt is available (Android / Chromium / Desktop Chrome / Edge)
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
          globalDeferredPrompt = null;
          setIsInstalled(true);
          dismissBanner();
        }
      } catch (err) {
        console.warn('Native PWA install prompt error:', err);
        setIsModalOpen(true);
      }
    } else {
      // For iOS Safari or browsers without beforeinstallprompt, open informative step-by-step modal
      setIsModalOpen(true);
    }
  }, [deferredPrompt, dismissBanner]);

  return {
    isStandalone,
    isInstalled,
    isIos,
    isAndroid,
    isDesktop,
    canInstall: !isStandalone && (Boolean(deferredPrompt) || isIos || isDesktop),
    deferredPrompt,
    isDismissed,
    isModalOpen,
    setIsModalOpen,
    dismissBanner,
    triggerInstall,
  };
}
