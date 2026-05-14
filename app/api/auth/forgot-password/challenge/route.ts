import { NextRequest, NextResponse } from 'next/server';
import { getPasswordResetSetupData, getPendingPasswordResetChallenge } from '@/lib/mfa';
import { withPrivateCache } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const challenge = await getPendingPasswordResetChallenge(request);
    if (!challenge) {
      return withPrivateCache(NextResponse.json(
        { error: 'Sesi reset password tidak ditemukan atau sudah kedaluwarsa.' },
        { status: 401 }
      ));
    }

    const setup = await getPasswordResetSetupData(challenge.id);
    return withPrivateCache(NextResponse.json({
      email: challenge.user.email,
      setupRequired: setup.setupRequired,
      manualEntryKey: setup.setupRequired ? setup.manualEntryKey : null,
      otpAuthUrl: setup.setupRequired ? setup.otpAuthUrl : null,
      qrCodeDataUrl: setup.setupRequired ? setup.qrCodeDataUrl : null,
      expiresAt: challenge.expiresAt,
    }));
  } catch (error) {
    console.error('Get forgot password challenge error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
