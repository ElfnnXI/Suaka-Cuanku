'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { AnimatedOrbs } from '@/components/AnimatedOrbs';
import { apiFetch } from '@/lib/client-api';
import { Wallet, DollarSign, Calendar, CheckCircle, Clock, Loader2, CreditCard, TrendingDown, X, Info } from 'lucide-react';

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

export default function PaymentPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = () => {
    apiFetch('/api/payment')
      .then(res => res.json())
      .then(data => {
        if (data.loans) {
          // Only show approved loans that can be paid
          const approvedLoans = data.loans.filter((l: Loan) => l.status === 'APPROVED');
          setLoans(approvedLoans);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  const calculateRemainingDebt = (loan: Loan) => {
    const totalDebt = calculateTotalDebt(loan);
    const totalPaid = calculateTotalPaid(loan);
    return Math.max(0, totalDebt - totalPaid);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');

    if (!selectedLoan) {
      setPaymentError('Pilih pinjaman terlebih dahulu');
      return;
    }

    const amount = parseFloat(paymentAmount.replace(/[^0-9]/g, ''));
    
    if (!amount || amount < 1000) {
      setPaymentError('Minimum pembayaran adalah Rp 1,000');
      return;
    }

    const remainingDebt = calculateRemainingDebt(selectedLoan);
    if (amount > remainingDebt) {
      setPaymentError(`Jumlah pembayaran melebihi sisa hutang. Sisa hutang: Rp ${remainingDebt.toLocaleString('id-ID')}`);
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
      setPaymentAmount('');
      setShowPaymentForm(false);
      setSelectedLoan(null);
      fetchLoans();

      // Clear success message after 3 seconds
      setTimeout(() => setPaymentSuccess(''), 3000);
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

  const formatRupiah = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  return (
    <DashboardLayout>
      <AnimatedOrbs />
      <div className="space-y-8 relative z-10">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Bayar Hutang
          </h1>
          <p className="text-gray-400">Lakukan pembayaran untuk mengurangi hutang pinjaman Anda</p>
        </div>

        {/* Info Card */}
        <div className="backdrop-blur-sm bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Info className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Cara Pembayaran</h3>
              <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                <li>Pilih pinjaman yang ingin dibayar dari daftar di bawah</li>
                <li>Masukkan jumlah pembayaran (minimal Rp 1,000)</li>
                <li>Klik "Bayar Sekarang" untuk submit pembayaran</li>
                <li>Pembayaran akan menunggu konfirmasi dari admin</li>
                <li>Setelah dikonfirmasi, hutang Anda akan berkurang secara otomatis</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {paymentSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl">
            {paymentSuccess}
          </div>
        )}

        {paymentError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
            {paymentError}
          </div>
        )}

        {/* Payment Form Modal */}
        {showPaymentForm && selectedLoan && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full border border-gray-700 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Bayar Hutang</h3>
                <button
                  onClick={() => {
                    setShowPaymentForm(false);
                    setSelectedLoan(null);
                    setPaymentAmount('');
                    setPaymentError('');
                  }}
                  className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700/50 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6 p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
                <div className="text-sm text-gray-400 mb-2">Total Hutang</div>
                <div className="text-3xl font-bold text-cyan-400 mb-1">
                  {formatRupiah(calculateTotalDebt(selectedLoan))}
                </div>
                <div className="text-sm text-gray-300">
                  Sisa: <span className="font-semibold text-yellow-400">{formatRupiah(calculateRemainingDebt(selectedLoan))}</span>
                </div>
              </div>

              <form onSubmit={handlePayment} className="space-y-4">
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

        {/* Loans List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
          </div>
        ) : loans.length === 0 ? (
          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-12 text-center shadow-xl">
            <Wallet className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Tidak Ada Hutang Aktif</h3>
            <p className="text-gray-400">Anda tidak memiliki pinjaman yang perlu dibayar saat ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {loans.map((loan) => {
              const totalDebt = calculateTotalDebt(loan);
              const totalPaid = calculateTotalPaid(loan);
              const remainingDebt = calculateRemainingDebt(loan);
              const progressPercent = totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0;

              return (
                <div key={loan.id} className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl hover:border-cyan-500/30 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/30 to-blue-500/20 rounded-xl flex items-center justify-center">
                          <DollarSign className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">
                            {formatRupiah(loan.amount)}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {new Date(loan.createdAt).toLocaleDateString('id-ID', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-700/40 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">Bunga</div>
                          <div className="text-sm font-semibold text-white">{loan.interest}%</div>
                        </div>
                        <div className="bg-gray-700/40 rounded-lg p-3">
                          <div className="text-xs text-gray-400 mb-1">Durasi</div>
                          <div className="text-sm font-semibold text-white">{loan.duration} bulan</div>
                        </div>
                      </div>

                      {/* Payment Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Progress Pembayaran</span>
                          <span className="text-cyan-400 font-medium">{progressPercent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-cyan-500 to-green-500 h-3 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Terbayar: {formatRupiah(totalPaid)}</span>
                          <span>Sisa: {formatRupiah(remainingDebt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Button */}
                  {remainingDebt > 0 && (
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setShowPaymentForm(true);
                        setPaymentError('');
                        setPaymentSuccess('');
                        setPaymentAmount('');
                      }}
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
                    >
                      <CreditCard className="w-5 h-5" />
                      Bayar Sekarang
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
