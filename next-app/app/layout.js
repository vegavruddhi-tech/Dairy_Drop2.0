import { ClerkProvider } from '@clerk/nextjs';
import { Plus_Jakarta_Sans, Outfit, Noto_Sans_Devanagari } from 'next/font/google';
import { Toaster } from 'sonner';

import './globals.css';
import { getLocale, getMessages } from '@/i18n/server.js';
import { LocaleProvider } from '@/i18n/provider.jsx';
import { INDIC_LOCALES } from '@/i18n/config.js';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt.jsx';

/**
 * The original apps' type stack, loaded through next/font so the files are
 * self-hosted and there is no layout shift or third-party request.
 *
 *   Plus Jakarta Sans  body
 *   Outfit             headings and numbers
 *   Noto Sans Devanagari  Hindi and Gujarati, which the Latin faces cannot set
 */
const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const heading = Outfit({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-deva',
  display: 'swap',
});

export const metadata = {
  title: { default: 'DairyDrop', template: '%s · DairyDrop' },
  description: 'Daily milk delivery, managed.',
  icons: {
    icon: '/image.png',
    apple: '/image.png',
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'DairyDrop' },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0a09' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }) {
  // Resolved server-side so the first paint is already in the right language.
  // The old apps kept the locale in localStorage, so every page flashed
  // English before React hydrated and corrected it.
  const locale = await getLocale();
  const messages = await getMessages();
  const indic = INDIC_LOCALES.includes(locale);

  return (
    <html
      lang={locale}
      data-lang={locale}
      className={`${body.variable} ${heading.variable} ${devanagari.variable}`}
      suppressHydrationWarning
    >
      {/*
        `lang-hi` / `lang-gu` switch the body to Noto Sans Devanagari — the
        Latin faces have no coverage for either script.
      */}
      <body className={`min-h-dvh font-sans ${indic ? `lang-${locale}` : ''}`}>
        <ClerkProvider afterSignOutUrl="/">
          <LocaleProvider locale={locale} messages={messages}>
            {children}
            <PwaInstallPrompt />

            {/*
              Pill-shaped toasts, matching what the old apps showed: fully
              rounded, heavier weight, a generous drop shadow.
            */}
            <Toaster
              position="top-center"
              closeButton
              toastOptions={{
                duration: 3500,
                classNames: {
                  toast:
                    'rounded-full border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-dropdown',
                  success: 'border-positive/25 text-positive',
                  error: 'border-critical/25 text-critical',
                },
              }}
            />
          </LocaleProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
