'use client';

import { useState, useEffect, useCallback, type ComponentType } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiFetch } from '@/lib/client-api';
import { Users, Mail, Calendar, RefreshCw, AlertTriangle, AlertCircle, CheckCircle, Ban, Clock, Eye, Trash2, Key } from 'lucide-react';

interface RiskStats {
  pendingLoans: number;
  rejectionRate: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  riskLevel: string;
  riskReason?: string;
  createdAt: string;
  _count?: { loans: number };
  riskStats?: RiskStats;
}

interface StatusConfig {
  bg: string;
  text: string;
  icon: ComponentType<{ className: string }>;
  label: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'block' | 'activate' | 'delete' | 'view' | 'reset-password'>('view');
  const [actionReason, setActionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const isStrongPassword = (password: string) =>
    password.length >= 10 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    apiFetch('/api/admin/users')
      .then(res => res.json())
      .then(data => {
        if (data.users) {
          setUsers(data.users);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUserAction = async (user: User, action: typeof actionType) => {
    setSelectedUser(user);
    setActionType(action);
    setActionReason('');
    setNewPassword('');
    setConfirmPassword('');

    if (action === 'delete') {
      if (!confirm(`Yakin ingin menghapus akun ${user.name}? Tindakan ini tidak dapat dibatalkan.`)) {
        return;
      }
      setProcessing(true);
      try {
        const res = await apiFetch(`/api/admin/users/${user.id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete user');
        fetchUsers();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        alert(message);
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (action === 'reset-password') {
      setShowActionModal(true);
      return;
    }

    if (action === 'view' || action === 'activate') {
      setShowActionModal(true);
      if (action === 'activate') {
        await executeAction();
      }
      return;
    }

    setShowActionModal(true);
  };

  const executeAction = async () => {
    if (!selectedUser) return;
    setProcessing(true);

    if (actionType === 'reset-password') {
      if (newPassword !== confirmPassword) {
        alert('Password dan konfirmasi password tidak cocok');
        setProcessing(false);
        return;
      }
      if (!isStrongPassword(newPassword)) {
        alert('Password minimal 10 karakter dan wajib mengandung huruf, angka, serta simbol');
        setProcessing(false);
        return;
      }

      try {
        const res = await apiFetch('/api/admin/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: selectedUser.id,
            newPassword: newPassword,
          }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Gagal mereset password');

        alert(data.message);
        setShowActionModal(false);
        setSelectedUser(null);
        setNewPassword('');
        setConfirmPassword('');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        alert(message);
      } finally {
        setProcessing(false);
      }
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (actionType === 'suspend') {
      updateData.status = 'SUSPENDED';
      updateData.riskReason = actionReason || 'Ditangguhkan oleh admin';
      updateData.riskLevel = 'HIGH';
    } else if (actionType === 'block') {
      updateData.status = 'BLOCKED';
      updateData.riskReason = actionReason || 'Diblokir oleh admin';
      updateData.riskLevel = 'HIGH';
    } else if (actionType === 'activate') {
      updateData.status = 'ACTIVE';
      updateData.riskReason = 'Dibuka kembali oleh admin';
    }

    try {
      const res = await apiFetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) throw new Error('Gagal memperbarui user');

      fetchUsers();
      setShowActionModal(false);
      setSelectedUser(null);
      setActionReason('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      alert(message);
    } finally {
      setProcessing(false);
    }
  };

  const getRiskBadge = (level: string) => {
    const config: Record<string, StatusConfig> = {
      LOW: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Normal Lancar' },
      MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertCircle, label: 'Risiko Menengah' },
      HIGH: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle, label: 'Risiko Tinggi' },
    };
    const conf = config[level] || config.LOW;
    const Icon = conf.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${conf.bg} ${conf.text}`}>
        <Icon className="w-3 h-3" />
        {conf.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, Omit<StatusConfig, 'icon'>> = {
      ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aktif' },
      SUSPENDED: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Ditangguhkan' },
      BLOCKED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Diblokir' },
    };
    const conf = config[status] || config.ACTIVE;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${conf.bg} ${conf.text}`}>
        {conf.label}
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
              Kelola User
            </h1>
            <p className="text-gray-400">Manajemen semua user terdaftar beserta profil risiko</p>
          </div>
          <button
            onClick={fetchUsers}
            className="flex items-center gap-2 px-4 py-2 glossy-card rounded-xl hover:bg-white/10 transition-colors text-white"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glossy-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-cyan-400" />
              <div className="text-2xl font-bold text-white">{users.length}</div>
            </div>
            <div className="text-sm text-gray-400">Total User</div>
          </div>
          <div className="glossy-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div className="text-2xl font-bold text-white">{users.filter(u => u.status === 'ACTIVE').length}</div>
            </div>
            <div className="text-sm text-gray-400">User Aktif</div>
          </div>
          <div className="glossy-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-8 h-8 text-yellow-400" />
              <div className="text-2xl font-bold text-white">{users.filter(u => u.riskLevel === 'MEDIUM').length}</div>
            </div>
            <div className="text-sm text-gray-400">Risiko Menengah</div>
          </div>
          <div className="glossy-card rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <div className="text-2xl font-bold text-white">{users.filter(u => u.riskLevel === 'HIGH' || u.status === 'BLOCKED').length}</div>
            </div>
            <div className="text-sm text-gray-400">Risiko Tinggi / Blokir</div>
          </div>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="glossy-card rounded-2xl p-12 text-center">
            <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Belum Ada User</h3>
            <p className="text-gray-400">Belum ada user yang terdaftar.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="glossy-card rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-white text-lg">{user.name}</h3>
                        {getStatusBadge(user.status)}
                        {getRiskBadge(user.riskLevel)}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          user.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-500/20 text-gray-300'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          {user.email}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {user._count?.loans || 0} pinjaman
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          Bergabung {new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      {user.riskReason && (
                        <div className="mt-2 text-sm text-gray-500">
                          <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                          {user.riskReason}
                        </div>
                      )}
                      {user.riskStats && (
                        <div className="mt-3 flex gap-3 text-xs text-gray-500 flex-wrap">
                          {user.riskStats.pendingLoans > 0 && (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {user.riskStats.pendingLoans} menunggu</span>
                          )}
                          {user.riskStats.rejectionRate > 0 && (
                            <span className="text-yellow-500">Tingkat penolakan: {user.riskStats.rejectionRate}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleUserAction(user, 'view')}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                      title="Lihat Detail"
                    >
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                    {user.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => handleUserAction(user, 'suspend')}
                          className="p-2 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-lg transition-colors"
                          title="Tangguhkan"
                        >
                          <Clock className="w-4 h-4 text-yellow-400" />
                        </button>
                        <button
                          onClick={() => handleUserAction(user, 'block')}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Blokir"
                        >
                          <Ban className="w-4 h-4 text-red-400" />
                        </button>
                      </>
                    )}
                    {(user.status === 'SUSPENDED' || user.status === 'BLOCKED') && (
                      <button
                        onClick={() => handleUserAction(user, 'activate')}
                        className="p-2 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"
                        title="Aktifkan Kembali"
                      >
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </button>
                    )}
                    {user.role !== 'ADMIN' && (
                      <button
                        onClick={() => handleUserAction(user, 'reset-password')}
                        className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                        title="Reset Password"
                      >
                        <Key className="w-4 h-4 text-blue-400" />
                      </button>
                    )}
                    {user.role !== 'ADMIN' && (
                      <button
                        onClick={() => handleUserAction(user, 'delete')}
                        className="p-2 bg-red-500/10 hover:bg-red-500/30 rounded-lg transition-colors"
                        title="Hapus Akun"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Modal */}
        {showActionModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glossy-card rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                {actionType === 'suspend' && <Clock className="w-6 h-6 text-yellow-400" />}
                {actionType === 'block' && <Ban className="w-6 h-6 text-red-400" />}
                {actionType === 'activate' && <CheckCircle className="w-6 h-6 text-green-400" />}
                {actionType === 'reset-password' && <Key className="w-6 h-6 text-blue-400" />}
                <h3 className="text-xl font-bold text-white">
                  {actionType === 'suspend' && 'Tangguhkan User'}
                  {actionType === 'block' && 'Blokir User'}
                  {actionType === 'activate' && 'Aktifkan Kembali'}
                  {actionType === 'reset-password' && 'Reset Password User'}
                </h3>
              </div>

              <div className="mb-4 p-3 bg-white/5 rounded-xl">
                <div className="text-sm text-gray-400">User</div>
                <div className="text-white font-medium">{selectedUser.name} ({selectedUser.email})</div>
              </div>

              {actionType === 'reset-password' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Password Baru
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 10 karakter, huruf, angka, simbol"
                      className="w-full px-4 py-3 rounded-xl focus:outline-none focus:border-cyan-500 transition bg-white/5 border border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Konfirmasi Password Baru
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password baru"
                      className="w-full px-4 py-3 rounded-xl focus:outline-none focus:border-cyan-500 transition bg-white/5 border border-white/10 text-white"
                    />
                  </div>
                </div>
              ) : (
                (actionType === 'suspend' || actionType === 'block') && (
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
                )
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowActionModal(false); setSelectedUser(null); setNewPassword(''); setConfirmPassword(''); }}
                  className="flex-1 px-4 py-3 glossy-card rounded-xl text-white hover:bg-white/10 transition-colors"
                  disabled={processing}
                >
                  Batal
                </button>
                <button
                  onClick={executeAction}
                  disabled={processing}
                  className={`flex-1 px-4 py-3 rounded-xl font-bold text-white transition-colors ${
                    actionType === 'suspend' ? 'bg-yellow-500/80 hover:bg-yellow-500' :
                    actionType === 'block' ? 'bg-red-500/80 hover:bg-red-500' :
                    actionType === 'reset-password' ? 'bg-blue-500/80 hover:bg-blue-500' :
                    'bg-green-500/80 hover:bg-green-500'
                  } disabled:opacity-50`}
                >
                  {processing ? 'Memproses...' : 
                   actionType === 'suspend' ? 'Tangguhkan' : 
                   actionType === 'block' ? 'Blokir' : 
                   actionType === 'reset-password' ? 'Reset Password' :
                   'Aktifkan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
