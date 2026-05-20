'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail, ShieldCheck, CheckCircle, Key, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/client-api';
import { checkPasswordPolicy, getLocalPasswordFeedback } from '@/lib/password-policy-client';

type Question = {
  key: string;
  label: string;
  type: string;
  placeholder: string;
};

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [noQuestions, setNoQuestions] = useState(false);
  const [showAnswers, setShowAnswers] = useState<Record<string, boolean>>({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  }, [newPassword]);

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNoQuestions(false);

    try {
      const response = await apiFetch('/api/auth/forgot-password/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memulai reset password');

      if (data.hasQuestions) {
        setQuestions(data.questions);
        setStep(1);
      } else {
        setNoQuestions(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memulai reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnswers = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const answersArray = questions.map((q) => ({
        question: q.key,
        answer: answers[q.key] || '',
      }));

      const response = await apiFetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, answers: answersArray }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verifikasi gagal');

      setResetToken(data.resetToken);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verifikasi gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

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
      const response = await apiFetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword, confirmPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mereset password');

      setSuccess(data.message);
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mereset password');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setError('');
    if (step === 1) setStep(0);
  };

  const getStepTitle = () => {
    if (step === 0) return 'Reset Password';
    if (step === 1) return 'Verifikasi Pertanyaan';
    if (step === 2) return 'Password Baru';
    return 'Berhasil';
  };

  const getStepSubtitle = () => {
    if (step === 0) return 'Masukkan email untuk memulai reset password.';
    if (step === 1) return 'Jawab semua 5 pertanyaan keamanan.';
    if (step === 2) return 'Masukkan password baru Anda.';
    return 'Password berhasil direset.';
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
              {step === 3 ? <CheckCircle className="w-8 h-8 text-white" /> : step === 2 ? <Key className="w-8 h-8 text-white" /> : <ShieldCheck className="w-8 h-8 text-white" />}
            </div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>
              {getStepTitle()}
            </h1>
            <p className="text-gray-400">{getStepSubtitle()}</p>
            {step >= 1 && step <= 2 && <p className="text-xs text-cyan-400 mt-2">{email}</p>}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
          )}

          {success && step !== 3 && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm mb-4">{success}</div>
          )}

          {step === 0 && !noQuestions && (
            <form onSubmit={handleStart} className="space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl focus:outline-none transition-all placeholder-gray-500 bg-white/5 border border-white/10 text-white"
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>
              <Button type="submit" className="w-full btn-glossy-primary py-3 rounded-xl font-bold" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</> : 'Lanjutkan Reset Password'}
              </Button>
            </form>
          )}

          {noQuestions && (
            <div className="space-y-5">
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-4 rounded-xl text-sm text-center">
                <p className="font-semibold mb-1">Anda belum melakukan setting pertanyaan keamanan!</p>
                <p>Silahkan riset password dengan meminta bantuan admin.</p>
              </div>
              <a
                href="/#cta"
                className="block w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-medium text-center transition-colors"
              >
                Tinggalkan Pertanyaan atau Komentar
              </a>
              <button
                type="button"
                onClick={() => { setNoQuestions(false); setEmail(''); }}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition font-medium"
              >
                Kembali
              </button>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleVerifyAnswers} className="space-y-4">
              {questions.map((q, index) => (
                <div key={q.key} className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-300">
                    {index + 1}. {q.label}
                  </label>
                  <div className="relative">
                    <input
                      type={showAnswers[q.key] ? 'text' : 'password'}
                      value={answers[q.key] || ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                      placeholder={q.placeholder}
                      inputMode={q.type === 'digit' ? 'numeric' : 'text'}
                      required
                      className="w-full px-4 py-3 pr-12 rounded-xl focus:outline-none transition-all placeholder-gray-500 bg-white/5 border border-white/10 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAnswers((prev) => ({ ...prev, [q.key]: !prev[q.key] }))}
                      className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer"
                      aria-label={showAnswers[q.key] ? 'Sembunyikan jawaban' : 'Tampilkan jawaban'}
                    >
                      {showAnswers[q.key] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={goBack} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition font-medium">
                  Kembali
                </button>
                <Button type="submit" className="flex-1 btn-glossy-primary py-3 rounded-xl font-bold" disabled={loading}>
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</> : 'Verifikasi Jawaban'}
                </Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Password Baru</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={passwordHint}
                    required
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
                {newPassword && <p className={`text-xs ${passwordValid ? 'text-green-400' : 'text-amber-400'}`}>{passwordFeedback}</p>}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Konfirmasi Password Baru</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl focus:outline-none transition-all placeholder-gray-500 bg-white/5 border border-white/10 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer"
                    aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full btn-glossy-primary py-3 rounded-xl font-bold" disabled={loading || passwordChecking || !passwordValid}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</> : passwordChecking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cek Password...</> : 'Reset Password'}
              </Button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm">{success}</div>
              <Link href="/login" className="inline-block w-full">
                <Button className="w-full btn-glossy-primary py-3 rounded-xl font-bold">Masuk Sekarang</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
