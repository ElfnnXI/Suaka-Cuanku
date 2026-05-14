'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Shield, RefreshCw, Calendar, User } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';

interface AuditLog {
  id: string;
  action: string;
  description: string;
  details?: string;
  createdAt: string;
  auditor: {
    id: string;
    name: string;
    email: string;
  };
}

export default function AuditorAuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchAuditLogs = useCallback(() => {
    setLoading(true);
    apiFetch('/api/auditor/audit-logs')
      .then(res => res.json())
      .then(data => {
        if (data.auditLogs) {
          setAuditLogs(data.auditLogs);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const filteredLogs = filter === 'all'
    ? auditLogs
    : auditLogs.filter(log => log.action === filter);

  const uniqueActions = [...new Set(auditLogs.map(log => log.action))];

  return (
    <DashboardLayout role="AUDITOR">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Log Audit
            </h1>
            <p className="text-gray-400">Riwayat aktivitas audit - Read Only Access</p>
          </div>
          <button
            onClick={fetchAuditLogs}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-colors text-white"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Tabs */}
        {uniqueActions.length > 0 && (
          <div className="flex gap-2 bg-white/10 p-2 rounded-xl border border-white/20 w-fit">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:bg-white/10'
              }`}
            >
              Semua
            </button>
            {uniqueActions.slice(0, 5).map((action) => (
              <button
                key={action}
                onClick={() => setFilter(action)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === action
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-400 hover:bg-white/10'
                }`}
              >
                {action}
              </button>
            ))}
          </div>
        )}

        {/* Audit Logs List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-12 text-center">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Tidak Ada Log Audit</h3>
            <p className="text-gray-400">Belum ada aktivitas audit yang tercatat.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                        <Shield className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{log.action}</h3>
                        <div className="text-sm text-gray-400">{log.description}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-400 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{log.auditor.name} ({log.auditor.email})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(log.createdAt).toLocaleString('id-ID', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                      </div>
                    </div>

                    {log.details && (
                      <div className="mt-3 p-3 bg-gray-700/40 rounded-lg">
                        <div className="text-xs text-gray-400 font-mono">
                          {log.details.length > 200 ? log.details.substring(0, 200) + '...' : log.details}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Notice */}
        <div className="backdrop-blur-sm bg-cyan-900/20 border border-cyan-500/30 rounded-2xl p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-cyan-400 mb-1">Log Audit</h3>
              <p className="text-sm text-gray-400">
                Semua aktivitas auditor dicatat dalam log audit untuk keperluan pelacakan dan akuntabilitas. Setiap kali auditor melihat data atau menghasilkan laporan, aktivitas tersebut akan tercatat di sini.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
