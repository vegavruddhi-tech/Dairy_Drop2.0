import { NextResponse } from 'next/server';

import * as onboardingService from '@/services/onboarding.service.js';
import { toErrorResponse } from '@/domain/errors.js';

/**
 * Public serviceability lookup.
 *
 * Deliberately public — a prospective customer checks this before they have an
 * account. It returns only what is already public (which businesses serve an
 * area), never anything about an individual.
 */
export async function GET(request) {
  try {
    const pincode = request.nextUrl.searchParams.get('pincode');
    const result = await onboardingService.findMilkmenForPincode(pincode);
    return NextResponse.json(result);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
