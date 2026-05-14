'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Users, RefreshCw, Eye, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  riskLevel: string;
  riskReason?: string;
  createdAt: string;
  _count: {
    loans: number;
  };
  riskStats?: {
    totalLoans: number;
    approvedLoans: number;
    rejectedLoans: number;
    paidLoans: number;
    pendingPayments: number;
  };
}

export default function AuditorUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchUsers = useCallback(() => {
    setLoading(true);
    apiFetch('/api/auditor/users')
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

  const filteredUsers = filter === 'all'
    ? users
    : users.filter(user => user.role === filter);

  const getRiskBadge = (riskLevel: string) => {
    const riskConfig: Record<string, { bg: string; text: string; label: string }> = {
      LOW: { bg: 'bg-green-100', text: 'text-green-700', label: 'Low' },
      MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium' },
      HIGH: { bg: 'bg-red-100', text: 'text-red-700', label: 'High' },
    };

    const config = riskConfig[riskLevel];
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
        <Shield className="w-4 h-4" />
        {config.label}
      </span>
    );
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
        <CheckCircle className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { bg: string; text: string; label: string }> = {
      USER: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'User' },
      ADMIN: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Admin' },
      AUDITOR: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Auditor' },
    };

    const config = roleConfig[role];
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
        {role === 'ADMIN' ? <Shield className="w-4 h-4" /> : <Users className="w-4 h-4" />}
        {config.label}
      </span>
    );
  };

  return (
    <DashboardLayout role="AUDITOR">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Data User
            </h1>
            <p className="text-gray-400">Lihat semua data pengguna - Read Only Access</p>
          </div>
          <button
            onClick={fetchUsers}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-colors text-white"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 bg-white/10 p-2 rounded-xl border border-white/20 w-fit">
          {['all', 'USER', 'ADMIN', 'AUDITOR'].map((role) => (
            <button
              key={role}
              onClick={() => setFilter(role)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === role
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:bg-white/10'
              }`}
            >
              {role === 'all' ? 'Semua' : role}
            </button>
          ))}
        </div>

        {/* Users List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Tidak Ada User</h3>
            <p className="text-gray-400">Tidak ada user dengan filter yang dipilih.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-white">{user.name}</h3>
                      {getRoleBadge(user.role)}
                      {getStatusBadge(user.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-400 mb-3">
                      <div>
                        <span className="font-medium">Email:</span> {user.email}
                      </div>
                      <div>
                        <span className="font-medium">Terdaftar:</span> {new Date(user.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      <div>
                        <span className="font-medium">Total Pinjaman:</span> {user._count.loans}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Risiko:</span>
                        {getRiskBadge(user.riskLevel)}
                      </div>
                    </div>

                    {user.riskReason && (
                      <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-yellow-200">
                            <span className="font-medium">Alasan Risiko:</span> {user.riskReason}
                          </div>
                        </div>
                      </div>
                    )}

                    {user.riskStats && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="grid grid-cols-4 gap-3 text-xs text-gray-400">
                          <div>
                            <div className="font-medium">Disetujui:</div>
                            <div className="text-green-400 font-bold">{user.riskStats.approvedLoans}</div>
                          </div>
                          <div>
                            <div className="font-medium">Ditolak:</div>
                            <div className="text-red-400 font-bold">{user.riskStats.rejectedLoans}</div>
                          </div>
                          <div>
                            <div className="font-medium">Lunas:</div>
                            <div className="text-blue-400 font-bold">{user.riskStats.paidLoans}</div>
                          </div>
                          <div>
                            <div className="font-medium">Pending:</div>
                            <div className="text-yellow-400 font-bold">{user.riskStats.pendingPayments}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                      <Eye className="w-5 h-5 text-cyan-400" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Read Only Notice */}
        <div className="backdrop-blur-sm bg-yellow-900/20 border border-yellow-500/30 rounded-2xl p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Eye className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-semibold text-yellow-400 mb-1">Mode Audit - Hanya Baca</h3>
              <p className="text-sm text-gray-400">
                Auditor hanya dapat melihat data. Modifikasi user (suspend/block/activate) hanya dapat dilakukan oleh admin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
