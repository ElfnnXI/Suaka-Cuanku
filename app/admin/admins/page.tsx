'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { AnimatedOrbs } from '@/components/AnimatedOrbs';
import { apiFetch } from '@/lib/client-api';
import { checkPasswordPolicy, getLocalPasswordFeedback } from '@/lib/password-policy-client';
import { UserPlus, Users, Mail, Calendar, Shield, Loader2, RefreshCw, X, Clock, Ban, Trash2, CheckCircle, Key } from 'lucide-react';

interface Admin {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'block' | 'activate' | 'delete' | ''>('');
  const [actionReason, setActionReason] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedAdminForReset, setSelectedAdminForReset] = useState<Admin | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetProcessing, setResetProcessing] = useState(false);
  const [createPasswordFeedback, setCreatePasswordFeedback] = useState('');
  const [createPasswordValid, setCreatePasswordValid] = useState(false);
  const [createPasswordChecking, setCreatePasswordChecking] = useState(false);

  const isStrongPassword = (password: string) => getLocalPasswordFeedback(password).valid;

  useEffect(() => {
    if (!showModal) {
      setCreatePasswordFeedback('');
      setCreatePasswordValid(false);
      setCreatePasswordChecking(false);
      return;
    }

    if (!formData.password) {
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
  }, [formData.password, showModal]);

  const fetchAdmins = useCallback(() => {
    setLoading(true);
    apiFetch('/api/admin/admin-users')
      .then(res => res.json())
      .then(data => {
        if (data.admins) {
          setAdmins(data.admins);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleAdminAction = async (admin: Admin, action: typeof actionType) => {
    setSelectedAdmin(admin);
    setActionType(action);
    setActionReason('');

    if (action === 'delete') {
      if (!confirm(`Yakin ingin menghapus akun ${admin.name}? Tindakan ini tidak dapat dibatalkan.`)) {
        return;
      }
      setProcessing(true);
      try {
        const res = await apiFetch('/api/admin/admin-users', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: admin.id }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to delete admin');
        }
        fetchAdmins();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        alert(message);
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (action === 'activate') {
      setProcessing(true);
      try {
        const res = await apiFetch('/api/admin/admin-users', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: admin.id, status: 'ACTIVE' }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to activate admin');
        }
        fetchAdmins();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        alert(message);
      } finally {
        setProcessing(false);
      }
      return;
    }

    setShowActionModal(true);
  };

  const executeAction = async () => {
    if (!selectedAdmin) return;
    setProcessing(true);
    const updateData: Record<string, unknown> = {
      id: selectedAdmin.id,
    };

    if (actionType === 'suspend') {
      updateData.status = 'SUSPENDED';
    } else if (actionType === 'block') {
      updateData.status = 'BLOCKED';
    }

    try {
      const res = await apiFetch('/api/admin/admin-users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal memperbarui admin');
      }

      fetchAdmins();
      setShowActionModal(false);
      setSelectedAdmin(null);
      setActionReason('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      alert(message);
    } finally {
      setProcessing(false);
    }
  };

  const handleResetPassword = (admin: Admin) => {
    setSelectedAdminForReset(admin);
    setNewPassword('');
    setConfirmPassword('');
    setShowResetPasswordModal(true);
  };

  const executeResetPassword = async () => {
    if (!selectedAdminForReset) return;
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
          userId: selectedAdminForReset.id,
          newPassword: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mereset password');

      alert(data.message);
      setShowResetPasswordModal(false);
      setSelectedAdminForReset(null);
      setNewPassword('');
      setConfirmPassword('');
      fetchAdmins();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      alert(message);
    } finally {
      setResetProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Password tidak cocok');
      return;
    }

    if (!createPasswordValid || createPasswordChecking) {
      setError(createPasswordFeedback || 'Password belum layak digunakan');
      return;
    }

    setSubmitLoading(true);

    try {
      const response = await apiFetch('/api/admin/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menambahkan admin');
      }

      setSuccess(data.message);
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', confirmPassword: '' });
      fetchAdmins();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Gagal menambahkan admin');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      ACTIVE: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Aktif' },
      SUSPENDED: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Ditangguhkan' },
      BLOCKED: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Diblokir' },
    };
    const conf = config[status] || config.ACTIVE;
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${conf.bg} ${conf.text}`}>
        {conf.label}
      </span>
    );
  };

  return (
    <DashboardLayout role="ADMIN">
      <AnimatedOrbs />
      <div className="space-y-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Kelola Admin
            </h1>
            <p className="text-gray-400">Manajemen akun admin platform</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchAdmins}
              className="flex items-center gap-2 px-4 py-2 glossy-card rounded-xl hover:bg-white/10 transition-colors text-white"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => {
                setShowModal(true);
                setError('');
                setSuccess('');
                setFormData({ name: '', email: '', password: '', confirmPassword: '' });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl transition-colors font-medium"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Admin</span>
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl">
            {success}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Stats Card */}
        <div className="glossy-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-cyan-400" />
            <div className="text-2xl font-bold text-white">{admins.length}</div>
          </div>
          <div className="text-sm text-gray-400">Total Admin</div>
        </div>

        {/* Admins List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
          </div>
        ) : admins.length === 0 ? (
          <div className="glossy-card rounded-2xl p-12 text-center">
            <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Tidak Ada Admin</h3>
            <p className="text-gray-400">Belum ada admin terdaftar.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {admins.map((admin) => (
              <div key={admin.id} className="glossy-card rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">
                        {admin.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-white text-lg">{admin.name}</h3>
                        {getStatusBadge(admin.status)}
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400">
                          ADMIN
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          {admin.email}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          Bergabung {new Date(admin.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {admin.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => handleAdminAction(admin, 'suspend')}
                          className="p-2 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-lg transition-colors"
                          title="Tangguhkan"
                        >
                          <Clock className="w-4 h-4 text-yellow-400" />
                        </button>
                        <button
                          onClick={() => handleAdminAction(admin, 'block')}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Blokir"
                        >
                          <Ban className="w-4 h-4 text-red-400" />
                        </button>
                      </>
                    )}
                    {(admin.status === 'SUSPENDED' || admin.status === 'BLOCKED') && (
                      <button
                        onClick={() => handleAdminAction(admin, 'activate')}
                        className="p-2 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"
                        title="Aktifkan Kembali"
                      >
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </button>
                    )}
                    <button
                      onClick={() => handleResetPassword(admin)}
                      className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                      title="Reset Password"
                    >
                      <Key className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleAdminAction(admin, 'delete')}
                      className="p-2 bg-red-500/10 hover:bg-red-500/30 rounded-lg transition-colors"
                      title="Hapus Akun"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Modal for Suspend/Block */}
        {showActionModal && selectedAdmin && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glossy-card rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                {actionType === 'suspend' && <Clock className="w-6 h-6 text-yellow-400" />}
                {actionType === 'block' && <Ban className="w-6 h-6 text-red-400" />}
                <h3 className="text-xl font-bold text-white">
                  {actionType === 'suspend' ? 'Tangguhkan Admin' : 'Blokir Admin'}
                </h3>
              </div>

              <div className="mb-4 p-3 bg-white/5 rounded-xl">
                <div className="text-sm text-gray-400">Admin</div>
                <div className="text-white font-medium">{selectedAdmin.name} ({selectedAdmin.email})</div>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Alasan {actionType === 'suspend' ? 'penangguhan' : 'pemblokiran'} (opsional)
                </label>
                <select
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl focus:outline-none focus:border-cyan-500 transition bg-white/5 border border-white/10 text-white"
                >
                  <option value="">Pilih alasan...</option>
                  <option value="Terindikasi penipuan">Terindikasi penipuan</option>
                  <option value="Penyalahgunaan data">Penyalahgunaan data</option>
                  <option value="Terceteksi sebagai bot">Terceteksi sebagai bot</option>
                  <option value="Pelanggaran ketentuan layanan">Pelanggaran ketentuan layanan</option>
                  <option value="Aktivitas mencurigakan">Aktivitas mencurigakan</option>
                  <option value="custom">Alasan lainnya (ketik manual)</option>
                </select>
                {(actionReason === 'custom' || !['Terindikasi penipuan', 'Penyalahgunaan data', 'Terceteksi sebagai bot', 'Pelanggaran ketentuan layanan', 'Aktivitas mencurigakan', ''].includes(actionReason)) && (
                  <textarea
                    value={actionReason === 'custom' ? '' : actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Tulis alasan secara manual..."
                    rows={3}
                    className="w-full mt-2 px-4 py-3 rounded-xl focus:outline-none focus:border-cyan-500 transition bg-white/5 border border-white/10 text-white"
                  />
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowActionModal(false); setSelectedAdmin(null); }}
                  className="flex-1 px-4 py-3 glossy-card rounded-xl text-white hover:bg-white/10 transition-colors"
                  disabled={processing}
                >
                  Batal
                </button>
                <button
                  onClick={executeAction}
                  disabled={processing}
                  className={`flex-1 px-4 py-3 rounded-xl font-bold text-white transition-colors ${
                    actionType === 'suspend' ? 'bg-yellow-500/80 hover:bg-yellow-500' : 'bg-red-500/80 hover:bg-red-500'
                  } disabled:opacity-50`}
                >
                  {processing ? 'Memproses...' : actionType === 'suspend' ? 'Tangguhkan' : 'Blokir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {showResetPasswordModal && selectedAdminForReset && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glossy-card rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <Key className="w-6 h-6 text-blue-400" />
                <h3 className="text-xl font-bold text-white">Reset Password Admin</h3>
              </div>

              <div className="mb-4 p-3 bg-white/5 rounded-xl">
                <div className="text-sm text-gray-400">Admin</div>
                <div className="text-white font-medium">{selectedAdminForReset.name} ({selectedAdminForReset.email})</div>
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
                  onClick={() => { setShowResetPasswordModal(false); setSelectedAdminForReset(null); setNewPassword(''); setConfirmPassword(''); }}
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

        {/* Add Admin Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Tambah Admin Baru</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm">
                    {success}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="admin@cuanku.com"
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimal 10 karakter, tidak umum, dan tidak bocor"
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  {formData.password && (
                    <p className={`mt-2 text-xs ${createPasswordValid ? 'text-green-400' : 'text-amber-400'}`}>
                      {createPasswordFeedback}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Konfirmasi Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Ulangi password"
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitLoading || createPasswordChecking || !createPasswordValid}
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses...
                    </>
                  ) : createPasswordChecking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cek Password...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Tambah Admin
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
