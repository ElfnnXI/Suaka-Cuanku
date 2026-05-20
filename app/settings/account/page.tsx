'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Key, Lock, Loader2, User, Save, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { SECURITY_QUESTIONS } from '@/lib/security-questions';
import { apiFetch } from '@/lib/client-api';
import { checkPasswordPolicy, getLocalPasswordFeedback } from '@/lib/password-policy-client';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function AccountSettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [passwordValid, setPasswordValid] = useState(false);
  const [passwordChecking, setPasswordChecking] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sqShowAnswers, setSqShowAnswers] = useState<Record<string, boolean>>({});

  const passwordPolicyText = 'Minimal 10 karakter. Hindari password umum atau yang pernah bocor.';

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(async (response) => {
        if (!response.ok) {
          window.location.href = '/login';
          return null;
        }

        return response.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          setProfileName(data.user.name);
          setProfileEmail(data.user.email);
          setLoading(false);
        }
      })
      .catch(() => {
        window.location.href = '/login';
      });
  }, []);

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

  const handleUpdateProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);

    try {
      const response = await apiFetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memperbarui profil');
      }

      setProfileSuccess(data.message);
      setUser(data.user);
    } catch (error: unknown) {
      setProfileError(error instanceof Error ? error.message : 'Gagal memperbarui profil');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Password baru dan konfirmasi password tidak cocok');
      return;
    }

    if (!passwordValid || passwordChecking) {
      setPasswordError(passwordFeedback || passwordPolicyText);
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengubah password');
      }

      setPasswordSuccess(data.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      setPasswordError(error instanceof Error ? error.message : 'Gagal mengubah password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const [sqError, setSqError] = useState('');
  const [sqSuccess, setSqSuccess] = useState('');
  const [sqLoading, setSqLoading] = useState(false);
  const [sqAnswers, setSqAnswers] = useState<Record<string, string>>({});
  const [sqFetched, setSqFetched] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    apiFetch('/api/auth/security-questions')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setSqFetched(data.questions?.map((q: { key: string }) => q.key) ?? []);
        }
      })
      .catch(() => undefined);
  }, [user]);

  const handleSaveSecurityQuestions = async (event: React.FormEvent) => {
    event.preventDefault();
    setSqError('');
    setSqSuccess('');
    setSqLoading(true);

    try {
      const items = SECURITY_QUESTIONS.map((q) => ({
        question: q.key,
        answer: sqAnswers[q.key] || '',
      }));

      const response = await apiFetch('/api/auth/security-questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan pertanyaan keamanan');

      setSqFetched(SECURITY_QUESTIONS.map((q) => q.key));
      setSqSuccess(data.message);
      setSqAnswers({});
    } catch (err: unknown) {
      setSqError(err instanceof Error ? err.message : 'Gagal menyimpan pertanyaan keamanan');
    } finally {
      setSqLoading(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(circle at top right, #1e293b, #0f172a, #020617)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Memuat pengaturan akun...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout role={user.role as 'USER' | 'ADMIN' | 'AUDITOR'}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Pengaturan Akun
          </h1>
          <p className="text-gray-400">Kelola profil, password, dan pertanyaan keamanan Anda.</p>
        </div>

        <div className="glossy-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Profil Pengguna</h2>
          </div>
          {profileError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">{profileError}</div>}
          {profileSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl">{profileSuccess}</div>}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <input value={profileName} onChange={(event) => setProfileName(event.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Nama lengkap" required />
            <input value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Email" type="email" required />
            <button type="submit" disabled={profileLoading} className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white rounded-xl font-medium flex items-center justify-center gap-2">
              {profileLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses...</> : <><Save className="w-4 h-4" />Simpan Perubahan</>}
            </button>
          </form>
        </div>

        <div className="glossy-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Ubah Password</h2>
          </div>
          {passwordError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">{passwordError}</div>}
          {passwordSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl">{passwordSuccess}</div>}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="relative">
              <input type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Password saat ini" required />
              <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer" aria-label={showCurrentPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div>
              <div className="relative">
                <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white" placeholder={passwordPolicyText} required />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer" aria-label={showNewPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {newPassword && <p className={`mt-2 text-xs ${passwordValid ? 'text-green-400' : 'text-amber-400'}`}>{passwordFeedback}</p>}
            </div>
            <div className="relative">
              <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Konfirmasi password baru" required />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer" aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button type="submit" disabled={passwordLoading || passwordChecking || !passwordValid} className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white rounded-xl font-medium flex items-center justify-center gap-2">
              {passwordLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses...</> : <><Lock className="w-4 h-4" />Ubah Password</>}
            </button>
          </form>
        </div>

        <div className="glossy-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Pertanyaan Keamanan</h2>
          </div>
          <p className="text-gray-400 text-sm">
            {sqFetched.length === 5
              ? 'Pertanyaan keamanan sudah diatur. Jawaban disimpan dengan aman (terenkripsi).'
              : 'Siapkan pertanyaan keamanan untuk dapat mereset password sendiri.'}
          </p>
          {sqError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">{sqError}</div>}
          {sqSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm">{sqSuccess}</div>}
          <form onSubmit={handleSaveSecurityQuestions} className="space-y-4">
            {SECURITY_QUESTIONS.map((q) => (
              <div key={q.key} className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">
                  {q.label}
                  {sqFetched.includes(q.key) && <span className="ml-2 text-green-400 text-xs">(sudah diatur)</span>}
                </label>
                <div className="relative">
                  <input
                    type={sqShowAnswers[q.key] ? 'text' : 'password'}
                    value={sqAnswers[q.key] ?? ''}
                    onChange={(e) => setSqAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                    placeholder={sqFetched.includes(q.key) ? 'Biarkan kosong jika tidak ingin mengubah' : q.placeholder}
                    inputMode={q.type === 'digit' ? 'numeric' : 'text'}
                    className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all"
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
            <button type="submit" disabled={sqLoading} className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white rounded-xl font-medium">
              {sqLoading ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Menyimpan...</> : 'Simpan Pertanyaan Keamanan'}
            </button>
          </form>
        </div>

      </div>
    </DashboardLayout>
  );
}
