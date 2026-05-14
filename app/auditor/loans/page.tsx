'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { CheckCircle, XCircle, Clock, DollarSign, Calendar, RefreshCw, Eye } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';

interface LoanUser {
  name: string;
  email: string;
}

interface Loan {
  id: string;
  amount: number;
  interest: number;
  duration: number;
  status: string;
  createdAt: string;
  user?: LoanUser;
  payments?: Array<{
    id: string;
    amount: number;
    paidAt: string;
    status: string;
  }>;
}

interface StatusConfig {
  bg: string;
  text: string;
  icon: typeof Clock;
  label: string;
}

export default function AuditorLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchLoans = useCallback(() => {
    setLoading(true);
    apiFetch('/api/auditor/loans')
      .then(res => res.json())
      .then(data => {
        if (data.loans) {
          setLoans(data.loans);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const filteredLoans = filter === 'all'
    ? loans
    : loans.filter(loan => loan.status === filter);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, StatusConfig> = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock, label: 'Menunggu' },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Disetujui' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Ditolak' },
      PAID: { bg: 'bg-blue-100', text: 'text-blue-700', icon: DollarSign, label: 'Lunas' },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  const formatRupiah = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  return (
    <DashboardLayout role="AUDITOR">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Data Pinjaman
            </h1>
            <p className="text-gray-400">Lihat semua data pinjaman - Read Only Access</p>
          </div>
          <button
            onClick={fetchLoans}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-colors text-white"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 bg-white/10 p-2 rounded-xl border border-white/20 w-fit">
          {['all', 'PENDING', 'APPROVED', 'REJECTED', 'PAID'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:bg-white/10'
              }`}
            >
              {status === 'all' ? 'Semua' : status}
            </button>
          ))}
        </div>

        {/* Loans List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-12 text-center">
            <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Tidak Ada Pinjaman</h3>
            <p className="text-gray-400">Tidak ada pinjaman dengan filter yang dipilih.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLoans.map((loan) => (
              <div
                key={loan.id}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">
                        {formatRupiah(loan.amount)}
                      </h3>
                      {getStatusBadge(loan.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(loan.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}</span>
                      </div>
                      <div>Bunga: {loan.interest}% per tahun</div>
                      <div>Durasi: {loan.duration} bulan</div>
                      <div>
                        Cicilan/bln: {formatRupiah((loan.amount + (loan.amount * loan.interest) / 100) / loan.duration)}
                      </div>
                    </div>

                    {loan.user && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-sm text-gray-400">
                          <span className="font-medium">Pemohon:</span> {loan.user.name} ({loan.user.email})
                        </div>
                      </div>
                    )}

                    {loan.payments && loan.payments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-sm text-gray-400 mb-2">
                          <span className="font-medium">Pembayaran:</span> {loan.payments.length} transaksi
                        </div>
                        <div className="space-y-1">
                          {loan.payments.slice(0, 3).map((payment) => (
                            <div key={payment.id} className="text-xs text-gray-500">
                              - {formatRupiah(payment.amount)} ({new Date(payment.paidAt).toLocaleDateString('id-ID')}) - {payment.status}
                            </div>
                          ))}
                          {loan.payments.length > 3 && (
                            <div className="text-xs text-cyan-400">
                              + {loan.payments.length - 3} pembayaran lainnya
                            </div>
                          )}
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
                Auditor hanya dapat melihat data. Tindakan modifikasi tidak tersedia untuk role auditor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
