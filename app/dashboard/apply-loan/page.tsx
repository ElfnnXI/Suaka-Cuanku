'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { AnimatedOrbs } from '@/components/AnimatedOrbs';
import { apiFetch } from '@/lib/client-api';
import { Loader2, DollarSign, Percent, Calendar, Info, Shield, AlertCircle } from 'lucide-react';

interface LimitInfo {
  limit: number;
  used: number;
  available: number;
}

export default function ApplyLoanPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [interest, setInterest] = useState('5');
  const [duration, setDuration] = useState('12');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);
  const [loadingLimit, setLoadingLimit] = useState(true);

  useEffect(() => {
    apiFetch('/api/loan/apply')
      .then(res => res.json())
      .then(data => {
        if (data.limitInfo) {
          setLimitInfo(data.limitInfo);
        }
        setLoadingLimit(false);
      })
      .catch(() => setLoadingLimit(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const amountNum = parseFloat(amount.replace(/[^0-9]/g, ''));
    const interestNum = parseFloat(interest);
    const durationNum = parseInt(duration);

    if (!amountNum || amountNum < 100000) {
      setError('Jumlah pinjaman minimal Rp 100,000');
      return;
    }

    // Check against available limit (pokok only, bunga tidak dihitung ke limit)
    if (limitInfo && amountNum > limitInfo.available) {
      setError(
        `Jumlah pinjaman melebihi limit tersedia! ` +
        `Limit: Rp ${limitInfo.limit.toLocaleString('id-ID')}, ` +
        `Terpakai: Rp ${limitInfo.used.toLocaleString('id-ID')}, ` +
        `Tersisa: Rp ${limitInfo.available.toLocaleString('id-ID')}.`
      );
      return;
    }

    if (interestNum < 0 || interestNum > 100) {
      setError('Bunga harus antara 0-100%');
      return;
    }

    if (!durationNum || durationNum < 1 || durationNum > 60) {
      setError('Durasi harus antara 1-60 bulan');
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch('/api/loan/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountNum,
          interest: interestNum,
          duration: durationNum,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Pengajuan pinjaman gagal');
      }

      setSuccess('Pinjaman berhasil diajukan! Mengalihkan...');
      setTimeout(() => {
        router.push('/dashboard/overview');
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyPayment = () => {
    const amountNum = parseFloat(amount.replace(/[^0-9]/g, ''));
    const interestNum = parseFloat(interest);
    const durationNum = parseInt(duration);

    if (amountNum && interestNum && durationNum) {
      const totalInterest = (amountNum * interestNum) / 100;
      const totalAmount = amountNum + totalInterest;
      return {
        totalInterest,
        totalAmount,
        monthlyPayment: totalAmount / durationNum,
      };
    }
    return null;
  };

  const calculation = calculateMonthlyPayment();
  const amountNum = parseFloat(amount.replace(/[^0-9]/g, '')) || 0;
  const exceedsLimit = limitInfo ? amountNum > limitInfo.available : false;

  return (
    <DashboardLayout>
      <AnimatedOrbs />
      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Ajukan Pinjaman Baru
          </h1>
          <p className="text-gray-400">Isi formulir di bawah untuk mengajukan pinjaman</p>
        </div>

        {/* Loan Limit Info Card */}
        {loadingLimit ? (
          <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              <span className="text-gray-400 ml-3">Memuat informasi limit...</span>
            </div>
          </div>
        ) : limitInfo ? (
          <div className="backdrop-blur-sm bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/30 to-blue-600/20 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Limit Pinjaman Anda</h2>
                <p className="text-sm text-gray-400">Bayar lancar untuk meningkatkan limit</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">Limit Maksimal</div>
                <div className="text-base font-bold text-cyan-400">
                  Rp {limitInfo.limit.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">Terpakai</div>
                <div className="text-base font-bold text-yellow-400">
                  Rp {limitInfo.used.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">Tersisa</div>
                <div className="text-base font-bold text-green-400">
                  Rp {limitInfo.available.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Penggunaan Limit</span>
                <span className="text-cyan-400 font-medium">
                  {limitInfo.limit > 0 ? Math.min((limitInfo.used / limitInfo.limit) * 100, 100).toFixed(0) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-green-500 h-2.5 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${limitInfo.limit > 0 ? Math.min((limitInfo.used / limitInfo.limit) * 100, 100) : 0}%` }}
                />
              </div>
            </div>

            {limitInfo.limit < 45000000 && (
              <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
                <p className="text-blue-400">
                  💡 <strong>Tips:</strong> Bayar pinjaman tepat waktu untuk meningkatkan limit hingga Rp 45.000.000
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Form */}
        <div className="backdrop-blur-sm bg-gray-800/60 border border-gray-700/50 rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm">
                {success}
              </div>
            )}

            {/* Amount Input */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Jumlah Pinjaman (Rp)
              </label>
              <input
                type="text"
                value={amount ? `Rp ${parseInt(amount.replace(/[^0-9]/g, '')).toLocaleString('id-ID')}` : ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setAmount(value);
                }}
                placeholder="1000000"
                required
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">Minimal Rp 100,000</p>
            </div>

            {/* Interest Input */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Percent className="w-4 h-4" />
                Suku Bunga (% per tahun)
              </label>
              <input
                type="number"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                placeholder="5"
                step="0.1"
                min="0"
                max="100"
                required
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">Bunga flat per tahun (0-100%)</p>
            </div>

            {/* Duration Input */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Durasi (bulan)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="12"
                min="1"
                max="60"
                required
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">Durasi pembayaran dalam bulan (1-60)</p>
            </div>

            {/* Calculation Summary */}
            {calculation && amountNum >= 100000 && (
              <div className={`rounded-xl p-6 space-y-4 border ${
                exceedsLimit
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30'
              }`}>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-cyan-400" />
                  Ringkasan Perhitungan
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Jumlah Pinjaman:</span>
                    <span className="font-medium text-white">Rp {amountNum.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Total Bunga ({interest}%):</span>
                    <span className="font-medium text-white">
                      Rp {calculation.totalInterest.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Total Hutang:</span>
                    <span className={`font-medium ${exceedsLimit ? 'text-red-400' : 'text-cyan-400'}`}>
                      Rp {calculation.totalAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="border-t border-cyan-500/30 pt-3 flex justify-between font-semibold">
                    <span className="text-gray-300">Cicilan Per Bulan:</span>
                    <span className="text-cyan-400 text-lg">Rp {calculation.monthlyPayment.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                {exceedsLimit && limitInfo && (
                  <div className="mt-4 pt-4 border-t border-red-500/30">
                    <div className="flex items-start gap-2 text-red-400 text-sm">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Melebihi limit tersedia!</p>
                        <p>Limit tersisa: Rp {limitInfo.available.toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (exceedsLimit ?? false)}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Memproses...
                </>
              ) : exceedsLimit ? (
                'Melebihi Limit Pinjaman'
              ) : (
                'Ajukan Pinjaman'
              )}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
