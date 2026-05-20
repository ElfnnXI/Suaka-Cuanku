'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/client-api';
import { checkPasswordPolicy, getLocalPasswordFeedback } from '@/lib/password-policy-client';
import { Shield, Plus, RefreshCw, UserCheck, UserX, Trash2, Loader2, Key } from 'lucide-react';

interface Auditor {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function AdminAuditorsPage() {
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedAuditorForReset, setSelectedAuditorForReset] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetProcessing, setResetProcessing] = useState(false);
  const [createPasswordFeedback, setCreatePasswordFeedback] = useState('');
  const [createPasswordValid, setCreatePasswordValid] = useState(false);
  const [createPasswordChecking, setCreatePasswordChecking] = useState(false);

  const isStrongPassword = (password: string) => getLocalPasswordFeedback(password).valid;

  const fetchAuditors = useCallback(() => {
    setLoading(true);
    apiFetch('/api/auditor-accounts')
      .then(res => res.json())
      .then(data => {
        if (data.auditors) {
          setAuditors(data.auditors);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAuditors();
  }, [fetchAuditors]);

  useEffect(() => {
    if (!showCreateForm || !formData.password) {
      setCreatePasswordFeedback('');
      setCreatePasswordValid(false);
      setCreatePasswordChecking(false);
      return;
    }

    const localResult = getLocalPasswordFeedback(formData.password);
    if (!localResult.valid) {
      setCreatePasswordFeedback(localResult.message);
      setCreatePasswordValid(false);
      setCreatePasswordChecking(false);
      return;
    }

    let active = true;
    setCreatePasswordChecking(true);
    setCreatePasswordFeedback('Memeriksa keamanan password...');

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await checkPasswordPolicy(formData.password);
        if (!active) {
          return;
        }

        setCreatePasswordFeedback(result.message);
        setCreatePasswordValid(result.valid);
      } catch {
        if (!active) {
          return;
        }

        setCreatePasswordFeedback('Password masih belum cukup aman. Gunakan kombinasi yang lebih unik.');
        setCreatePasswordValid(false);
      } finally {
        if (active) {
          setCreatePasswordChecking(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [formData.password, showCreateForm]);

  const handleCreateAuditor = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createPasswordValid || createPasswordChecking) {
      alert(createPasswordFeedback || 'Password belum layak digunakan');
      return;
    }

    setCreating(true);

    try {
      const response = await apiFetch('/api/auditor-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal membuat auditor');
      }

      // Reset form and refresh
      setFormData({ name: '', email: '', password: '' });
      setShowCreateForm(false);
      fetchAuditors();
      alert('Auditor berhasil ditambahkan');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      alert(message);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async (auditorId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED') => {
    setProcessingId(auditorId);
    try {
      const response = await apiFetch('/api/auditor-accounts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: auditorId, status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memperbarui status');
      }

      fetchAuditors();
      alert('Status auditor berhasil diperbarui');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      alert(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (auditorId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus auditor ini?')) {
      return;
    }

    setProcessingId(auditorId);
    try {
      const response = await apiFetch('/api/auditor-accounts', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: auditorId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menghapus auditor');
      }

      fetchAuditors();
      alert('Auditor berhasil dihapus');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      alert(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleResetPassword = (auditor: any) => {
    setSelectedAuditorForReset(auditor);
    setNewPassword('');
    setConfirmPassword('');
    setShowResetPasswordModal(true);
  };

  const executeResetPassword = async () => {
    if (!selectedAuditorForReset) return;
    setResetProcessing(true);

    if (newPassword !== confirmPassword) {
      alert('Password dan konfirmasi password tidak cocok');
      setResetProcessing(false);
      return;
    }
    if (!isStrongPassword(newPassword)) {
      alert('Password minimal 10 karakter dan wajib mengandung huruf, angka, serta simbol');
      setResetProcessing(false);
      return;
    }

    try {
      const res = await apiFetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedAuditorForReset.id,
          newPassword: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mereset password');

      alert(data.message);
      setShowResetPasswordModal(false);
      setSelectedAuditorForReset(null);
      setNewPassword('');
      setConfirmPassword('');
      fetchAuditors();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      alert(message);
    } finally {
      setResetProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aktif' },
      SUSPENDED: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Suspended' },
      BLOCKED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Blocked' },
    };

    const config = statusConfig[status];
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
        <UserCheck className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Kelola Auditor
            </h1>
            <p className="text-gray-400">Buat dan kelola akun auditor untuk monitoring dan audit</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchAuditors}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-colors text-white"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Auditor</span>
            </Button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Buat Auditor Baru
            </h3>
            <form onSubmit={handleCreateAuditor} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nama</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-xl focus:outline-none transition-all bg-white/5 border border-white/20 text-white placeholder-gray-500"
                  placeholder="Nama auditor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 rounded-xl focus:outline-none transition-all bg-white/5 border border-white/20 text-white placeholder-gray-500"
                  placeholder="auditor@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={10}
                  className="w-full px-4 py-3 rounded-xl focus:outline-none transition-all bg-white/5 border border-white/20 text-white placeholder-gray-500"
                  placeholder="Minimal 10 karakter, tidak umum, dan tidak bocor"
                />
                {formData.password && (
                  <p className={`mt-2 text-xs ${createPasswordValid ? 'text-green-400' : 'text-amber-400'}`}>
                    {createPasswordFeedback}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={creating || createPasswordChecking || !createPasswordValid}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : createPasswordChecking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cek Password...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Buat Auditor
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  variant="outline"
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Batal
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Auditors List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        ) : auditors.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-12 text-center">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Belum Ada Auditor</h3>
            <p className="text-gray-400">Klik tombol "Tambah Auditor" untuk membuat auditor baru</p>
          </div>
        ) : (
          <div className="space-y-4">
            {auditors.map((auditor) => (
              <div
                key={auditor.id}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Shield className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{auditor.name}</h3>
                        <div className="text-sm text-gray-400">{auditor.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Status:</span> {getStatusBadge(auditor.status)}
                      </div>
                      <div>
                        <span className="text-gray-400">Terdaftar:</span> {new Date(auditor.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    {auditor.status !== 'ACTIVE' && (
                      <button
                        onClick={() => handleStatusUpdate(auditor.id, 'ACTIVE')}
                        disabled={processingId === auditor.id}
                        className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition-colors disabled:opacity-50"
                        title="Aktifkan"
                      >
                        <UserCheck className="w-5 h-5 text-green-400" />
                      </button>
                    )}
                    {auditor.status !== 'SUSPENDED' && (
                      <button
                        onClick={() => handleStatusUpdate(auditor.id, 'SUSPENDED')}
                        disabled={processingId === auditor.id}
                        className="p-2 bg-yellow-500/20 hover:bg-yellow-500/30 rounded-lg transition-colors disabled:opacity-50"
                        title="Suspend"
                      >
                        <UserX className="w-5 h-5 text-yellow-400" />
                      </button>
                    )}
                    <button
                      onClick={() => handleResetPassword(auditor)}
                      className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                      title="Reset Password"
                    >
                      <Key className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(auditor.id)}
                      disabled={processingId === auditor.id}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors disabled:opacity-50"
                      title="Hapus"
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Notice */}
        <div className="backdrop-blur-sm bg-cyan-900/20 border border-cyan-500/30 rounded-2xl p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-cyan-400 mb-1">Tentang Auditor</h3>
              <p className="text-sm text-gray-400">
                Auditor memiliki akses read-only untuk melihat data pinjaman, pembayaran, user, dan menghasilkan laporan audit.
                Semua aktivitas auditor dicatat dalam log audit untuk akuntabilitas. Auditor tidak dapat melakukan modifikasi data apapun.
              </p>
            </div>
          </div>
        </div>

        {/* Reset Password Modal */}
        {showResetPasswordModal && selectedAuditorForReset && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glossy-card rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <Key className="w-6 h-6 text-blue-400" />
                <h3 className="text-xl font-bold text-white">Reset Password Auditor</h3>
              </div>

              <div className="mb-4 p-3 bg-white/5 rounded-xl">
                <div className="text-sm text-gray-400">Auditor</div>
                <div className="text-white font-medium">{selectedAuditorForReset.name} ({selectedAuditorForReset.email})</div>
              </div>

              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Password Baru</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 10 karakter, huruf, angka, simbol"
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:border-cyan-500 transition bg-white/5 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Konfirmasi Password Baru</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:border-cyan-500 transition bg-white/5 border border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowResetPasswordModal(false); setSelectedAuditorForReset(null); setNewPassword(''); setConfirmPassword(''); }}
                  className="flex-1 px-4 py-3 glossy-card rounded-xl text-white hover:bg-white/10 transition-colors"
                  disabled={resetProcessing}
                >
                  Batal
                </button>
                <button
                  onClick={executeResetPassword}
                  disabled={resetProcessing}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-blue-500/80 hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  {resetProcessing ? 'Memproses...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
