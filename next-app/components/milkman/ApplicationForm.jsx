'use client';

import { useState, useTransition, useEffect } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';

import { Input, Textarea } from '@/components/ui/interactive.jsx';
import { applyToBecomeMilkman } from '@/actions/customer.actions.js';

export function MilkmanApplicationForm({ defaultName }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState({});

  // Unified Location & Pincode Auto-Fill State
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [areaName, setAreaName] = useState('');
  const [areaSuggestions, setAreaSuggestions] = useState([]);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationResolved, setLocationResolved] = useState(false);

  // Auto-fetch city, state, and area list as soon as 6-digit pincode is entered
  useEffect(() => {
    const cleanPincode = pincode.trim();
    if (cleanPincode.length === 6 && /^\d{6}$/.test(cleanPincode)) {
      let active = true;
      setIsFetchingLocation(true);

      fetch(`/api/pincode?pincode=${cleanPincode}`)
        .then((res) => res.json())
        .then((data) => {
          if (!active) return;
          setIsFetchingLocation(false);
          if (data?.ok) {
            if (data.city) setCity(data.city);
            if (data.state) setState(data.state);
            if (Array.isArray(data.areas) && data.areas.length > 0) {
              setAreaSuggestions(data.areas);
              if (!areaName) {
                setAreaName(data.areas[0]);
              }
            }
            setLocationResolved(true);
            toast.success(`Location detected: ${data.city}, ${data.state}`);
          } else {
            setLocationResolved(false);
          }
        })
        .catch(() => {
          if (active) {
            setIsFetchingLocation(false);
            setLocationResolved(false);
          }
        });

      return () => {
        active = false;
      };
    } else {
      setLocationResolved(false);
      setAreaSuggestions([]);
    }
  }, [pincode]);

  const [qrCodeUrl, setQrCodeUrl] = useState('');

  function handleQrUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, SVG).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('File size must be under 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setQrCodeUrl(event.target.result);
      toast.success('QR Code loaded successfully!');
    };
    reader.readAsDataURL(file);
  }

  function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    // Ensure stateful values are synchronized
    data.pincode = pincode;
    data.city = city;
    data.state = state;
    data.areaName = areaName;
    data.qrCodeUrl = qrCodeUrl;

    startTransition(async () => {
      const result = await applyToBecomeMilkman(data);
      if (result.ok) {
        toast.success('Application submitted! Redirecting to verification status...');
        window.location.href = '/milkman/activate';
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? 'Could not submit your application.');
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Benefit Highlights (Blue & White, Zero Emojis) */}
      <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-semibold">
        <div className="rounded-2xl border border-blue-200 bg-white/90 p-3 text-blue-700 shadow-sm backdrop-blur-sm">
          <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          7-Day Free Trial
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white/90 p-3 text-blue-700 shadow-sm backdrop-blur-sm">
          <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8z" />
            </svg>
          </div>
          Automatic UPI Billing
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white/90 p-3 text-blue-700 shadow-sm backdrop-blur-sm">
          <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          </div>
          Route Planning
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-7 shadow-xl shadow-blue-500/5 backdrop-blur-md">
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Section 1: Business Profile */}
          <Input
            name="businessName"
            label="Dairy or Business Name"
            defaultValue={defaultName ? `${defaultName} Dairy` : ''}
            error={errors.businessName}
            placeholder="e.g. Shri Krishna Fresh Dairy"
            required
          />

          <Input
            name="phone"
            label="Contact / WhatsApp Mobile Number"
            inputMode="tel"
            maxLength={10}
            error={errors.phone}
            placeholder="9876543210"
            hint="Your customers and admin verification team will reach you here."
            required
          />

          {/* Section 2: Single Unified Location & Service Area */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  📍
                </span>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-950">
                  Dairy Location & Delivery Area
                </p>
              </div>

              {isFetchingLocation && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  Fetching location...
                </span>
              )}
              {locationResolved && !isFetchingLocation && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  ✓ Verified Pincode
                </span>
              )}
            </div>

            {/* Pincode with Auto-Fetch Trigger */}
            <div className="space-y-1.5">
              <label htmlFor="pincode" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Pincode (Auto-Fills City & State)
              </label>
              <div className="relative">
                <input
                  id="pincode"
                  name="pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit Pincode (e.g. 122003)"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {isFetchingLocation && (
                  <div className="absolute right-3 top-3">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-r-transparent" />
                  </div>
                )}
              </div>
              {errors.pincode && <p className="text-xs font-medium text-red-600">{errors.pincode}</p>}
            </div>

            {/* City & State (Auto-populated from Pincode) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="city" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  City / District
                </label>
                <input
                  id="city"
                  name="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Gurugram"
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {errors.city && <p className="text-xs font-medium text-red-600">{errors.city}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="state" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  State
                </label>
                <input
                  id="state"
                  name="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Haryana"
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {errors.state && <p className="text-xs font-medium text-red-600">{errors.state}</p>}
              </div>
            </div>

            {/* Primary Sector / Area with Suggested Area Tags */}
            <div className="space-y-1.5">
              <label htmlFor="areaName" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Primary Delivery Sector / Area
              </label>
              <input
                id="areaName"
                name="areaName"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="e.g. Sector 45 or Civil Lines"
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="text-[11px] text-slate-500 font-medium">
                Enter your main starting area. You can add multiple delivery sectors (e.g. Sector 62, Sector 63) from your dashboard later.
              </p>
              {errors.areaName && <p className="text-xs font-medium text-red-600">{errors.areaName}</p>}

              {/* Area suggestions pills from PIN code */}
              {areaSuggestions.length > 0 && (
                <div className="pt-1.5">
                  <p className="text-[11px] font-bold text-slate-500 mb-1.5">
                    Click to select your area in {pincode}:
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {areaSuggestions.map((area) => (
                      <button
                        type="button"
                        key={area}
                        onClick={() => setAreaName(area)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                          areaName === area
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Optional Specific Street / Dairy Shop Address */}
            <Textarea
              name="businessAddress"
              label="Street / Dairy Shop Address (Optional)"
              placeholder="e.g. Plot 14, Main Market Road or Farm House"
              maxLength={500}
            />
          </div>

          {/* Section 3: Billing */}
          <div className="space-y-3.5">
            <Input
              name="upiId"
              label="Business UPI ID (Optional)"
              error={errors.upiId}
              hint="Where your customers will pay you. You can also add it later."
              placeholder="dairybusiness@upi"
            />

            {/* QR Code Upload Section */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Payment QR Code (Optional)
              </label>
              {qrCodeUrl ? (
                <div className="relative flex items-center gap-4 rounded-2xl border border-blue-200 bg-blue-50/50 p-3">
                  <img
                    src={qrCodeUrl}
                    alt="UPI QR Code Preview"
                    className="h-20 w-20 rounded-xl bg-white object-contain p-1 border border-slate-200 shadow-sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800">QR Code Attached</p>
                    <p className="text-[11px] text-slate-500">
                      Customers will scan this QR code directly for daily/monthly milk payments.
                    </p>
                    <button
                      type="button"
                      onClick={() => setQrCodeUrl('')}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
                    >
                      ✕ Remove QR Code
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all group">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-2 group-hover:scale-105 transition-transform">
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M4 4h6v6H4V4zm2 2v2h2V6H6zm8-2h6v6h-6V4zm2 2v2h2V6h-2zM4 14h6v6H4v-6zm2 2v2h2v-2H6zm10-2h2v2h-2v-2zm-2 2h2v2h-2v-2zm4 0h2v2h-2v-2zm-2 2h2v2h-2v-2zm2 2h2v2h-2v-2zm-4 0h2v2h-2v-2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold text-slate-800">Click or Drag & Drop to Upload Payment QR</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">PNG, JPG, or SVG up to 3MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
            <svg className="h-4 w-4 text-blue-600 shrink-0 mt-0.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            <span className="leading-relaxed">
              We verify your details within 24 hours. Your 7-day free trial will start immediately with no upfront payment required.
            </span>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {pending ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
            ) : null}
            <span>Submit Vendor Application →</span>
          </button>
        </form>
      </div>

      <div className="text-center pt-2">
        <Link
          href="/register"
          className="text-xs font-semibold text-slate-600 underline hover:text-blue-600"
        >
          Want to buy milk instead? Find your milkman
        </Link>
      </div>
    </div>
  );
}



