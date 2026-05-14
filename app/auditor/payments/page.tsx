'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Clock, DollarSign, Calendar, RefreshCw, Eye, CheckCircle, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';

interface PaymentLoan {
  id: string;
  amount: number;
  interest: number;
  duration: number;
  status: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface Payment {
  id: string;
  amount: number;
  paidAt: string;
  status: string;
  loan: PaymentLoan;
}

interface StatusConfig {
  bg: string;
  text: string;
  icon: typeof Clock;
  label: string;
}

export default function AuditorPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchPayments = useCallback(() => {
    setLoading(true);
    apiFetch('/api/auditor/payments')
      .then(res => res.json())
      .then(data => {
        if (data.payments) {
          setPayments(data.payments);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filteredPayments = filter === 'all'
    ? payments
    : payments.filter(payment => payment.status === filter);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, StatusConfig> = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock, label: 'Pending' },
      PAID: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Diterima' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Ditolak' },
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
              Data Pembayaran
            </h1>
            <p className="text-gray-400">Lihat semua data pembayaran - Read Only Access</p>
          </div>
          <button
            onClick={fetchPayments}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-colors text-white"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 bg-white/10 p-2 rounded-xl border border-white/20 w-fit">
          {['all', 'PENDING', 'PAID', 'REJECTED'].map((status) => (
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

        {/* Payments List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-12 text-center">
            <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Tidak Ada Pembayaran</h3>
            <p className="text-gray-400">Tidak ada pembayaran dengan filter yang dipilih.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPayments.map((payment) => (
              <div
                key={payment.id}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">
                        {formatRupiah(payment.amount)}
                      </h3>
                      {getStatusBadge(payment.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(payment.paidAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-sm text-gray-400 mb-2">
                        <span className="font-medium">Pinjaman:</span> {formatRupiah(payment.loan.amount)} ({payment.loan.status})
                      </div>
                      <div className="text-sm text-gray-400">
                        <span className="font-medium">Pemohon:</span> {payment.loan.user.name} ({payment.loan.user.email})
                      </div>
                    </div>
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
                Auditor hanya dapat melihat data. Konfirmasi atau penolakan pembayaran hanya dapat dilakukan oleh admin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
