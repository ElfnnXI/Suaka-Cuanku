'use client';

import { useEffect, useState } from 'react';
import { AnimatedOrbs } from '@/components/AnimatedOrbs';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiFetch } from '@/lib/client-api';
import {
  BellRing,
  Database,
  FolderArchive,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

type BackupSummary = {
  users: number;
  loans: number;
  payments: number;
  comments: number;
  auditLogs: number;
  securityQuestions: number;
  rateLimitEntries: number;
  adminBackupSettings: number;
};

type BackupSetting = {
  destinationDirectory: string;
  fileName: string;
  autoBackupEnabled: boolean;
  intervalDays: 1 | 3 | 7 | null;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
};

const defaultFileName = 'suaka-cuanku-backup.json';

export default function AdminBackupPage() {
  const [destinationDirectory, setDestinationDirectory] = useState('');
  const [fileName, setFileName] = useState(defaultFileName);
  const [password, setPassword] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [restoreDirectory, setRestoreDirectory] = useState('');
  const [restoreFileName, setRestoreFileName] = useState(defaultFileName);
  const [restorePassword, setRestorePassword] = useState('');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [intervalDays, setIntervalDays] = useState<1 | 3 | 7>(1);
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const [exportedAt, setExportedAt] = useState('');
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [restoredPath, setRestoredPath] = useState('');
  const [restoredAt, setRestoredAt] = useState('');
  const [restoredSummary, setRestoredSummary] = useState<BackupSummary | null>(null);
  const [setting, setSetting] = useState<BackupSetting | null>(null);

  useEffect(() => {
    apiFetch('/api/admin/database-backup')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Gagal mengambil pengaturan backup');
        }

        if (data.setting) {
          const nextSetting = data.setting as BackupSetting;
          setSetting(nextSetting);
          setDestinationDirectory(nextSetting.destinationDirectory);
          setFileName(nextSetting.fileName || defaultFileName);
          setRestoreDirectory(nextSetting.destinationDirectory);
          setRestoreFileName(nextSetting.fileName || defaultFileName);
          setAutoBackupEnabled(nextSetting.autoBackupEnabled);
          setIntervalDays((nextSetting.intervalDays ?? 1) as 1 | 3 | 7);
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Gagal mengambil pengaturan backup';
        setSettingsError(message);
      })
      .finally(() => setInitialLoading(false));
  }, []);

  const handleBackup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiFetch('/api/admin/database-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ destinationDirectory, fileName, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal membuat backup database');
      }

      setSuccess(data.message);
      setSavedPath(data.filePath);
      setExportedAt(data.exportedAt);
      setSummary(data.summary);
      setPassword('');
      setRestoreDirectory(data.directoryPath);
      setRestoreFileName(data.fileName);
      setSetting((current) => current ? {
        ...current,
        destinationDirectory: data.directoryPath,
        fileName: data.fileName,
        lastBackupAt: data.exportedAt,
      } : {
        destinationDirectory: data.directoryPath,
        fileName: data.fileName,
        autoBackupEnabled: false,
        intervalDays: null,
        lastBackupAt: data.exportedAt,
        nextBackupAt: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal membuat backup database';
      setError(message);
      setSummary(null);
      setSavedPath('');
      setExportedAt('');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSettingsLoading(true);
    setSettingsError('');
    setSettingsSuccess('');

    try {
      const response = await apiFetch('/api/admin/database-backup', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destinationDirectory,
          fileName,
          autoBackupEnabled,
          intervalDays: autoBackupEnabled ? intervalDays : null,
          password: settingsPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan pengaturan backup');
      }

      setSettingsSuccess(data.message);
      setSettingsPassword('');
      setSetting(data.setting as BackupSetting);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan backup';
      setSettingsError(message);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleRestore = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRestoreLoading(true);
    setRestoreError('');
    setRestoreSuccess('');

    try {
      const response = await apiFetch('/api/admin/database-backup', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destinationDirectory: restoreDirectory,
          fileName: restoreFileName,
          password: restorePassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal melakukan restore database');
      }

      setRestoreSuccess(data.message);
      setRestorePassword('');
      setRestoredPath(data.filePath);
      setRestoredAt(data.exportedAt);
      setRestoredSummary(data.summary);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal melakukan restore database';
      setRestoreError(message);
      setRestoredPath('');
      setRestoredAt('');
      setRestoredSummary(null);
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <DashboardLayout role="ADMIN">
      <AnimatedOrbs />
      <div className="relative z-10 space-y-8">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Backup Database
          </h1>
          <p className="text-gray-400">
            Simpan backup, atur backup otomatis, dan restore database dari file backup langsung dari dashboard admin.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <form
              onSubmit={handleBackup}
              className="rounded-2xl border border-gray-700/50 bg-gray-800/60 p-6 shadow-xl backdrop-blur-sm"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-cyan-600/20">
                  <Database className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Backup Manual</h2>
                  <p className="text-sm text-gray-400">Jalankan backup sekarang ke folder yang Anda tentukan.</p>
                </div>
              </div>

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

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Folder Tujuan Backup</label>
                  <input
                    type="text"
                    value={destinationDirectory}
                    onChange={(event) => setDestinationDirectory(event.target.value)}
                    placeholder="Contoh: D:\Backup\SuakaCuanku"
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Nama File Backup</label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(event) => setFileName(event.target.value)}
                    placeholder={defaultFileName}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    File akan ditulis ke folder di atas. Jika tanpa ekstensi, sistem menambahkan `.json`.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Password Admin</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Masukkan password akun admin Anda"
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || initialLoading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-medium text-white transition-colors hover:bg-cyan-600 disabled:bg-gray-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Membuat backup...
                  </>
                ) : (
                  <>
                    <FolderArchive className="h-4 w-4" />
                    Jalankan Backup Sekarang
                  </>
                )}
              </button>
            </form>

            <form
              onSubmit={handleRestore}
              className="rounded-2xl border border-red-500/20 bg-gray-800/60 p-6 shadow-xl backdrop-blur-sm"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/30 to-red-600/20">
                  <RotateCcw className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Restore Database</h2>
                  <p className="text-sm text-gray-400">Mengganti isi database dengan isi file backup JSON yang dipilih.</p>
                </div>
              </div>

              {restoreError && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {restoreError}
                </div>
              )}

              {restoreSuccess && (
                <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                  {restoreSuccess}
                </div>
              )}

              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                Restore akan menimpa data database aktif. Jalankan hanya jika Anda yakin file backup benar.
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Folder File Backup</label>
                  <input
                    type="text"
                    value={restoreDirectory}
                    onChange={(event) => setRestoreDirectory(event.target.value)}
                    placeholder="Contoh: D:\Backup\SuakaCuanku"
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Nama File Backup</label>
                  <input
                    type="text"
                    value={restoreFileName}
                    onChange={(event) => setRestoreFileName(event.target.value)}
                    placeholder={defaultFileName}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Password Admin</label>
                  <input
                    type="password"
                    value={restorePassword}
                    onChange={(event) => setRestorePassword(event.target.value)}
                    placeholder="Masukkan password admin untuk restore"
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={restoreLoading || initialLoading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-medium text-white transition-colors hover:bg-red-600 disabled:bg-gray-600"
              >
                {restoreLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menjalankan restore...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Jalankan Restore Database
                  </>
                )}
              </button>
            </form>

            <form
              onSubmit={handleSaveSettings}
              className="rounded-2xl border border-gray-700/50 bg-gray-800/60 p-6 shadow-xl backdrop-blur-sm"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/20">
                  <BellRing className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Backup Otomatis</h2>
                  <p className="text-sm text-gray-400">Backup akan menimpa file yang sama agar selalu ter-update.</p>
                </div>
              </div>

              {settingsError && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {settingsError}
                </div>
              )}

              {settingsSuccess && (
                <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                  {settingsSuccess}
                </div>
              )}

              <div className="space-y-4">
                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                  <span>Aktifkan backup otomatis</span>
                  <input
                    type="checkbox"
                    checked={autoBackupEnabled}
                    onChange={(event) => setAutoBackupEnabled(event.target.checked)}
                    className="h-4 w-4 accent-cyan-500"
                  />
                </label>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Interval</label>
                  <select
                    value={intervalDays}
                    onChange={(event) => setIntervalDays(Number(event.target.value) as 1 | 3 | 7)}
                    disabled={!autoBackupEnabled}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value={1}>1 hari sekali</option>
                    <option value={3}>3 hari sekali</option>
                    <option value={7}>7 hari sekali</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Password Admin</label>
                  <input
                    type="password"
                    value={settingsPassword}
                    onChange={(event) => setSettingsPassword(event.target.value)}
                    placeholder="Masukkan password untuk simpan pengaturan"
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={settingsLoading || initialLoading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-600 disabled:bg-gray-600"
              >
                {settingsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Simpan Pengaturan Backup Otomatis
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-700/50 bg-gray-800/60 p-6 shadow-xl backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Ketentuan</h2>
              </div>
              <ul className="space-y-3 text-sm text-gray-300">
                <li>Folder yang diisi adalah folder pada mesin/server tempat aplikasi Next.js berjalan.</li>
                <li>Backup manual dan otomatis menulis ke file yang sama agar isi file selalu diperbarui.</li>
                <li>Restore hanya tersedia untuk admin dan wajib verifikasi password admin yang valid.</li>
                <li>Restore akan mengganti isi tabel utama database dengan isi file backup yang dipilih.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-700/50 bg-gray-800/60 p-6 shadow-xl backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <Lock className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">Status Backup</h2>
              </div>

              {initialLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat status...
                </div>
              ) : (
                <div className="space-y-3 text-sm text-gray-300">
                  <div>
                    <span className="text-gray-500">Folder:</span> {setting?.destinationDirectory || '-'}
                  </div>
                  <div>
                    <span className="text-gray-500">File:</span> {setting?.fileName || fileName}
                  </div>
                  <div>
                    <span className="text-gray-500">Auto backup:</span> {setting?.autoBackupEnabled ? 'Aktif' : 'Tidak aktif'}
                  </div>
                  <div>
                    <span className="text-gray-500">Interval:</span> {setting?.intervalDays ? `${setting.intervalDays} hari` : '-'}
                  </div>
                  <div>
                    <span className="text-gray-500">Backup terakhir:</span>{' '}
                    {setting?.lastBackupAt ? new Date(setting.lastBackupAt).toLocaleString('id-ID') : '-'}
                  </div>
                  <div>
                    <span className="text-gray-500">Backup berikutnya:</span>{' '}
                    {setting?.nextBackupAt ? new Date(setting.nextBackupAt).toLocaleString('id-ID') : '-'}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-700/50 bg-gray-800/60 p-6 shadow-xl backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <FolderArchive className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-white">Hasil Backup Manual Terakhir</h2>
              </div>

              {summary ? (
                <div className="space-y-3 text-sm text-gray-300">
                  <div>
                    <span className="text-gray-500">Lokasi:</span> {savedPath}
                  </div>
                  <div>
                    <span className="text-gray-500">Waktu:</span> {new Date(exportedAt).toLocaleString('id-ID')}
                  </div>
                  <div>
                    <span className="text-gray-500">Ringkasan:</span> {summary.users} user, {summary.loans} pinjaman, {summary.payments} pembayaran
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Belum ada backup manual pada sesi ini.</p>
              )}
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-gray-800/60 p-6 shadow-xl backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-red-400" />
                <h2 className="text-lg font-semibold text-white">Hasil Restore Terakhir</h2>
              </div>

              {restoredSummary ? (
                <div className="space-y-3 text-sm text-gray-300">
                  <div>
                    <span className="text-gray-500">Sumber:</span> {restoredPath}
                  </div>
                  <div>
                    <span className="text-gray-500">Tanggal backup:</span> {new Date(restoredAt).toLocaleString('id-ID')}
                  </div>
                  <div>
                    <span className="text-gray-500">Ringkasan:</span> {restoredSummary.users} user, {restoredSummary.loans} pinjaman, {restoredSummary.payments} pembayaran
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Belum ada restore yang dijalankan pada sesi ini.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
