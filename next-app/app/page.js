import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getActor } from '@/auth/session.js';
import { ROLE_HOME } from '@/auth/roles.js';
import { getLocale } from '@/i18n/server.js';
import { LanguageToggle } from '@/components/ui/LanguageToggle.jsx';
import { PwaInstallButton } from '@/components/pwa/PwaInstallButton.jsx';
import { BackgroundParticles } from '@/components/ui/BackgroundParticles.jsx';
import { LandingInteractiveSection } from '@/components/landing/LandingInteractiveSection.jsx';
import {
  DeliveryIcon,
  UsersIcon,
  CheckCircleIcon,
  CalendarIcon,
  PaymentsIcon,
  ShieldCheckIcon,
} from '@/components/ui/Icons.jsx';

/**
 * World-Class Modern SaaS Landing Page (Blue & White Design System).
 * Dual Language Support (English & Hindi) with English Product Names Preserved.
 */
export default async function LandingPage() {
  const actor = await getActor();
  if (actor) redirect(ROLE_HOME[actor.role] ?? '/sign-in');

  const locale = await getLocale();
  const isHi = locale === 'hi';

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#fafcff] text-slate-900 selection:bg-blue-600 selection:text-white antialiased">
      {/* ── AMBIENT ANIMATED BACKGROUND PARTICLES & GLOWS ──────────────────── */}
      <BackgroundParticles count={45} />

      {/* ── HEADER NAVBAR ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-white/85 border-b border-slate-200/80 shadow-[0_2px_15px_rgba(0,0,0,0.03)] transition-all">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-1 border border-slate-200/80 shadow-md shadow-blue-500/10 transition-transform group-hover:scale-105 group-active:scale-95">
              <img
                src="/icon-512.png"
                alt="DairyDrop"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-lg font-black tracking-tight text-slate-950 leading-none">
                DairyDrop
              </span>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                {isHi ? 'ताज़ा दूध प्लेटफॉर्म' : 'Fresh Milk Platform'}
              </span>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-bold text-slate-600">
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors py-1">
              {isHi ? 'यह कैसे काम करता है' : 'How It Works'}
            </a>
            <a href="#comparison" className="hover:text-blue-600 transition-colors py-1">
              {isHi ? 'DairyDrop क्यों?' : 'Why DairyDrop'}
            </a>
            <a href="#faq" className="hover:text-blue-600 transition-colors py-1">
              {isHi ? 'सामान्य प्रश्न' : 'FAQ'}
            </a>
            <Link href="/pricing" className="hover:text-blue-600 transition-colors py-1">
              {isHi ? 'विक्रेता शुल्क' : 'Vendor Pricing'}
            </Link>
          </nav>

          {/* Nav Actions */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/sign-in"
              className="hidden sm:inline-flex items-center rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 transition-colors"
            >
              {isHi ? 'लॉग इन' : 'Sign In'}
            </Link>
            <PwaInstallButton variant="compact" />
            <LanguageToggle variant="compact" className="h-9" />
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-3.5 py-2 font-heading text-xs font-bold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
            >
              {isHi ? 'शुरू करें' : 'Get Started'}
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ──────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-5 pt-10 pb-24 sm:px-8 sm:pt-16 space-y-20">
        <div className="relative mx-auto max-w-3xl text-center space-y-6 animate-fade-in">
          {/* Status Pill Badge with Live Animation */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-200/90 bg-white/95 px-4 py-1.5 text-xs font-bold text-blue-700 shadow-sm shadow-blue-500/10 backdrop-blur-sm transition-transform hover:scale-105 cursor-default">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
            </span>
            <span>
              {isHi
                ? 'सुबह 6:00 बजे तक डिलीवरी • सुरक्षित एवं फार्म से सीधे ताज़ा'
                : 'Doorstep Delivery by 6:00 AM • Contactless & Farm Fresh'}
            </span>
          </div>

          {/* Main Hero Headline */}
          <h1 className="font-heading text-4xl font-black tracking-tight text-slate-950 sm:text-6xl sm:leading-[1.12]">
            {isHi ? (
              <>
                दैनिक ताज़ा दूध, <br />
                <span className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  सरल, पारदर्शी और 100% विश्वसनीय।
                </span>
              </>
            ) : (
              <>
                Daily Fresh Milk, <br />
                <span className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Simple & 100% Reliable.
                </span>
              </>
            )}
          </h1>

          <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg leading-relaxed font-normal">
            {isHi
              ? 'सीधे अपने स्थानीय सत्यापित दूध विक्रेता से जुड़ें। कभी भी मात्रा बदलें, 1-क्लिक में छुट्टी पॉज़ करें और UPI से पारदर्शी मासिक बिल भरें।'
              : 'Connect directly with verified local milkmen. Modify delivery quantities anytime, skip vacations in 1-click, and pay transparent monthly bills with UPI.'}
          </p>

          {/* Floating Live Notification Badge */}
          <div className="hidden sm:inline-flex items-center gap-3 rounded-2xl border border-blue-100 bg-white/95 px-4 py-2.5 text-xs font-medium text-slate-700 shadow-xl shadow-blue-500/10 backdrop-blur-md animate-float">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold">
              ✓
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>{isHi ? 'सुबह का राउंड पूरा' : 'Morning Round Completed'}</span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                  5:48 AM
                </span>
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                {isHi ? 'फ्लैट 402 • 2.0L शुद्ध गाय का दूध दरवाजे पर पहुंचाया' : 'Flat 402 • 2.0L Cow Milk Placed on Doorstep'}
              </p>
            </div>
          </div>
        </div>

        {/* ── DUAL HERO ACTION CARDS (Household vs Milkman) ────────────────── */}
        <div className="grid gap-7 sm:grid-cols-2">
          {/* Card 1: Consumer / Household */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-blue-100/90 bg-white p-7 sm:p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600" />

            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 group-hover:scale-105">
                  <DeliveryIcon className="h-6 w-6" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200/60">
                  {isHi ? 'ग्राहकों व परिवारों के लिए' : 'For Consumers'}
                </span>
              </div>

              <div>
                <h2 className="font-heading text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                  {isHi ? 'मुझे ताज़ा दूध चाहिए (ग्राहक)' : 'I Want Fresh Milk (Customer)'}
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  {isHi
                    ? 'अपनी पसंदीदा स्थानीय डेयरी से जुड़ें। दिन छोड़ें, लीटर बदलें और सुबह की सुरक्षित डिलीवरी पाएं।'
                    : 'Subscribe to your favorite local dairy. Skip days, adjust litres, and enjoy contactless morning deliveries.'}
                </p>
              </div>

              {/* Interactive Widget Micro-Demo */}
              <div className="rounded-2xl border border-blue-100/80 bg-blue-50/40 p-4 text-xs text-slate-700 space-y-2.5 transition-all group-hover:bg-blue-50/70">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {isHi ? 'कल की डिलीवरी (6:00 AM)' : "Tomorrow's Delivery (6:00 AM)"}
                  </span>
                  <span className="rounded-lg bg-blue-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                    2.0 Litres
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-blue-100 pt-2 font-medium">
                  <span>Pure Cow Milk • Doorstep</span>
                  <span className="font-bold text-blue-700 flex items-center gap-1">
                    <CheckCircleIcon className="h-3.5 w-3.5 text-blue-600" />
                    {isHi ? '1-टैप पॉज़ उपलब्ध' : '1-Tap Pause Ready'}
                  </span>
                </div>
              </div>

              {/* Feature Points */}
              <div className="grid grid-cols-2 gap-2.5 text-xs font-bold text-slate-700 pt-1">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>{isHi ? 'सुबह 6:00 AM डिलीवरी' : '6:00 AM Delivery'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>{isHi ? '1-टैप छुट्टी पॉज़' : '1-Tap Vacation Pause'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>{isHi ? 'दैनिक डिजिटल खाता' : 'Itemized Daily Ledger'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>{isHi ? 'डायरेक्ट UPI भुगतान' : 'Direct UPI Billing'}</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="mt-8 pt-2">
              <Link
                href="/register"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 font-heading text-sm font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-lg active:scale-[0.99]"
              >
                <span>{isHi ? 'ग्राहक के रूप में जुड़ें' : 'Get Started as Customer'}</span>
                <span className="font-sans font-bold">→</span>
              </Link>
            </div>
          </div>

          {/* Card 2: Milkman / Dairy Vendor */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-slate-200 bg-white p-7 sm:p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-600 hover:shadow-2xl hover:shadow-slate-500/10">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-slate-400 to-blue-600" />

            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 group-hover:scale-105">
                  <UsersIcon className="h-6 w-6" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 border border-slate-200">
                  {isHi ? 'डेयरी व दूध विक्रेताओं के लिए' : 'For Dairies & Vendors'}
                </span>
              </div>

              <div>
                <h2 className="font-heading text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                  {isHi ? 'मुझे दूध बेचना है (दूधवाला)' : 'I Want to Sell Milk (Milkman)'}
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  {isHi
                    ? 'दैनिक डिलीवरी मार्ग स्वचालित करें, कागज़ की डायरी बंद करें और UPI QR कोड से समय पर पूरा भुगतान प्राप्त करें।'
                    : 'Automate your daily delivery routes, eliminate paper registers, and collect payments on time with UPI QR codes.'}
                </p>
              </div>

              {/* Vendor Widget Micro-Demo */}
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 text-xs text-slate-700 space-y-2.5 transition-all group-hover:bg-slate-100/70">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                    {isHi ? 'सुबह की डिलीवरी शीट' : 'Morning Round Sheet'}
                  </span>
                  <span className="rounded-lg bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                    64 Customers • 108 Litres
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/80 pt-2 font-medium">
                  <span>{isHi ? 'ऑटोमैटिक रूट और एक्स्ट्रा ऑर्डर' : 'Auto-calculated Route & Extras'}</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                    {isHi ? 'स्वचालित खाता' : 'Automatic Ledger'}
                  </span>
                </div>
              </div>

              {/* Feature Points */}
              <div className="grid grid-cols-2 gap-2.5 text-xs font-bold text-slate-700 pt-1">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>{isHi ? '7 दिन मुफ़्त ट्रायल' : '7-Day Free Trial'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>{isHi ? 'डिजिटल डिलीवरी शीट' : 'Digital Route Sheet'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>{isHi ? '0% कमीशन' : 'Zero Commission'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>{isHi ? 'UPI QR से वसूली' : 'UPI QR Collections'}</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="mt-8 pt-2">
              <Link
                href="/become-a-milkman"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-600 bg-white px-6 py-3.5 font-heading text-sm font-bold text-blue-600 shadow-sm transition-all hover:bg-blue-600 hover:text-white active:scale-[0.99]"
              >
                <span>{isHi ? 'दूध विक्रेता / डेयरी के रूप में आवेदन करें' : 'Apply as Milkman / Dairy'}</span>
                <span className="font-sans font-bold">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── KEY METRICS & TRUST STRIP ────────────────────────────────────── */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm transition-all hover:shadow-md">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-center">
            <div className="pt-2 sm:pt-0">
              <p className="font-heading text-3xl sm:text-4xl font-black text-blue-600">6:00 AM</p>
              <p className="mt-1 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                {isHi ? 'सुबह की डिलीवरी' : 'Morning Delivery'}
              </p>
            </div>
            <div className="pt-4 sm:pt-0 sm:pl-6">
              <p className="font-heading text-3xl sm:text-4xl font-black text-slate-900">1-Tap</p>
              <p className="mt-1 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                {isHi ? 'छुट्टी पॉज़' : 'Vacation Pause'}
              </p>
            </div>
            <div className="pt-4 sm:pt-0 sm:pl-6">
              <p className="font-heading text-3xl sm:text-4xl font-black text-blue-600">100%</p>
              <p className="mt-1 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                {isHi ? 'डायरेक्ट डेयरी को UPI' : 'Direct UPI to Dairy'}
              </p>
            </div>
            <div className="pt-4 sm:pt-0 sm:pl-6">
              <p className="font-heading text-3xl sm:text-4xl font-black text-slate-900">7 Days</p>
              <p className="mt-1 text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                {isHi ? 'मुफ़्त वेंडर ट्रायल' : 'Free Vendor Trial'}
              </p>
            </div>
          </div>
        </div>

        {/* ── 3 STEP WORKFLOW SECTION ──────────────────────────────────────── */}
        <div id="how-it-works" className="space-y-10 scroll-mt-24">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              {isHi ? 'सरल एवं तेज़' : 'Simple & Fast'}
            </span>
            <h3 className="font-heading text-3xl font-black text-slate-950 sm:text-4xl">
              {isHi ? 'DairyDrop कैसे काम करता है' : 'How DairyDrop Works'}
            </h3>
            <p className="text-sm text-slate-600 font-medium">
              {isHi
                ? 'हर सुबह फार्म से सीधे ताज़ा दूध पाने के लिए केवल 3 आसान चरण।'
                : 'Seamless 3-step setup to enjoy pure farm-fresh milk every morning.'}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {(isHi
              ? [
                  {
                    step: '01',
                    title: 'स्थानीय डेयरी खोजें',
                    desc: 'अपने 6-अंकों का पिनकोड दर्ज करके अपने अपार्टमेंट या सेक्टर में सेवा देने वाले सत्यापित दूधवाले खोजें।',
                  },
                  {
                    step: '02',
                    title: 'दैनिक मात्रा तय करें',
                    desc: 'अपनी आवश्यकता के अनुसार दैनिक मात्रा (जैसे 1L या 2L Cow Milk / Buffalo Milk) चुनें।',
                  },
                  {
                    step: '03',
                    title: 'डोरस्टेप डिलीवरी व UPI',
                    desc: 'हर सुबह दरवाजे पर ताज़ा दूध पाएं। जब बाहर जाएं तो 1-टैप में पॉज़ करें और UPI से बिल भरें।',
                  },
                ]
              : [
                  {
                    step: '01',
                    title: 'Find Local Dairies',
                    desc: 'Enter your 6-digit delivery pincode to discover verified milkmen serving your specific apartment or sector.',
                  },
                  {
                    step: '02',
                    title: 'Set Your Quantity',
                    desc: 'Choose your desired daily quantity (e.g. 1L or 2L Cow Milk / Buffalo Milk) and preferred delivery instructions.',
                  },
                  {
                    step: '03',
                    title: 'Doorstep Delivery & UPI',
                    desc: 'Receive pure milk every morning. Skip days whenever you travel, and pay exact monthly totals via UPI QR.',
                  },
                ]
            ).map((item) => (
              <div
                key={item.step}
                className="group relative rounded-3xl border border-slate-200/90 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading text-4xl font-black text-blue-600/30 group-hover:text-blue-600 transition-colors">
                    {item.step}
                  </span>
                  <span className="flex h-3 w-3 rounded-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h4 className="mt-4 font-heading text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h4>
                <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── COMPARISON & FAQ SECTION ─────────────────────────────────────── */}
        <LandingInteractiveSection />

        {/* ── BOTTOM HIGH CONVERTING BANNER ────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-8 sm:p-14 text-white shadow-2xl shadow-blue-600/25 text-center">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-2xl" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-5">
            <h3 className="font-heading text-3xl font-black tracking-tight sm:text-5xl sm:leading-tight">
              {isHi
                ? 'सुबह 6:00 बजे ताज़ा दूध पाने के लिए तैयार हैं?'
                : 'Ready for Pure Milk Delivered by 6:00 AM?'}
            </h3>
            <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
              {isHi
                ? 'भारत के सबसे विश्वसनीय ताज़ा दूध प्लेटफॉर्म पर हज़ारों परिवारों और स्थानीय डेयरियों से जुड़ें।'
                : 'Join thousands of households and verified local dairies on India’s most reliable fresh milk platform.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 font-heading text-sm font-bold text-blue-700 shadow-lg hover:bg-blue-50 transition-all active:scale-[0.98]"
              >
                <span>{isHi ? 'ग्राहक के रूप में जुड़ें' : 'Start as Customer'}</span>
                <span>→</span>
              </Link>

              <Link
                href="/become-a-milkman"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-white/80 bg-white/10 px-7 py-4 font-heading text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 transition-all"
              >
                <span>{isHi ? 'डेयरी वेंडर के रूप में रजिस्टर करें' : 'Register as Dairy Vendor'}</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── FOOTER BAR ───────────────────────────────────────────────────── */}
        <footer className="border-t border-slate-200/90 pt-8 pb-4 text-xs text-slate-500">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <img
                src="/icon-512.png"
                alt="DairyDrop"
                className="h-7 w-7 rounded-lg object-contain bg-white p-0.5 border border-slate-200"
              />
              <p className="font-medium">© {new Date().getFullYear()} DairyDrop. {isHi ? 'सर्वाधिकार सुरक्षित।' : 'All rights reserved.'}</p>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-6 font-semibold text-slate-600">
              <a href="#how-it-works" className="hover:text-blue-600 transition-colors">
                {isHi ? 'यह कैसे काम करता है' : 'How It Works'}
              </a>
              <a href="#comparison" className="hover:text-blue-600 transition-colors">
                {isHi ? 'DairyDrop क्यों' : 'Why DairyDrop'}
              </a>
              <a href="#faq" className="hover:text-blue-600 transition-colors">
                {isHi ? 'सामान्य प्रश्न' : 'FAQ'}
              </a>
              <Link href="/pricing" className="hover:text-blue-600 transition-colors">
                {isHi ? 'विक्रेता शुल्क' : 'Vendor Pricing'}
              </Link>
              <Link href="/become-a-milkman" className="hover:text-blue-600 transition-colors">
                {isHi ? 'दूध बेचें' : 'Sell Milk'}
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

