'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { AnimatedOrbs } from '@/components/AnimatedOrbs';
import ActivityLog from '@/components/dashboard/ActivityLog';
import { Users, DollarSign, TrendingUp, Clock, Wallet, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';

interface FinancialStats {
  totalUsers: number;
  totalLoans: number;
  totalLoanAmount: number;
  totalDebt: number;
  totalPaid: number;
  remainingDebt: number;
  pendingLoans: number;
  approvedLoans: number;
  paidLoans: number;
  rejectedLoans: number;
  pendingPayments: number;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/admin/financial-stats')
      .then(res => res.json())
      .then(data => {
        if (data.stats) {
          setStats(data.stats);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatRupiah = (amount: number) => {
    if (amount >= 1000000000) {
      return `Rp ${(amount / 1000000000).toFixed(1)}M`;
    } else if (amount >= 1000000) {
      return `Rp ${(amount / 1000000).toFixed(1)}Jt`;
    }
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  return (
    <DashboardLayout role="ADMIN">
      <AnimatedOrbs />
      <div className="space-y-8 relative z-10">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Admin Dashboard
          </h1>
          <p className="text-gray-400">Monitoring dan manajemen platform P2P Lending</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:border-cyan-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-xl flex items-center justify-center">
                <Users className="w-7 h-7 text-blue-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '-' : stats?.totalUsers || 0}
            </div>
            <div className="text-sm text-gray-400">Total User</div>
          </div>

          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:border-purple-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500/30 to-purple-600/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-7 h-7 text-purple-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '-' : stats?.totalLoans || 0}
            </div>
            <div className="text-sm text-gray-400">Total Pinjaman</div>
          </div>

          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:border-yellow-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 rounded-xl flex items-center justify-center">
                <Clock className="w-7 h-7 text-yellow-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '-' : stats?.pendingLoans || 0}
            </div>
            <div className="text-sm text-gray-400">Menunggu Persetujuan</div>
          </div>

          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:border-green-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500/30 to-green-600/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-green-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '-' : formatRupiah(stats?.totalPaid || 0)}
            </div>
            <div className="text-sm text-gray-400">Total Tersalurkan</div>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-cyan-400" />
              Analisis Keuangan
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gray-700/40 rounded-xl">
                <span className="text-gray-400">Total Hutang (Pokok + Bunga)</span>
                <span className="text-xl font-bold text-cyan-400">
                  {loading ? '-' : formatRupiah(stats?.totalDebt || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-700/40 rounded-xl">
                <span className="text-gray-400">Sudah Terbayar</span>
                <span className="text-xl font-bold text-green-400">
                  {loading ? '-' : formatRupiah(stats?.totalPaid || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-700/40 rounded-xl">
                <span className="text-gray-400">Sisa Hutang</span>
                <span className="text-xl font-bold text-yellow-400">
                  {loading ? '-' : formatRupiah(stats?.remainingDebt || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-700/40 rounded-xl">
                <span className="text-gray-400">Pembayaran Pending</span>
                <span className="text-xl font-bold text-orange-400">
                  {loading ? '-' : stats?.pendingPayments || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-purple-400" />
              Status Pinjaman
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Disetujui</span>
                  <span className="font-medium text-green-400">{stats?.approvedLoans || 0}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${stats?.totalLoans ? ((stats.approvedLoans / stats.totalLoans) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Menunggu</span>
                  <span className="font-medium text-yellow-400">{stats?.pendingLoans || 0}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-yellow-500 to-yellow-400 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${stats?.totalLoans ? ((stats.pendingLoans / stats.totalLoans) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Lunas</span>
                  <span className="font-medium text-blue-400">{stats?.paidLoans || 0}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${stats?.totalLoans ? ((stats.paidLoans / stats.totalLoans) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Ditolak</span>
                  <span className="font-medium text-red-400">{stats?.rejectedLoans || 0}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-red-500 to-red-400 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${stats?.totalLoans ? ((stats.rejectedLoans / stats.totalLoans) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <ActivityLog role="ADMIN" />

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <a
            href="/admin/payments"
            className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:border-cyan-500/50 transition-all duration-300 block group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Wallet className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white mb-1">Konfirmasi Pembayaran</div>
                <div className="text-sm text-gray-400">
                  {stats?.pendingPayments || 0} pembayaran menunggu verifikasi
                </div>
              </div>
            </div>
          </a>

          <a
            href="/admin/loans"
            className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:border-yellow-500/50 transition-all duration-300 block group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white mb-1">Review Pinjaman</div>
                <div className="text-sm text-gray-400">
                  {stats?.pendingLoans || 0} pinjaman menunggu persetujuan
                </div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
