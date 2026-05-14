'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import { getSafeRedirectPath } from '@/lib/security-helpers';
import Captcha from '@/components/ui/captcha';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaData, setCaptchaData] = useState<{ token: string; answer: string } | null>(null);
  const passwordHint = 'Minimal 10 karakter dengan huruf, angka, dan simbol.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(captchaData ? { 'x-captcha-token': captchaData.token, 'x-captcha-answer': captchaData.answer } : {}),
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.requiresMfa) {
        window.location.assign('/mfa');
        return;
      }

      if (!data.user || !data.user.role) {
        throw new Error('Server returned invalid data');
      }

      const meResponse = await apiFetch('/api/auth/me');
      if (!meResponse.ok) {
        throw new Error('Sesi login belum siap. Coba lagi.');
      }

      const redirectParam =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('redirect')
          : null;
      const redirectPath = getSafeRedirectPath(redirectParam, data.user.role);

      window.location.assign(redirectPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login gagal. Silakan coba lagi.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl -z-10" />

      <div className="max-w-md w-full">
        {/* Back to home */}
        <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Beranda</span>
        </Link>

        {/* Card */}
        <div className="glossy-card rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
              <span className="text-white font-bold text-2xl">SC</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>
              Selamat Datang
            </h1>
            <p className="text-gray-400">Masuk ke akun Suaka Cuanku Anda</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Email</label>
              <input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl focus:outline-none transition-all placeholder-gray-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={passwordHint}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl focus:outline-none transition-all placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">{passwordHint}</p>
            </div>

            <div className="py-1">
              <Captcha onChange={(data) => setCaptchaData(data)} />
            </div>

            <Button type="submit" className="w-full btn-glossy-primary py-3 rounded-xl font-bold" disabled={loading || !captchaData}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Masuk'
              )}
            </Button>

            <div className="text-right text-sm">
              <Link href="/forgot-password" className="text-cyan-400 hover:underline">
                Lupa password?
              </Link>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            Belum punya akun?{' '}
            <Link href="/register" className="text-cyan-400 font-medium hover:underline">
              Daftar Sekarang
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
