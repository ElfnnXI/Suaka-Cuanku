'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { AnimatedOrbs } from '@/components/AnimatedOrbs';
import { apiFetch } from '@/lib/client-api';
import { History, DollarSign, Calendar, CheckCircle, XCircle, Clock, Wallet, Loader2, X } from 'lucide-react';

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

interface StatusConfig {
  bg: string;
  text: string;
  icon: typeof Clock;
  label: string;
}

export default function HistoryPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = () => {
    apiFetch('/api/payment')
      .then(res => res.json())
      .then(data => {
        if (data.loans) {
          setLoans(data.loans);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');

    const amount = parseFloat(paymentAmount.replace(/[^0-9]/g, ''));
    
    if (!amount || amount < 1000) {
      setPaymentError('Minimum pembayaran adalah Rp 1,000');
      return;
    }

    if (!selectedLoan) {
      setPaymentError('Pilih pinjaman terlebih dahulu');
      return;
    }

    setPaymentLoading(true);

    try {
      const response = await apiFetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          loanId: selectedLoan.id,
          amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Pembayaran gagal');
      }

      setPaymentSuccess(data.message);
      setShowPaymentModal(false);
      setPaymentAmount('');
      fetchLoans();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPaymentError(err.message);
      } else {
        setPaymentError('Pembayaran gagal');
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  const calculateTotalDebt = (loan: Loan) => {
    return loan.amount + (loan.amount * loan.interest) / 100;
  };

  const calculateTotalPaid = (loan: Loan) => {
    if (!loan.payments) return 0;
    return loan.payments
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, StatusConfig> = {
      PENDING: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock, label: 'Menunggu' },
      APPROVED: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle, label: 'Disetujui' },
      REJECTED: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle, label: 'Ditolak' },
      PAID: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: DollarSign, label: 'Lunas' },
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

  const getPaymentStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      PENDING: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Menunggu Konfirmasi' },
      PAID: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Dikonfirmasi' },
    };
    const conf = config[status];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${conf.bg} ${conf.text}`}>
        {conf.label}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <AnimatedOrbs />
      <div className="space-y-8 relative z-10">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Riwayat Pinjaman
          </h1>
          <p className="text-gray-400">Lihat semua pinjaman Anda dan lakukan pembayaran</p>
        </div>

        {/* Loans List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        ) : loans.length === 0 ? (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-12 text-center border border-gray-700/50">
            <History className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Belum Ada Pinjaman</h3>
            <p className="text-gray-400 mb-6">Anda belum memiliki pinjaman. Mulai ajukan pinjaman sekarang.</p>
            <a
              href="/dashboard/apply-loan"
              className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 transition-colors font-medium"
            >
              <DollarSign className="w-5 h-5" />
              Ajukan Pinjaman
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {loans.map((loan) => {
              const totalDebt = calculateTotalDebt(loan);
              const totalPaid = calculateTotalPaid(loan);
              const remainingDebt = totalDebt - totalPaid;

              return (
                <div
                  key={loan.id}
                  className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">
                          Rp {loan.amount.toLocaleString('id-ID')}
                        </h3>
                        {getStatusBadge(loan.status)}
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(loan.createdAt).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}</span>
                        </div>
                        <div>
                          Bunga: {loan.interest}% per tahun
                        </div>
                        <div>
                          Durasi: {loan.duration} bulan
                        </div>
                      </div>
                    </div>
                    {loan.status === 'APPROVED' && remainingDebt > 0 && (
                      <button
                        onClick={() => {
                          setSelectedLoan(loan);
                          setShowPaymentModal(true);
                          setPaymentError('');
                          setPaymentSuccess('');
                          setPaymentAmount('');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl transition-colors font-medium"
                      >
                        <Wallet className="w-4 h-4" />
                        Bayar
                      </button>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {selectedLoan?.id === loan.id && (
                    <div className="border-t border-gray-700 pt-4 mt-4">
                      <h4 className="font-semibold text-white mb-4">Detail Pinjaman</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">Jumlah Pinjaman</div>
                          <div className="text-lg font-bold text-white">Rp {loan.amount.toLocaleString('id-ID')}</div>
                        </div>
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">Total Bunga</div>
                          <div className="text-lg font-bold text-white">
                            Rp {((loan.amount * loan.interest) / 100).toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">Total Hutang</div>
                          <div className="text-lg font-bold text-cyan-400">
                            Rp {totalDebt.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">Sudah Dibayar</div>
                          <div className="text-lg font-bold text-green-400">
                            Rp {totalPaid.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">Sisa Hutang</div>
                          <div className="text-lg font-bold text-yellow-400">
                            Rp {remainingDebt.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="bg-gray-700/50 rounded-xl p-4">
                          <div className="text-sm text-gray-400 mb-1">Cicilan Per Bulan</div>
                          <div className="text-lg font-bold text-white">
                            Rp {(totalDebt / loan.duration).toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>

                      {/* Payment History */}
                      {loan.payments && loan.payments.length > 0 && (
                        <div className="mt-6">
                          <h4 className="font-semibold text-white mb-3">Riwayat Pembayaran</h4>
                          <div className="space-y-2">
                            {loan.payments.map((payment) => (
                              <div key={payment.id} className={`flex items-center justify-between p-3 rounded-xl ${
                                payment.status === 'PAID' 
                                  ? 'bg-green-500/10 border border-green-500/30' 
                                  : 'bg-yellow-500/10 border border-yellow-500/30'
                              }`}>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                  <span className="text-sm text-gray-300">
                                    {new Date(payment.paidAt).toLocaleDateString('id-ID', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    })}
                                  </span>
                                  {getPaymentStatusBadge(payment.status)}
                                </div>
                                <span className="font-medium text-white">
                                  Rp {payment.amount.toLocaleString('id-ID')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedLoan && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full border border-gray-700 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Bayar Hutang</h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700/50 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6 p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
                <div className="text-sm text-gray-400 mb-2">Total Hutang</div>
                <div className="text-3xl font-bold text-cyan-400 mb-1">
                  Rp {calculateTotalDebt(selectedLoan).toLocaleString('id-ID')}
                </div>
                <div className="text-sm text-gray-300">
                  Sisa: <span className="font-semibold text-yellow-400">Rp {(calculateTotalDebt(selectedLoan) - calculateTotalPaid(selectedLoan)).toLocaleString('id-ID')}</span>
                </div>
              </div>

              <form onSubmit={handlePayment} className="space-y-4">
                {paymentError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                    {paymentError}
                  </div>
                )}

                {paymentSuccess && (
                  <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm">
                    {paymentSuccess}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">
                    Jumlah Pembayaran
                  </label>
                  <input
                    type="text"
                    value={paymentAmount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setPaymentAmount(value ? `Rp ${parseInt(value).toLocaleString('id-ID')}` : '');
                    }}
                    placeholder="Masukkan jumlah"
                    required
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  />
                </div>

                <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                  <p className="text-sm text-cyan-300">
                    <strong>Catatan:</strong> Pembayaran akan menunggu konfirmasi dari admin. 
                    Transfer ke rekening yang sudah disediakan.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
                >
                  {paymentLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-5 h-5" />
                      Bayar Sekarang
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
