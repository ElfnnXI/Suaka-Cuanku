import { NextRequest, NextResponse } from 'next/server';
import { getMfaSetupData, getPendingMfaChallenge } from '@/lib/mfa';
import { withPrivateCache } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const challenge = await getPendingMfaChallenge(request);
    if (!challenge) {
      return withPrivateCache(NextResponse.json(
        { error: 'Sesi MFA tidak ditemukan atau sudah kedaluwarsa.' },
        { status: 401 }
      ));
    }

    const setup = await getMfaSetupData(challenge.id);
    return withPrivateCache(NextResponse.json({
      email: challenge.user.email,
      setupRequired: setup.setupRequired,
      manualEntryKey: setup.setupRequired ? setup.manualEntryKey : null,
      otpAuthUrl: setup.setupRequired ? setup.otpAuthUrl : null,
      qrCodeDataUrl: setup.setupRequired ? setup.qrCodeDataUrl : null,
      expiresAt: challenge.expiresAt,
      mfaTotpEnabled: challenge.user.mfaTotpEnabled,
    }));
  } catch (error) {
    console.error('Get MFA challenge error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
