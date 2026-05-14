'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/client-api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { MessageSquare, Mail, Calendar, RefreshCw } from 'lucide-react';

interface Comment {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    apiFetch('/api/admin/comments')
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch comments');
        }
        return res.json();
      })
      .then(
        data => {
          if (mounted && data.comments) {
            setComments(data.comments);
            setLoading(false);
          }
        },
        () => {
          if (mounted) {
            setLoading(false);
          }
        }
      );

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Kelola Komentar
            </h1>
            <p className="text-gray-400">Lihat semua pertanyaan dan komentar dari pengunjung</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 glossy-card rounded-xl hover:bg-white/10 transition-colors text-white"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Comments List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="glossy-card rounded-2xl p-12 text-center">
            <MessageSquare className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Belum Ada Komentar</h3>
            <p className="text-gray-400">Belum ada pertanyaan atau komentar dari pengunjung.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="glossy-card rounded-2xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-sm">
                          {comment.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{comment.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Mail className="w-3 h-3" />
                          <span>{comment.email}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {new Date(comment.createdAt).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{comment.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {!loading && comments.length > 0 && (
          <div className="glossy-card rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Statistik Komentar</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-cyan-400">{comments.length}</div>
                <div className="text-sm text-gray-400">Total Komentar</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-cyan-400">
                  {comments.filter(c => {
                    const date = new Date(c.createdAt);
                    const now = new Date();
                    return date.toDateString() === now.toDateString();
                  }).length}
                </div>
                <div className="text-sm text-gray-400">Hari Ini</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-cyan-400">
                  {new Set(comments.map(c => c.email.toLowerCase())).size}
                </div>
                <div className="text-sm text-gray-400">Email Unik</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-cyan-400">
                  {comments.length > 0
                    ? Math.round(comments.reduce((sum, c) => sum + c.message.length, 0) / comments.length)
                    : 0}
                </div>
                <div className="text-sm text-gray-400">Rata-rata Karakter</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
