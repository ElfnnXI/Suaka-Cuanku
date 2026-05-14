'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { AnimatedOrbs } from '@/components/AnimatedOrbs';
import ActivityLog from '@/components/dashboard/ActivityLog';

export default function AdminActivityPage() {
  return (
    <DashboardLayout role="ADMIN">
      <AnimatedOrbs />
      <div className="space-y-8 relative z-10">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Log Aktivitas
          </h1>
          <p className="text-gray-400">Pantau semua aktivitas user, login, dan keamanan di platform</p>
        </div>

        <ActivityLog role="ADMIN" />
      </div>
    </DashboardLayout>
  );
}
