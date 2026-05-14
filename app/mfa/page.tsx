'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';

type ChallengeData = {
  setupRequired: boolean;
  manualEntryKey: string | null;
  otpAuthUrl: string | null;
  qrCodeDataUrl: string | null;
  expiresAt: string;
  mfaTotpEnabled: boolean;
};

export default function MfaPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiFetch('/api/auth/mfa/challenge')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Sesi MFA tidak tersedia');
        }

        setChallenge(data);
      })
      .catch(() => {
        window.location.assign('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const response = await apiFetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          totpCode,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Verifikasi MFA gagal');
      }

      setSuccess('Verifikasi MFA berhasil. Mengalihkan...');

      if (data.user?.role === 'ADMIN') {
        window.location.assign('/admin/overview');
        return;
      }

      if (data.user?.role === 'AUDITOR') {
        window.location.assign('/auditor/overview');
        return;
      }

      window.location.assign('/dashboard/overview');
    } catch (verifyError: unknown) {
      const message =
        verifyError instanceof Error ? verifyError.message : 'Verifikasi MFA gagal.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center text-white">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-cyan-400" />
          <p>Memuat verifikasi MFA...</p>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl -z-10" />

      <div className="max-w-lg w-full glossy-card rounded-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>
            Verifikasi MFA
          </h1>
          <p className="text-gray-400">
            Masukkan kode authenticator untuk melanjutkan login.
          </p>
        </div>

        {challenge.setupRequired && (
          <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-cyan-300" />
              <span className="font-semibold">Setup authenticator wajib diselesaikan</span>
            </div>
            <p className="mb-3 text-cyan-50">
              Scan QR berikut di Google Authenticator, Microsoft Authenticator, Authy, atau aplikasi TOTP lain.
            </p>
            {challenge.qrCodeDataUrl && (
              <img
                src={challenge.qrCodeDataUrl}
                alt="QR setup authenticator"
                className="mx-auto mb-3 rounded-xl bg-white p-3"
              />
            )}
            <p className="text-cyan-50 mb-1">Manual key:</p>
            <div className="break-all rounded-lg bg-slate-900/60 px-3 py-2 font-mono text-cyan-200">
              {challenge.manualEntryKey}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            {success}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">Kode Authenticator</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 digit dari authenticator"
                required
                className="w-full rounded-xl px-4 py-3 pr-12 focus:outline-none transition-all placeholder-gray-500"
              />
              <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full btn-glossy-primary py-3 rounded-xl font-bold text-white disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Memverifikasi...
              </span>
            ) : (
              'Verifikasi dan Masuk'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
