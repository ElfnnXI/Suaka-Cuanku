'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Key, Lock, Loader2, User, Mail, Save, ShieldCheck, RefreshCw, Smartphone, Copy } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import { checkPasswordPolicy, getLocalPasswordFeedback } from '@/lib/password-policy-client';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  mfaTotpEnabled: boolean;
  mfaEnrolledAt?: string | null;
}

type SensitiveAction = 'UPDATE_PROFILE' | 'CHANGE_PASSWORD' | 'REGENERATE_BACKUP_CODES' | 'REENROLL_TOTP';

type ReEnrollSetup = {
  manualEntryKey: string;
  qrCodeDataUrl: string;
};

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
  const [backupStatus, setBackupStatus] = useState({ total: 8, available: 0 });
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');
  const [reEnrollSetup, setReEnrollSetup] = useState<ReEnrollSetup | null>(null);
  const [reEnrollNewCode, setReEnrollNewCode] = useState('');
  const [reEnrollLoading, setReEnrollLoading] = useState(false);
  const [reEnrollError, setReEnrollError] = useState('');
  const [reEnrollSuccess, setReEnrollSuccess] = useState('');
  const [mfaForm, setMfaForm] = useState<Record<SensitiveAction, { totpCode: string }>>({
    UPDATE_PROFILE: { totpCode: '' },
    CHANGE_PASSWORD: { totpCode: '' },
    REGENERATE_BACKUP_CODES: { totpCode: '' },
    REENROLL_TOTP: { totpCode: '' },
  });
  const [mfaActionLoading, setMfaActionLoading] = useState<Record<SensitiveAction, boolean>>({
    UPDATE_PROFILE: false,
    CHANGE_PASSWORD: false,
    REGENERATE_BACKUP_CODES: false,
    REENROLL_TOTP: false,
  });

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

  useEffect(() => {
    if (!user) {
      return;
    }

    apiFetch('/api/auth/mfa/backup-codes')
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) {
          setBackupStatus(data);
        }
      })
      .catch(() => undefined);
  }, [user]);

  const requestSensitiveAction = async (action: SensitiveAction) => {
    setMfaActionLoading((current) => ({ ...current, [action]: true }));

    try {
      const response = await apiFetch('/api/auth/mfa/sensitive-action/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memulai verifikasi MFA');
      }

      const successMessage = data.message || 'Verifikasi authenticator siap digunakan.';
      if (action === 'UPDATE_PROFILE') {
        setProfileSuccess(successMessage);
      } else if (action === 'CHANGE_PASSWORD') {
        setPasswordSuccess(successMessage);
      } else if (action === 'REGENERATE_BACKUP_CODES') {
        setBackupSuccess(successMessage);
      } else {
        setReEnrollSuccess(successMessage);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal memulai verifikasi MFA';
      if (action === 'UPDATE_PROFILE') {
        setProfileError(message);
      } else if (action === 'CHANGE_PASSWORD') {
        setPasswordError(message);
      } else if (action === 'REGENERATE_BACKUP_CODES') {
        setBackupError(message);
      } else {
        setReEnrollError(message);
      }
    } finally {
      setMfaActionLoading((current) => ({ ...current, [action]: false }));
    }
  };

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
          ...mfaForm.UPDATE_PROFILE,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memperbarui profil');
      }

      setProfileSuccess(data.message);
      setUser(data.user);
      setMfaForm((current) => ({
        ...current,
        UPDATE_PROFILE: { totpCode: '' },
      }));
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
          ...mfaForm.CHANGE_PASSWORD,
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
      setMfaForm((current) => ({
        ...current,
        CHANGE_PASSWORD: { totpCode: '' },
      }));
    } catch (error: unknown) {
      setPasswordError(error instanceof Error ? error.message : 'Gagal mengubah password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleGenerateBackupCodes = async () => {
    setBackupError('');
    setBackupSuccess('');
    setBackupLoading(true);

    try {
      const response = await apiFetch('/api/auth/mfa/backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mfaForm.REGENERATE_BACKUP_CODES),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal membuat backup codes');
      }

      setBackupCodes(data.codes ?? []);
      setBackupStatus({ total: 8, available: data.codes?.length ?? 0 });
      setBackupSuccess(data.message);
      setMfaForm((current) => ({
        ...current,
        REGENERATE_BACKUP_CODES: { totpCode: '' },
      }));
    } catch (error: unknown) {
      setBackupError(error instanceof Error ? error.message : 'Gagal membuat backup codes');
    } finally {
      setBackupLoading(false);
    }
  };

  const handlePrepareReEnroll = async () => {
    setReEnrollError('');
    setReEnrollSuccess('');
    setReEnrollLoading(true);

    try {
      const response = await apiFetch('/api/auth/mfa/re-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mfaForm.REENROLL_TOTP),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memulai re-enroll authenticator');
      }

      setReEnrollSetup({
        manualEntryKey: data.manualEntryKey,
        qrCodeDataUrl: data.qrCodeDataUrl,
      });
      setReEnrollSuccess(data.message);
    } catch (error: unknown) {
      setReEnrollError(error instanceof Error ? error.message : 'Gagal memulai re-enroll authenticator');
    } finally {
      setReEnrollLoading(false);
    }
  };

  const handleFinalizeReEnroll = async () => {
    setReEnrollError('');
    setReEnrollSuccess('');
    setReEnrollLoading(true);

    try {
      const response = await apiFetch('/api/auth/mfa/re-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newTotpCode: reEnrollNewCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengaktifkan authenticator baru');
      }

      setReEnrollSuccess(data.message);
      setReEnrollSetup(null);
      setReEnrollNewCode('');
      setMfaForm((current) => ({
        ...current,
        REENROLL_TOTP: { totpCode: '' },
      }));
      setUser((current) => current ? { ...current, mfaTotpEnabled: true } : current);
    } catch (error: unknown) {
      setReEnrollError(error instanceof Error ? error.message : 'Gagal mengaktifkan authenticator baru');
    } finally {
      setReEnrollLoading(false);
    }
  };

  const copyBackupCodes = async () => {
    if (!backupCodes.length) {
      return;
    }

    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setBackupSuccess('Backup codes berhasil disalin. Simpan di tempat aman.');
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
          <p className="text-gray-400">Kelola profil, password, backup codes, dan authenticator Anda.</p>
        </div>

        <div className="glossy-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Profil Pengguna</h2>
          </div>
          {profileError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">{profileError}</div>}
          {profileSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl">{profileSuccess}</div>}
          <button type="button" onClick={() => requestSensitiveAction('UPDATE_PROFILE')} className="rounded-xl bg-white/5 px-4 py-2 text-sm text-cyan-300 hover:bg-white/10" disabled={mfaActionLoading.UPDATE_PROFILE}>
            {mfaActionLoading.UPDATE_PROFILE ? 'Menyiapkan verifikasi...' : 'Siapkan verifikasi authenticator untuk ubah profil'}
          </button>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <input value={profileName} onChange={(event) => setProfileName(event.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Nama lengkap" required />
            <input value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Email" type="email" required />
            <input value={mfaForm.UPDATE_PROFILE.totpCode} onChange={(event) => setMfaForm((current) => ({ ...current, UPDATE_PROFILE: { ...current.UPDATE_PROFILE, totpCode: event.target.value } }))} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Kode authenticator" required />
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
          <button type="button" onClick={() => requestSensitiveAction('CHANGE_PASSWORD')} className="rounded-xl bg-white/5 px-4 py-2 text-sm text-cyan-300 hover:bg-white/10" disabled={mfaActionLoading.CHANGE_PASSWORD}>
            {mfaActionLoading.CHANGE_PASSWORD ? 'Menyiapkan verifikasi...' : 'Siapkan verifikasi authenticator untuk ubah password'}
          </button>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Password saat ini" required />
            <div>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" placeholder={passwordPolicyText} required />
              {newPassword && <p className={`mt-2 text-xs ${passwordValid ? 'text-green-400' : 'text-amber-400'}`}>{passwordFeedback}</p>}
            </div>
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Konfirmasi password baru" required />
            <input value={mfaForm.CHANGE_PASSWORD.totpCode} onChange={(event) => setMfaForm((current) => ({ ...current, CHANGE_PASSWORD: { ...current.CHANGE_PASSWORD, totpCode: event.target.value } }))} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Kode authenticator" required />
            <button type="submit" disabled={passwordLoading || passwordChecking || !passwordValid} className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white rounded-xl font-medium flex items-center justify-center gap-2">
              {passwordLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses...</> : <><Lock className="w-4 h-4" />Ubah Password</>}
            </button>
          </form>
        </div>

        <div className="glossy-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Backup Codes MFA</h2>
          </div>
          <p className="text-gray-400">Backup code tersisa: {backupStatus.available} dari {backupStatus.total}</p>
          {backupError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">{backupError}</div>}
          {backupSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl">{backupSuccess}</div>}
          <button type="button" onClick={() => requestSensitiveAction('REGENERATE_BACKUP_CODES')} className="rounded-xl bg-white/5 px-4 py-2 text-sm text-cyan-300 hover:bg-white/10" disabled={mfaActionLoading.REGENERATE_BACKUP_CODES}>
            {mfaActionLoading.REGENERATE_BACKUP_CODES ? 'Menyiapkan verifikasi...' : 'Siapkan verifikasi authenticator untuk buat ulang backup codes'}
          </button>
          <input value={mfaForm.REGENERATE_BACKUP_CODES.totpCode} onChange={(event) => setMfaForm((current) => ({ ...current, REGENERATE_BACKUP_CODES: { ...current.REGENERATE_BACKUP_CODES, totpCode: event.target.value } }))} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Kode authenticator" />
          <button type="button" onClick={handleGenerateBackupCodes} disabled={backupLoading} className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white rounded-xl font-medium flex items-center justify-center gap-2">
            {backupLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses...</> : <><RefreshCw className="w-4 h-4" />Buat Ulang Backup Codes</>}
          </button>
          {backupCodes.length > 0 && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-2">
                {backupCodes.map((code) => (
                  <div key={code} className="rounded-xl bg-slate-900/60 px-3 py-2 font-mono text-cyan-200">{code}</div>
                ))}
              </div>
              <button type="button" onClick={copyBackupCodes} className="rounded-xl bg-white/5 px-4 py-2 text-sm text-cyan-300 hover:bg-white/10 inline-flex items-center gap-2">
                <Copy className="w-4 h-4" />
                Salin Backup Codes
              </button>
            </div>
          )}
        </div>

        <div className="glossy-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Re-enroll Authenticator</h2>
          </div>
          {reEnrollError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">{reEnrollError}</div>}
          {reEnrollSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl">{reEnrollSuccess}</div>}
          <button type="button" onClick={() => requestSensitiveAction('REENROLL_TOTP')} className="rounded-xl bg-white/5 px-4 py-2 text-sm text-cyan-300 hover:bg-white/10" disabled={mfaActionLoading.REENROLL_TOTP}>
            {mfaActionLoading.REENROLL_TOTP ? 'Menyiapkan verifikasi...' : 'Siapkan verifikasi authenticator untuk ganti authenticator'}
          </button>
          <input value={mfaForm.REENROLL_TOTP.totpCode} onChange={(event) => setMfaForm((current) => ({ ...current, REENROLL_TOTP: { ...current.REENROLL_TOTP, totpCode: event.target.value } }))} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" placeholder="Kode authenticator saat ini" />
          <button type="button" onClick={handlePrepareReEnroll} disabled={reEnrollLoading} className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white rounded-xl font-medium">
            {reEnrollLoading ? 'Memproses...' : 'Verifikasi dan Siapkan Authenticator Baru'}
          </button>
          {reEnrollSetup && (
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-100 space-y-4">
              <img src={reEnrollSetup.qrCodeDataUrl} alt="QR authenticator baru" className="mx-auto rounded-xl bg-white p-3" />
              <div className="break-all rounded-lg bg-slate-900/60 px-3 py-2 font-mono text-cyan-200">{reEnrollSetup.manualEntryKey}</div>
              <input value={reEnrollNewCode} onChange={(event) => setReEnrollNewCode(event.target.value)} className="w-full px-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white" placeholder="Masukkan kode dari authenticator baru" />
              <button type="button" onClick={handleFinalizeReEnroll} disabled={reEnrollLoading} className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white rounded-xl font-medium">
                Aktifkan Authenticator Baru
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
