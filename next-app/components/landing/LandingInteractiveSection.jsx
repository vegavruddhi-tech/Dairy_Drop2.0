'use client';

import React, { useState } from 'react';
import { useT } from '@/i18n/provider.jsx';

export function LandingInteractiveSection() {
  const [openFaq, setOpenFaq] = useState(0);
  const { locale } = useT();
  const isHi = locale === 'hi';

  const comparisonRows = isHi
    ? [
        {
          feature: 'डिलीवरी का समय',
          oldWay: 'अनिश्चित (सुबह 6:30 - 9:30 बजे)',
          newWay: 'सुबह 6:00 बजे तक निश्चित डिलीवरी',
        },
        {
          feature: 'छुट्टी व डिलीवरी पॉज़',
          oldWay: 'फ़ोन कॉल / भूल जाना / दूध की बर्बादी',
          newWay: 'रात 10 बजे से पहले ऐप में 1-टैप पॉज़',
        },
        {
          feature: 'मासिक हिसाब व बिल',
          oldWay: 'कागज़ की डायरी और गलतफहमियां',
          newWay: 'पारदर्शी डिजिटल खाता और WhatsApp PDF बिल',
        },
        {
          feature: 'भुगतान का तरीका',
          oldWay: 'खुले पैसे या नकद की किचकिच',
          newWay: '100% डायरेक्ट UPI QR से तुरंत भुगतान',
        },
        {
          feature: 'मात्रा में बदलाव',
          oldWay: 'दूधवाले को आवाज़ लगाना या मैसेज',
          newWay: 'ऐप में 1-क्लिक में कभी भी मात्रा बदलें',
        },
        {
          feature: 'दूध विक्रेता प्रबंधन',
          oldWay: 'हिसाब भूलना और बकाया न मिलना',
          newWay: 'ऑटोमैटिक डिलीवरी शीट व समय पर UPI',
        },
      ]
    : [
        {
          feature: 'Delivery Timing',
          oldWay: 'Unpredictable (6:30 - 9:30 AM)',
          newWay: 'Guaranteed by 6:00 AM Contactless',
        },
        {
          feature: 'Vacation & Pauses',
          oldWay: 'Calling / forgotten pauses / wasted milk',
          newWay: '1-Tap In-App Pause before 10 PM',
        },
        {
          feature: 'Monthly Ledger & Bills',
          oldWay: 'Handwritten paper diaries with disputes',
          newWay: 'Itemized Digital Ledger & WhatsApp PDF',
        },
        {
          feature: 'Payment Method',
          oldWay: 'Exact cash change or overdue disputes',
          newWay: '100% Direct UPI QR (Instant & Transparent)',
        },
        {
          feature: 'Quantity Modifications',
          oldWay: 'Shouting out or messaging milkman',
          newWay: 'Modify anytime with 1 click in app',
        },
        {
          feature: 'Vendor Management',
          oldWay: 'Lost milk records & uncollected dues',
          newWay: 'Automated Route Sheets & Fast UPI',
        },
      ];

  const faqItems = isHi
    ? [
        {
          q: 'ग्राहकों के लिए DairyDrop कैसे काम करता है?',
          a: 'बस अपना पिनकोड दर्ज करें, अपने पसंदीदा सत्यापित दूध विक्रेता को चुनें, अपनी दैनिक आवश्यकता (जैसे 1L या 2L Cow Milk / Buffalo Milk) सेट करें और घर का पता दर्ज करें। आपके दूधवाले हर सुबह 6:00 बजे से पहले आपके दरवाजे पर ताजा दूध पहुंचाएंगे।',
        },
        {
          q: 'यदि मैं छुट्टी पर जाऊं या बाहर जाना हो?',
          a: 'आप रात 10:00 बजे से पहले ऐप में 1-टैप करके किसी भी दिन की डिलीवरी रोक सकते हैं। उस दिन दूध नहीं आएगा और बिल में शून्य शुल्क जुड़ेगा।',
        },
        {
          q: 'महीने का भुगतान कैसे होता है?',
          a: 'महीने के अंत में, DairyDrop आपके केवल प्राप्त किए गए दूध का सटीक बिल तैयार करता है। आप सीधे अपने दूधवाले के UPI QR कोड पर 100% सुरक्षित भुगतान करते हैं।',
        },
        {
          q: 'दूध विक्रेता (Milkman) DairyDrop का उपयोग कैसे करते हैं?',
          a: 'दूध विक्रेताओं को दैनिक डिजिटल रूट शीट, छुट्टी की लाइव सूचनाएं, ग्राहकों का स्वचालित खाता और WhatsApp बिलिंग मिलती है। बिना किसी कमीशन के 7 दिनों का फ्री ट्रायल उपलब्ध है।',
        },
        {
          q: 'क्या ग्राहकों के लिए कोई अतिरिक्त शुल्क है?',
          a: 'बिल्कुल नहीं! ग्राहकों के लिए सदस्यता लेना, डिलीवरी ट्रैक करना और छुट्टी मैनेज करना 100% मुफ़्त है। आप केवल लिए गए दूध का मूल्य चुकाते हैं।',
        },
      ]
    : [
        {
          q: 'How does DairyDrop work for customers?',
          a: 'Simply enter your pincode, pick your favorite verified local dairy partner, select your preferred daily milk quantity (e.g., 1L or 2L), and provide your apartment/doorstep address. Your milkman delivers fresh milk every morning before 6:00 AM.',
        },
        {
          q: 'What if I go on vacation or travel?',
          a: 'You can pause your daily milk delivery anytime with a single tap in the app before 10:00 PM. No milk will be delivered, and zero charges will be added to your ledger.',
        },
        {
          q: 'How do monthly payments work?',
          a: 'At the end of each billing cycle, DairyDrop automatically compiles your exact delivered litres into an itemized bill. You pay 100% directly to your milkman via UPI QR code.',
        },
        {
          q: 'How do milkmen and dairies use DairyDrop?',
          a: 'Milkmen get a dedicated vendor portal with a daily digital route sheet, instant vacation notifications, automatic customer ledgers, and automated WhatsApp billing reminders. Dairies enjoy a 7-day free trial with zero commission on milk revenue.',
        },
        {
          q: 'Are there any hidden subscription charges for households?',
          a: 'No! Using DairyDrop to subscribe, track deliveries, and manage your milk schedule is 100% free for households. You only pay for the exact milk you receive.',
        },
      ];

  return (
    <div className="space-y-20">
      {/* ── COMPARISON SECTION ────────────────────────────────────────────── */}
      <section id="comparison" className="space-y-8 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {isHi ? 'आधुनिक अपग्रेड' : 'The Modern Upgrade'}
          </span>
          <h2 className="font-heading text-3xl font-black text-slate-950 sm:text-4xl">
            {isHi ? 'पारंपरिक दूधवाला बनाम DairyDrop' : 'Traditional Milkman vs DairyDrop'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            {isHi
              ? 'जानिए क्यों हज़ारों परिवार और स्थानीय दूध विक्रेता DairyDrop पर भरोसा करते हैं।'
              : 'See why thousands of households and local dairies have switched to DairyDrop.'}
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/50">
          <div className="grid grid-cols-12 bg-slate-50/80 border-b border-slate-200 p-4 sm:p-5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <div className="col-span-5 sm:col-span-4 text-slate-700">
              {isHi ? 'सुविधा' : 'Service Feature'}
            </div>
            <div className="col-span-3 sm:col-span-4 text-slate-500">
              {isHi ? 'पारंपरिक तरीका' : 'Traditional Milkman'}
            </div>
            <div className="col-span-4 sm:col-span-4 font-extrabold text-blue-600 flex items-center gap-1.5">
              <span>{isHi ? 'DairyDrop प्लेटफॉर्म' : 'DairyDrop Platform'}</span>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 uppercase">
                {isHi ? 'सत्यापित' : 'Verified'}
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-xs sm:text-sm">
            {comparisonRows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 p-4 sm:p-5 items-center hover:bg-slate-50/60 transition-colors"
              >
                <div className="col-span-5 sm:col-span-4 font-bold text-slate-900">
                  {row.feature}
                </div>
                <div className="col-span-3 sm:col-span-4 text-slate-500 flex items-center gap-1.5">
                  <span className="text-red-500 font-bold shrink-0">✕</span>
                  <span>{row.oldWay}</span>
                </div>
                <div className="col-span-4 sm:col-span-4 font-bold text-blue-700 flex items-center gap-1.5 bg-blue-50/50 -my-3 py-3 px-2.5 rounded-xl">
                  <span className="text-blue-600 font-bold shrink-0">✓</span>
                  <span>{row.newWay}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FREQUENTLY ASKED QUESTIONS (FAQ ACCORDION) ───────────────────────── */}
      <section id="faq" className="space-y-8 max-w-3xl mx-auto scroll-mt-24">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {isHi ? 'अक्सर पूछे जाने वाले सवाल' : 'Got Questions?'}
          </span>
          <h2 className="font-heading text-3xl font-black text-slate-950 sm:text-4xl">
            {isHi ? 'सामान्य प्रश्न (FAQ)' : 'Frequently Asked Questions'}
          </h2>
        </div>

        <div className="space-y-3">
          {faqItems.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}
                className="flex w-full items-center justify-between p-5 text-left font-heading text-sm sm:text-base font-bold text-slate-900 hover:text-blue-600 transition-colors"
              >
                <span>{item.q}</span>
                <span
                  className={`ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-transform ${
                    openFaq === idx ? 'rotate-180 bg-blue-600 text-white' : ''
                  }`}
                >
                  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </button>
              {openFaq === idx && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-3 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal bg-slate-50/50">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
