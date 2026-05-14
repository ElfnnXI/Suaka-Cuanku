import { prisma } from '@/lib/prisma';

export interface UserRiskAnalysis {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskReason: string;
  stats: {
    totalLoans: number;
    pendingLoans: number;
    approvedLoans: number;
    rejectedLoans: number;
    paidLoans: number;
    rejectionRate: number;
    pendingRate: number;
  };
}

export async function analyzeUserRisk(userId: string): Promise<UserRiskAnalysis> {
  const loans = await prisma.loan.findMany({
    where: { userId },
    select: { status: true },
  });

  const totalLoans = loans.length;
  const pendingLoans = loans.filter(l => l.status === 'PENDING').length;
  const approvedLoans = loans.filter(l => l.status === 'APPROVED').length;
  const rejectedLoans = loans.filter(l => l.status === 'REJECTED').length;
  const paidLoans = loans.filter(l => l.status === 'PAID').length;

  const rejectionRate = totalLoans > 0 ? (rejectedLoans / totalLoans) * 100 : 0;
  const pendingRate = totalLoans > 0 ? (pendingLoans / totalLoans) * 100 : 0;

  // Determine risk level
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let riskReason = 'Akun normal, tidak ada masalah pembayaran';

  if (totalLoans === 0) {
    riskLevel = 'LOW';
    riskReason = 'User baru, belum ada riwayat pinjaman';
  } else if (rejectionRate > 50) {
    riskLevel = 'HIGH';
    riskReason = 'Risiko tinggi: Lebih dari 50% pinjaman ditolak';
  } else if (rejectionRate > 25) {
    riskLevel = 'MEDIUM';
    riskReason = 'Risiko sedang: Beberapa pinjaman ditolak';
  } else if (pendingRate > 60) {
    riskLevel = 'MEDIUM';
    riskReason = 'Menunggak: Banyak pinjaman menunggu persetujuan';
  } else if (pendingLoans > 3) {
    riskLevel = 'MEDIUM';
    riskReason = 'Aktif mengajukan: Beberapa pinjaman menunggu';
  } else if (paidLoans > 0 && rejectionRate < 10) {
    riskLevel = 'LOW';
    riskReason = 'Lancar: Riwayat pembayaran baik';
  }

  return {
    riskLevel,
    riskReason,
    stats: {
      totalLoans,
      pendingLoans,
      approvedLoans,
      rejectedLoans,
      paidLoans,
      rejectionRate: Math.round(rejectionRate * 10) / 10,
      pendingRate: Math.round(pendingRate * 10) / 10,
    },
  };
}
