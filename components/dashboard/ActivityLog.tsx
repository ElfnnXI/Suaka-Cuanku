'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/client-api';
import {
  LogIn, LogOut, UserPlus, Key, Shield, RefreshCw,
  UserCog, Trash2, FileText, Eye, Settings, Clock,
  AlertTriangle, CheckCircle, Info, XCircle
} from 'lucide-react';

type Activity = {
  id: string;
  action: string;
  description: string;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  auditor: {
    id: string;
    name: string;
    email: string;
  };
};

type Props = {
  role: 'USER' | 'ADMIN' | 'AUDITOR';
};

const POLL_INTERVAL_MS = 30_000;

function getActionBadge(action: string): { label: string; color: string } {
  if (action.startsWith('LOGIN_')) return { label: 'Login', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' };
  if (action === 'LOGOUT') return { label: 'Logout', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
  if (action.startsWith('REGISTER')) return { label: 'Register', color: 'bg-green-500/15 text-green-400 border-green-500/30' };
  if (action.includes('PASSWORD') || action.includes('CHANGE_PASSWORD')) return { label: 'Password', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  if (action.includes('DELETE')) return { label: 'Hapus', color: 'bg-red-500/15 text-red-400 border-red-500/30' };
  if (action.includes('UPDATE') || action.includes('EDIT')) return { label: 'Update', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  if (action.includes('CREATE') || action.includes('GENERATE')) return { label: 'Buat', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (action.includes('VIEW')) return { label: 'Lihat', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
  if (action.includes('ADMIN') || action.includes('AUDITOR')) return { label: 'Admin', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' };
  return { label: action, color: 'bg-white/5 text-gray-400 border-white/10' };
}

function getActionStatus(action: string): { icon: typeof CheckCircle; color: string; label: string } {
  if (action.includes('SUCCESS') || action === 'LOGOUT') return { icon: CheckCircle, color: 'text-green-400', label: 'Sukses' };
  if (action.includes('VERIFIED') || action.includes('PREPARE') || action.includes('START')) return { icon: Info, color: 'text-cyan-400', label: 'Proses' };
  if (action.includes('DELETE')) return { icon: AlertTriangle, color: 'text-red-400', label: 'Dihapus' };
  if (action.includes('UPDATE') || action.includes('EDIT') || action.includes('CHANGE')) return { icon: Settings, color: 'text-blue-400', label: 'Diubah' };
  if (action.includes('CREATE') || action.includes('GENERATE') || action.startsWith('REGISTER')) return { icon: CheckCircle, color: 'text-emerald-400', label: 'Dibuat' };
  if (action.includes('VIEW')) return { icon: Eye, color: 'text-sky-400', label: 'Dilihat' };
  return { icon: Info, color: 'text-gray-400', label: 'Info' };
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function timeAgo(dateStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 10) return 'baru saja';
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}j`;
  return `${Math.floor(diffHr / 24)}h`;
}

export default function ActivityLog({ role }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await apiFetch('/api/activity');
      if (!res.ok) throw new Error('Gagal memuat aktivitas');
      const data = await res.json();
      setActivities(data.activities || []);
      setError('');
    } catch {
      setError('Gagal memuat aktivitas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    intervalRef.current = setInterval(fetchActivities, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchActivities]);

  const showUserCol = role !== 'USER';

  return (
    <div className="glossy-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Aktivitas Terbaru</h3>
        <div className="flex items-center gap-2">
          {loading && activities.length === 0 && (
            <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
          )}
          <span className="text-xs text-gray-500">Auto-refresh 30s</span>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-gray-400 py-4 text-center">{error}</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Belum ada aktivitas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-2.5 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Waktu</th>
                <th className="text-left py-2.5 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Aksi</th>
                <th className="text-left py-2.5 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="text-left py-2.5 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wider">Deskripsi</th>
                {showUserCol && (
                  <th className="text-left py-2.5 pr-4 font-medium text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Pengguna</th>
                )}
                <th className="text-left py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && activities.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5 animate-pulse">
                    <td className="py-3 pr-4"><div className="h-3 bg-white/5 rounded w-20" /></td>
                    <td className="py-3 pr-4"><div className="h-5 bg-white/5 rounded w-14" /></td>
                    <td className="py-3 pr-4"><div className="h-5 bg-white/5 rounded w-12" /></td>
                    <td className="py-3 pr-4"><div className="h-3 bg-white/5 rounded w-40" /></td>
                    {showUserCol && <td className="py-3 pr-4"><div className="h-3 bg-white/5 rounded w-24" /></td>}
                    <td className="py-3"><div className="h-3 bg-white/5 rounded w-16" /></td>
                  </tr>
                ))
              ) : (
                activities.map((a) => {
                  const badge = getActionBadge(a.action);
                  const status = getActionStatus(a.action);
                  const StatusIcon = status.icon;

                  return (
                    <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <div className="text-gray-300 text-xs font-mono">{formatTime(a.createdAt)}</div>
                        <div className="text-gray-600 text-[10px]">{timeAgo(a.createdAt)}</div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                          <span className={status.color}>{status.label}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-gray-300 text-xs max-w-[220px] truncate" title={a.description}>
                          {a.description}
                        </div>
                      </td>
                      {showUserCol && (
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <div className="text-gray-400 text-xs">{a.auditor.name}</div>
                          <div className="text-gray-600 text-[10px]">{a.auditor.email}</div>
                        </td>
                      )}
                      <td className="py-3 whitespace-nowrap">
                        {a.ipAddress ? (
                          <span className="text-gray-500 text-xs font-mono">{a.ipAddress}</span>
                        ) : (
                          <span className="text-gray-700 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
