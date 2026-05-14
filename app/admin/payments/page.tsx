'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { AnimatedOrbs } from '@/components/AnimatedOrbs';
import { CheckCircle, XCircle, Clock, DollarSign, Calendar, RefreshCw, Loader2, Users } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';

interface PaymentLoan {
  name: string;
  email: string;
}

interface Payment {
  id: string;
  amount: number;
  paidAt: string;
  status: string;
  loan: {
    id: string;
    amount: number;
    interest: number;
    duration: number;
    status: string;
    user: PaymentLoan;
  };
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchPayments = useCallback(() => {
    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');
    apiFetch('/api/admin/payments')
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

  const handleConfirmPayment = async (paymentId: string, status: 'PAID' | 'REJECTED') => {
    setProcessingId(paymentId);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const response = await apiFetch(`/api/admin/payments/${paymentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memproses pembayaran');
      }

      setSuccessMessage(data.message);
      fetchPayments();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Gagal memproses pembayaran');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const calculateTotalDebt = (payment: Payment) => {
    return payment.loan.amount + (payment.loan.amount * payment.loan.interest) / 100;
  };

  return (
    <DashboardLayout role="ADMIN">
      <AnimatedOrbs />
      <div className="space-y-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Konfirmasi Pembayaran
            </h1>
            <p className="text-gray-400">Verifikasi pembayaran dari user</p>
          </div>
          <button
            onClick={fetchPayments}
            className="flex items-center gap-2 px-4 py-2 glossy-card rounded-xl hover:bg-white/10 transition-colors text-white"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
            {errorMessage}
          </div>
        )}

        {/* Stats Card */}
        <div className="glossy-card rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-cyan-400" />
            <div className="text-2xl font-bold text-white">{payments.length}</div>
          </div>
          <div className="text-sm text-gray-400">Pembayaran Menunggu Konfirmasi</div>
        </div>

        {/* Payments List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="glossy-card rounded-2xl p-12 text-center">
            <DollarSign className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Tidak Ada Pembayaran</h3>
            <p className="text-gray-400">Belum ada pembayaran yang menunggu konfirmasi.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => {
              const totalDebt = calculateTotalDebt(payment);

              return (
                <div key={payment.id} className="glossy-card rounded-2xl p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <h3 className="font-semibold text-white text-lg">
                          {payment.loan.user.name}
                        </h3>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                          Menunggu Konfirmasi
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">Email</div>
                          <div className="text-sm text-white">{payment.loan.user.email}</div>
                        </div>
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">Tanggal Bayar</div>
                          <div className="text-sm text-white flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(payment.paidAt).toLocaleDateString('id-ID', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">Jumlah Dibayar</div>
                          <div className="text-lg font-bold text-cyan-400">
                            Rp {payment.amount.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">Total Hutang Pinjaman</div>
                          <div className="text-lg font-bold text-white">
                            Rp {totalDebt.toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-700/30 rounded-xl p-4">
                        <div className="text-sm text-gray-400 mb-2">Detail Pinjaman</div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">Jumlah Pinjaman</div>
                            <div className="text-white font-medium">Rp {payment.loan.amount.toLocaleString('id-ID')}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Bunga</div>
                            <div className="text-white font-medium">{payment.loan.interest}%</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Durasi</div>
                            <div className="text-white font-medium">{payment.loan.duration} bulan</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleConfirmPayment(payment.id, 'PAID')}
                        disabled={processingId === payment.id}
                        className="p-3 bg-green-500/20 hover:bg-green-500/30 disabled:bg-gray-600 rounded-lg transition-colors"
                        title="Konfirmasi"
                      >
                        {processingId === payment.id ? (
                          <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleConfirmPayment(payment.id, 'REJECTED')}
                        disabled={processingId === payment.id}
                        className="p-3 bg-red-500/20 hover:bg-red-500/30 disabled:bg-gray-600 rounded-lg transition-colors"
                        title="Tolak"
                      >
                        {processingId === payment.id ? (
                          <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
