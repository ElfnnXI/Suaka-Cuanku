'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/client-api';
import { checkPasswordPolicy, getLocalPasswordFeedback } from '@/lib/password-policy-client';

type ResetChallenge = {
  email: string;
  setupRequired: boolean;
  manualEntryKey: string | null;
  qrCodeDataUrl: string | null;
};

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'start' | 'verify'>('start');
  const [email, setEmail] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [challenge, setChallenge] = useState<ResetChallenge | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [passwordValid, setPasswordValid] = useState(false);
  const [passwordChecking, setPasswordChecking] = useState(false);
  const passwordHint = 'Minimal 10 karakter. Hindari password umum atau yang pernah bocor.';

  useEffect(() => {
    if (!newPassword) {
      setPasswordFeedback('');
      setPasswordValid(false);
      setPasswordChecking(false);
      return;
    }

    const localResult = getLocalPasswordFeedback(newPassword);
    if (!localResult.valid) {
      setPasswordFeedback(localResult.message);
      setPasswordValid(false);
      setPasswordChecking(false);
      return;
    }

    let active = true;
    setPasswordChecking(true);
    setPasswordFeedback('Memeriksa keamanan password...');

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await checkPasswordPolicy(newPassword);
        if (!active) {
          return;
        }

        setPasswordFeedback(result.message);
        setPasswordValid(result.valid);
      } catch {
        if (!active) {
          return;
        }

        setPasswordFeedback('Password masih belum cukup aman. Gunakan kombinasi yang lebih unik.');
        setPasswordValid(false);
      } finally {
        if (active) {
          setPasswordChecking(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [newPassword]);

  useEffect(() => {
    if (step !== 'verify') {
      return;
    }

    apiFetch('/api/auth/forgot-password/challenge')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Sesi reset password tidak tersedia');
        }

        setChallenge(data);
      })
      .catch((challengeError: unknown) => {
        const message = challengeError instanceof Error ? challengeError.message : 'Sesi reset password tidak tersedia';
        setError(message);
        setStep('start');
      });
  }, [step]);

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiFetch('/api/auth/forgot-password/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memulai reset password');
      }

      setSuccess(data.message);
      setStep('verify');
    } catch (startError: unknown) {
      const message = startError instanceof Error ? startError.message : 'Gagal memulai reset password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Password baru dan konfirmasi password harus sama.');
      setLoading(false);
      return;
    }

    if (!passwordValid || passwordChecking) {
      setError(passwordFeedback || passwordHint);
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/api/auth/forgot-password/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          totpCode,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyelesaikan reset password');
      }

      setSuccess(data.message);
      setTimeout(() => {
        window.location.assign('/login');
      }, 1200);
    } catch (completeError: unknown) {
      const message = completeError instanceof Error ? completeError.message : 'Gagal menyelesaikan reset password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl -z-10" />

      <div className="max-w-md w-full">
        <Link href="/login" className="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Login</span>
        </Link>

        <div className="glossy-card rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>
              Reset Password
            </h1>
            <p className="text-gray-400">
              Verifikasi authenticator untuk reset password mandiri.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm mb-4">
              {success}
            </div>
          )}

          {step === 'start' ? (
            <form onSubmit={handleStart} className="space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl focus:outline-none transition-all placeholder-gray-500"
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <Button type="submit" className="w-full btn-glossy-primary py-3 rounded-xl font-bold" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  'Lanjutkan Reset Password'
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleComplete} className="space-y-5">
              {challenge?.setupRequired && (
                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                  <p className="mb-3">Authenticator belum aktif penuh pada akun ini. Selesaikan setup berikut untuk melanjutkan reset.</p>
                  {challenge.qrCodeDataUrl && (
                    <img
                      src={challenge.qrCodeDataUrl}
                      alt="QR setup authenticator"
                      className="mx-auto mb-3 rounded-xl bg-white p-3"
                    />
                  )}
                  <div className="break-all rounded-lg bg-slate-900/60 px-3 py-2 font-mono text-cyan-200">
                    {challenge.manualEntryKey}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Kode Authenticator</label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 digit dari authenticator"
                  required
                  className="w-full px-4 py-3 rounded-xl focus:outline-none transition-all placeholder-gray-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={passwordHint}
                  required
                  className="w-full px-4 py-3 rounded-xl focus:outline-none transition-all placeholder-gray-500"
                />
                {newPassword && (
                  <p className={`text-xs ${passwordValid ? 'text-green-400' : 'text-amber-400'}`}>
                    {passwordFeedback}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Ulangi password baru"
                  required
                  className="w-full px-4 py-3 rounded-xl focus:outline-none transition-all placeholder-gray-500"
                />
              </div>

              <Button type="submit" className="w-full btn-glossy-primary py-3 rounded-xl font-bold" disabled={loading || passwordChecking || !passwordValid}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : passwordChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cek Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
