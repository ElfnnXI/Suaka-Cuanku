'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, DollarSign, Calendar, RefreshCw } from 'lucide-react';
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
}

interface StatusConfig {
  bg: string;
  text: string;
  icon: typeof Clock;
  label: string;
}

export default function AdminLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchLoans = useCallback(() => {
    setLoading(true);
    apiFetch('/api/admin/loans')
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

  const handleStatusUpdate = async (loanId: string, status: 'APPROVED' | 'REJECTED') => {
    setProcessingId(loanId);
    try {
      const response = await apiFetch(`/api/admin/loans/${loanId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update loan');
      }

      // Refresh loans list
      fetchLoans();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      alert(message);
    } finally {
      setProcessingId(null);
    }
  };

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

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Kelola Pinjaman
            </h1>
            <p className="text-gray-600">Review dan kelola semua pinjaman</p>
          </div>
          <button
            onClick={fetchLoans}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 bg-white p-2 rounded-xl border border-gray-100 w-fit">
          {['all', 'PENDING', 'APPROVED', 'REJECTED', 'PAID'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {status === 'all' ? 'Semua' : status}
            </button>
          ))}
        </div>

        {/* Loans List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Tidak Ada Pinjaman</h3>
            <p className="text-gray-600">Tidak ada pinjaman dengan filter yang dipilih.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLoans.map((loan) => (
              <div
                key={loan.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">
                        Rp {loan.amount.toLocaleString('id-ID')}
                      </h3>
                      {getStatusBadge(loan.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
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
                        Cicilan/bln: Rp {((loan.amount + (loan.amount * loan.interest) / 100) / loan.duration).toLocaleString('id-ID')}
                      </div>
                    </div>

                    {loan.user && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Pemohon:</span> {loan.user.name} ({loan.user.email})
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons for Pending Loans */}
                {loan.status === 'PENDING' && (
                  <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <Button
                      onClick={() => handleStatusUpdate(loan.id, 'APPROVED')}
                      disabled={processingId === loan.id}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {processingId === loan.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white mr-2"></div>
                          Memproses...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Setujui
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleStatusUpdate(loan.id, 'REJECTED')}
                      disabled={processingId === loan.id}
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                    >
                      {processingId === loan.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 mr-2"></div>
                          Memproses...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Tolak
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
