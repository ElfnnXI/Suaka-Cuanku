'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  DollarSign,
  History,
  LogOut,
  Menu,
  X,
  Users,
  MessageSquare,
  Wallet,
  UserPlus,
  FileText,
  Shield,
  Settings,
  Activity,
  Database
} from 'lucide-react';
import { apiFetch } from '@/lib/client-api';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: 'USER' | 'ADMIN' | 'AUDITOR';
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function DashboardLayout({ children, role = 'USER' }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(res => {
        if (!res.ok) {
          window.location.href = '/login';
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data?.user) {
          const expectedRole = role;
          const actualRole = data.user.role;
          
          if (actualRole !== expectedRole) {
            if (actualRole === 'ADMIN') {
              window.location.href = '/admin/overview';
            } else if (actualRole === 'AUDITOR') {
              window.location.href = '/auditor/overview';
            } else if (actualRole === 'USER') {
              window.location.href = '/dashboard/overview';
            } else {
              window.location.href = '/login';
            }
            return;
          }

          setUser(data.user);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('[DASHBOARD] Error fetching user:', err);
        window.location.href = '/login';
      });
  }, [role]);

  // Show loading state
  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(circle at top right, #1e293b, #0f172a, #020617)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const userNavItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/dashboard/overview' },
    { icon: DollarSign, label: 'Ajukan Pinjaman', href: '/dashboard/apply-loan' },
    { icon: Wallet, label: 'Bayar Hutang', href: '/dashboard/payment' },
    { icon: History, label: 'Riwayat', href: '/dashboard/history' },
    { icon: Settings, label: 'Pengaturan Akun', href: '/settings/account' },
    { icon: Activity, label: 'Aktivitas', href: '/dashboard/activity' },
  ];

  const adminNavItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/admin/overview' },
    { icon: DollarSign, label: 'Kelola Pinjaman', href: '/admin/loans' },
    { icon: Wallet, label: 'Konfirmasi Bayar', href: '/admin/payments' },
    { icon: Users, label: 'Kelola User', href: '/admin/users' },
    { icon: UserPlus, label: 'Kelola Admin', href: '/admin/admins' },
    { icon: Shield, label: 'Kelola Auditor', href: '/admin/auditors' },
    { icon: MessageSquare, label: 'Komentar', href: '/admin/comments' },
    { icon: Database, label: 'Backup Database', href: '/admin/backup' },
    { icon: Settings, label: 'Pengaturan Akun', href: '/settings/account' },
    { icon: Activity, label: 'Aktivitas', href: '/admin/activity' },
  ];

  const auditorNavItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/auditor/overview' },
    { icon: DollarSign, label: 'Data Pinjaman', href: '/auditor/loans' },
    { icon: Wallet, label: 'Data Pembayaran', href: '/auditor/payments' },
    { icon: Users, label: 'Data User', href: '/auditor/users' },
    { icon: FileText, label: 'Laporan Audit', href: '/auditor/reports' },
    { icon: Shield, label: 'Log Audit', href: '/auditor/audit-logs' },
    { icon: Settings, label: 'Pengaturan Akun', href: '/settings/account' },
    { icon: Activity, label: 'Aktivitas', href: '/auditor/activity' },
  ];

  const navItems = role === 'ADMIN' ? adminNavItems : role === 'AUDITOR' ? auditorNavItems : userNavItems;
  const dashboardPath = role === 'ADMIN' ? '/admin/overview' : role === 'AUDITOR' ? '/auditor/overview' : '/dashboard/overview';

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(circle at top right, #1e293b, #0f172a, #020617)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(circle at top right, #1e293b, #0f172a, #020617)' }}>
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 glossy-card rounded-lg"
      >
        {sidebarOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-64 backdrop-blur-xl bg-[rgba(15,23,42,0.9)] border-r border-white/10 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/5">
            <Link href={dashboardPath} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <span className="text-white font-bold text-xl">SC</span>
              </div>
              <span className="text-lg font-bold text-white">
                Suaka <span className="text-cyan-400">Cuanku</span>
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  pathname === item.href
                    ? 'bg-cyan-500/10 text-cyan-400 font-medium border border-cyan-500/20'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User info and logout */}
          <div className="p-4 border-t border-white/5">
            <div className="mb-3 px-4">
              <div className="font-medium text-white">{user.name}</div>
              <div className="text-sm text-gray-400">{user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
