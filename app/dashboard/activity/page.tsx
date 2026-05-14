'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { AnimatedOrbs } from '@/components/AnimatedOrbs';
import ActivityLog from '@/components/dashboard/ActivityLog';

export default function UserActivityPage() {
  return (
    <DashboardLayout>
      <AnimatedOrbs />
      <div className="space-y-8 relative z-10">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Aktivitas Saya
          </h1>
          <p className="text-gray-400">Riwayat aktivitas login dan keamanan akun Anda</p>
        </div>

        <ActivityLog role="USER" />
      </div>
    </DashboardLayout>
  );
}
