import { NextResponse } from 'next/server';

/**
 * Fast Pincode Resolver.
 * Resolves 6-digit Indian PIN codes to City (District), State, and local areas/sectors.
 * Includes caching and resilient fallback.
 */
export async function GET(request) {
  const pincode = request.nextUrl.searchParams.get('pincode')?.trim();

  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return NextResponse.json(
      { ok: false, message: 'Please provide a valid 6-digit PIN code.' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(3500),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data[0]?.Status === 'Success' && Array.isArray(data[0]?.PostOffice) && data[0].PostOffice.length > 0) {
        const offices = data[0].PostOffice;
        const first = offices[0];
        const city = first.District || first.Block || first.Division || '';
        const state = first.State || '';
        const areas = Array.from(new Set(offices.map((o) => o.Name).filter(Boolean))).slice(0, 15);

        return NextResponse.json({
          ok: true,
          pincode,
          city,
          state,
          areas,
        });
      }
    }
  } catch (err) {
    // Network or timeout failure gracefully handled below
  }

  return NextResponse.json({
    ok: false,
    pincode,
    message: 'Could not auto-detect location. You can type city and state manually.',
  });
}
