'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Eye, EyeOff, Check, User, Mail, Lock, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import { checkPasswordPolicy, getLocalPasswordFeedback } from '@/lib/password-policy-client';
import { SECURITY_QUESTIONS } from '@/lib/security-questions';

const STEPS = [
  { num: 1, label: 'Akun', icon: User },
  { num: 2, label: 'Password', icon: Lock },
  { num: 3, label: 'Keamanan', icon: ShieldCheck },
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);

  // Step 1 — Akun
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Step 2 — Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [passwordValid, setPasswordValid] = useState(false);
  const [passwordChecking, setPasswordChecking] = useState(false);

  // Step 3 — Security Questions
  const [sqAnswers, setSqAnswers] = useState<Record<string, string>>({});
  const [sqShowAnswers, setSqShowAnswers] = useState<Record<string, boolean>>({});

  // Global
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const passwordHint = 'Minimal 10 karakter. Hindari password umum atau yang pernah bocor.';

  useEffect(() => {
    if (!password) {
      setPasswordFeedback('');
      setPasswordValid(false);
      setPasswordChecking(false);
      return;
    }

    const localResult = getLocalPasswordFeedback(password);
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
        const result = await checkPasswordPolicy(password);
        if (!active) return;
        setPasswordFeedback(result.message);
        setPasswordValid(result.valid);
      } catch {
        if (!active) return;
        setPasswordFeedback('Password masih belum cukup aman. Gunakan kombinasi yang lebih unik.');
        setPasswordValid(false);
      } finally {
        if (active) setPasswordChecking(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [password]);

  const validateStep1 = () => {
    if (name.trim().length < 2) {
      setError('Nama lengkap minimal 2 karakter');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email tidak valid');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (password !== confirmPassword) {
      setError('Password tidak cocok');
      return false;
    }
    if (!passwordValid || passwordChecking) {
      setError(passwordFeedback || passwordHint);
      return false;
    }
    return true;
  };

  const goNext = () => {
    setError('');

    if (step === 1) {
      if (!validateStep1()) return;
      setCompletedSteps((prev) => (prev.includes(1) ? prev : [...prev, 1]));
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      setCompletedSteps((prev) => (prev.includes(2) ? prev : [...prev, 2]));
      setStep(3);
    }
  };

  const goBack = () => {
    setError('');
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateStep2()) return;

    setLoading(true);

    const securityQuestions = Object.values(sqAnswers).some((a) => a.trim())
      ? SECURITY_QUESTIONS.map((q) => ({
          question: q.key,
          answer: sqAnswers[q.key] || '',
        }))
      : undefined;

    try {
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, securityQuestions }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      const meResponse = await apiFetch('/api/auth/me');
      if (!meResponse.ok) {
        throw new Error('Sesi register belum siap. Coba login ulang.');
      }

      window.location.assign('/dashboard/overview');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl -z-10" />

      <div className="max-w-md w-full">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Beranda</span>
        </Link>

        <div className="glossy-card rounded-2xl p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
              <span className="text-white font-bold text-2xl">SC</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>
              Buat Akun Baru
            </h1>
            <p className="text-gray-400">Daftar untuk mulai mengajukan pinjaman</p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-0 mb-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center">
                {/* Circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    completedSteps.includes(s.num)
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30'
                      : step === s.num
                        ? 'bg-cyan-500/20 border-2 border-cyan-400 text-cyan-400 shadow-md shadow-cyan-500/20'
                        : 'bg-white/5 border-2 border-white/10 text-gray-500'
                  }`}
                >
                  {completedSteps.includes(s.num) ? <Check className="w-4 h-4" /> : s.num}
                </div>
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-10 h-0.5 transition-all duration-300 ${
                      completedSteps.includes(s.num) ? 'bg-cyan-500' : 'bg-white/10'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          {/* Step labels */}
          <div className="flex items-center justify-between px-1 -mt-4 mb-8">
            {STEPS.map((s) => (
              <div key={s.num} className="flex flex-col items-center gap-1" style={{ width: '64px' }}>
                <s.icon className={`w-4 h-4 ${
                  completedSteps.includes(s.num) ? 'text-cyan-400' : step === s.num ? 'text-cyan-400' : 'text-gray-600'
                }`} />
                <span className={`text-xs font-medium ${
                  completedSteps.includes(s.num) ? 'text-cyan-400' : step === s.num ? 'text-cyan-400' : 'text-gray-600'
                }`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm mb-5">
              {error}
            </div>
          )}

          {/* STEP 1 — Akun */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Nama Lengkap</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Fulan Asik"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl focus:outline-none transition-all placeholder-gray-500 bg-white/5 border border-white/10 text-white"
                  />
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl focus:outline-none transition-all placeholder-gray-500 bg-white/5 border border-white/10 text-white"
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                </div>
              </div>

              <Button
                type="button"
                onClick={goNext}
                className="w-full btn-glossy-primary py-3 rounded-xl font-bold"
              >
                Lanjutkan
              </Button>
            </div>
          )}

          {/* STEP 2 — Password */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={passwordHint}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl focus:outline-none transition-all placeholder-gray-500 bg-white/5 border border-white/10 text-white"
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
                {password && (
                  <p className={`text-xs ${passwordValid ? 'text-green-400' : 'text-amber-400'}`}>
                    {passwordFeedback}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Konfirmasi Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Ulangi password Anda"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl focus:outline-none transition-all placeholder-gray-500 bg-white/5 border border-white/10 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer"
                    aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition font-medium"
                >
                  Kembali
                </button>
                <div className="flex-1">
                  <Button
                    type="button"
                    onClick={goNext}
                    className="w-full btn-glossy-primary py-3 rounded-xl font-bold"
                    disabled={passwordChecking || !passwordValid}
                  >
                    Lanjutkan
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Security Questions + Submit */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border-t border-white/10 pt-4">
                <p className="text-sm font-medium text-gray-300 mb-4">
                  Pertanyaan Keamanan <span className="text-gray-500 font-normal">(opsional — untuk reset password mandiri)</span>
                </p>
                {SECURITY_QUESTIONS.map((q) => (
                  <div key={q.key} className="flex flex-col gap-2 mb-4">
                    <label className="text-sm text-gray-400">{q.label}</label>
                    <div className="relative">
                      <input
                        type={sqShowAnswers[q.key] ? 'text' : 'password'}
                        value={sqAnswers[q.key] || ''}
                        onChange={(e) => setSqAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                        placeholder={q.placeholder}
                        inputMode={q.type === 'digit' ? 'numeric' : 'text'}
                        className="w-full px-4 py-3 pr-12 rounded-xl focus:outline-none transition-all placeholder-gray-500 bg-white/5 border border-white/10 text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setSqShowAnswers((prev) => ({ ...prev, [q.key]: !prev[q.key] }))}
                        className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer"
                        aria-label={sqShowAnswers[q.key] ? 'Sembunyikan jawaban' : 'Tampilkan jawaban'}
                      >
                        {sqShowAnswers[q.key] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition font-medium"
                >
                  Kembali
                </button>
                <div className="flex-1">
                  <Button
                    type="submit"
                    className="w-full btn-glossy-primary py-3 rounded-xl font-bold"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      'Daftar'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-gray-400">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-cyan-400 font-medium hover:underline">
              Masuk
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
