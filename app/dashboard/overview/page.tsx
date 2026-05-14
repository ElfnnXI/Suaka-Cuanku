'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { AnimatedOrbs } from '@/components/AnimatedOrbs';
import ActivityLog from '@/components/dashboard/ActivityLog';
import { apiFetch } from '@/lib/client-api';
import { DollarSign, TrendingUp, Clock, CheckCircle, Wallet, Shield, AlertCircle, TrendingDown } from 'lucide-react';

interface Payment {
  id: string;
  amount: number;
  paidAt: string;
  status: string;
}

interface Loan {
  id: string;
  amount: number;
  interest: number;
  duration: number;
  status: string;
  createdAt: string;
  payments?: Payment[];
}

interface LimitInfo {
  limit: number;
  used: number;
  available: number;
}

export default function DashboardOverview() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);
  const [stats, setStats] = useState({
    activeLoans: 0,
    totalDebt: 0,
    totalPaid: 0,
    remainingDebt: 0,
    pendingLoans: 0,
    paidLoans: 0,
  });

  useEffect(() => {
    apiFetch('/api/payment')
      .then(res => res.json())
      .then(data => {
        if (data.loans) {
          setLoans(data.loans);

          // Calculate accurate stats
          const approvedLoans = data.loans.filter((l: Loan) => l.status === 'APPROVED');
          const pendingLoans = data.loans.filter((l: Loan) => l.status === 'PENDING');
          const paidLoans = data.loans.filter((l: Loan) => l.status === 'PAID');

          // Calculate total debt (only approved loans)
          let totalDebt = 0;
          let totalPaid = 0;

          approvedLoans.forEach((loan: Loan) => {
            const loanTotal = loan.amount + (loan.amount * loan.interest) / 100;
            totalDebt += loanTotal;

            // Count only PAID payments
            if (loan.payments) {
              const paidPayments = loan.payments.filter((p: Payment) => p.status === 'PAID');
              totalPaid += paidPayments.reduce((sum: number, p: Payment) => sum + p.amount, 0);
            }
          });

          const remainingDebt = Math.max(0, totalDebt - totalPaid);

          setStats({
            activeLoans: approvedLoans.length,
            totalDebt,
            totalPaid,
            remainingDebt,
            pendingLoans: pendingLoans.length,
            paidLoans: paidLoans.length,
          });
        }

        // Set limit info if available
        if (data.limitInfo) {
          setLimitInfo(data.limitInfo);
        }

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatRupiah = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const getLimitPercentage = () => {
    if (!limitInfo || limitInfo.limit === 0) return 0;
    return Math.min((limitInfo.used / limitInfo.limit) * 100, 100);
  };

  const getLimitStatus = () => {
    const percentage = getLimitPercentage();
    if (percentage >= 90) return { color: 'red', text: 'Hampir Penuh', icon: AlertCircle };
    if (percentage >= 70) return { color: 'yellow', text: 'Mulai Terpakai', icon: TrendingDown };
    return { color: 'green', text: 'Tersedia', icon: TrendingUp };
  };

  const limitStatus = getLimitStatus();
  const LimitIcon = limitStatus.icon;

  return (
    <DashboardLayout>
      <AnimatedOrbs />
      <div className="space-y-8 relative z-10">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-gray-400">Selamat datang di dashboard Suaka Cuanku</p>
        </div>

        {/* Loan Limit Card */}
        {limitInfo && (
          <div className="backdrop-blur-sm bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/30 to-blue-600/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-7 h-7 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Limit Pinjaman Anda</h2>
                  <p className="text-sm text-gray-400">Limit dapat meningkat dengan pembayaran lancar</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                limitStatus.color === 'red' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                limitStatus.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                'bg-green-500/20 text-green-400 border border-green-500/30'
              }`}>
                <LimitIcon className="w-4 h-4 inline mr-1" />
                {limitStatus.text}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-1">Limit Maksimal</div>
                <div className="text-xl font-bold text-cyan-400">{formatRupiah(limitInfo.limit)}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-1">Terpakai</div>
                <div className="text-xl font-bold text-yellow-400">{formatRupiah(limitInfo.used)}</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-sm text-gray-400 mb-1">Tersisa</div>
                <div className="text-xl font-bold text-green-400">{formatRupiah(limitInfo.available)}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Penggunaan Limit</span>
                <span className="text-cyan-400 font-medium">
                  {getLimitPercentage().toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-700 ease-out ${
                    getLimitPercentage() >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    getLimitPercentage() >= 70 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                    'bg-gradient-to-r from-cyan-500 to-green-500'
                  }`}
                  style={{ width: `${getLimitPercentage()}%` }}
                />
              </div>
            </div>

            {/* Limit upgrade info */}
            {limitInfo.limit < 45000000 && (
              <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm">
                <p className="text-blue-400">
                  💡 <strong>Tingkatkan limit!</strong> Bayar pinjaman dengan lancar untuk meningkatkan limit hingga Rp 45.000.000
                </p>
              </div>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:border-blue-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-7 h-7 text-blue-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '-' : stats.activeLoans}
            </div>
            <div className="text-sm text-gray-400">Pinjaman Aktif</div>
          </div>

          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:border-red-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-red-500/30 to-red-600/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-red-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '-' : formatRupiah(stats.totalDebt)}
            </div>
            <div className="text-sm text-gray-400">Total Hutang</div>
          </div>

          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:border-green-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500/30 to-green-600/20 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '-' : formatRupiah(stats.totalPaid)}
            </div>
            <div className="text-sm text-gray-400">Sudah Terbayar</div>
          </div>

          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:border-yellow-500/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 rounded-xl flex items-center justify-center">
                <Clock className="w-7 h-7 text-yellow-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {loading ? '-' : stats.pendingLoans}
            </div>
            <div className="text-sm text-gray-400">Menunggu Persetujuan</div>
          </div>
        </div>

        {/* Debt Overview */}
        {stats.totalDebt > 0 && (
          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-cyan-400" />
              Ringkasan Hutang
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gray-700/40 rounded-xl">
                <span className="text-gray-400">Total Hutang</span>
                <span className="text-xl font-bold text-cyan-400">{formatRupiah(stats.totalDebt)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-700/40 rounded-xl">
                <span className="text-gray-400">Sudah Terbayar</span>
                <span className="text-xl font-bold text-green-400">{formatRupiah(stats.totalPaid)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-700/40 rounded-xl">
                <span className="text-gray-400">Sisa Hutang</span>
                <span className="text-xl font-bold text-yellow-400">{formatRupiah(stats.remainingDebt)}</span>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Progress Pembayaran</span>
                  <span className="text-cyan-400 font-medium">
                    {stats.totalDebt > 0 ? Math.round((stats.totalPaid / stats.totalDebt) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-green-500 h-4 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${stats.totalDebt > 0 ? (stats.totalPaid / stats.totalDebt) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Loans */}
        <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Pinjaman Terbaru
          </h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
            </div>
          ) : loans.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              Belum ada pinjaman. <a href="/dashboard/apply-loan" className="text-cyan-400 hover:underline font-medium">Ajukan sekarang</a>
            </div>
          ) : (
            <div className="space-y-4">
              {loans.slice(0, 5).map((loan) => {
                const totalDebt = loan.amount + (loan.amount * loan.interest) / 100;
                const paidPayments = (loan.payments || []).filter(p => p.status === 'PAID');
                const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
                const remainingDebt = Math.max(0, totalDebt - totalPaid);

                return (
                  <div key={loan.id} className="bg-gray-700/40 rounded-xl p-4 hover:bg-gray-700/60 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">
                          Rp {loan.amount.toLocaleString('id-ID')}
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(loan.createdAt).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            loan.status === 'APPROVED'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : loan.status === 'PENDING'
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                              : loan.status === 'REJECTED'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {loan.status === 'APPROVED' ? 'Disetujui' :
                           loan.status === 'PENDING' ? 'Menunggu' :
                           loan.status === 'REJECTED' ? 'Ditolak' : 'Lunas'}
                        </span>
                        {loan.status === 'APPROVED' && remainingDebt > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            Sisa: Rp {remainingDebt.toLocaleString('id-ID')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Log */}
        <ActivityLog role="USER" />
      </div>
    </DashboardLayout>
  );
}
