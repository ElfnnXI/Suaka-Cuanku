'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

export function CTASection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMessage('');

    try {
      const response = await fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit comment');
      }

      setStatus('success');
      setStatusMessage('Komentar Anda berhasil dikirim! Terima kasih.');
      setFormData({ name: '', email: '', message: '' });
      
      // Reset status after 5 seconds
      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
      }, 5000);
    } catch (err: unknown) {
      setStatus('error');
      const message = err instanceof Error ? err.message : 'Gagal mengirim komentar. Coba lagi.';
      setStatusMessage(message);
    }
  };

  return (
    <section id="cta" className="py-20 relative">
      <div className="max-w-6xl mx-auto px-8">
        {/* CTA Banner */}
        <div className="max-w-3xl mx-auto text-center mb-24">
          <div className="glossy-card p-12 rounded-3xl border-cyan-500/10">
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>
              <span className="gradient-text">Siap Mendapatkan Pendanaan?</span>
            </h2>
            <p className="text-gray-400 mb-8 text-lg">
              Daftar sekarang dan ajukan pinjaman Anda dalam hitungan menit. Proses cepat, mudah, dan transparan.
            </p>
            <Link href="/register">
              <Button size="lg" className="btn-glossy-primary px-8 py-4 rounded-xl font-bold flex items-center gap-2 mx-auto">
                Daftar Sekarang
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <div className="mt-12 grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-cyan-400 mb-2">24/7</div>
                <div className="text-gray-400 text-sm">Layanan Online</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-cyan-400 mb-2">5 Menit</div>
                <div className="text-gray-400 text-sm">Proses Pendaftaran</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-cyan-400 mb-2">100%</div>
                <div className="text-gray-400 text-sm">Aman & Terpercaya</div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="max-w-3xl mx-auto">
          <div className="glossy-card p-10 rounded-3xl border-cyan-500/10">
            <h2 className="text-2xl font-bold mb-8 text-center gradient-text" style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>
              Tinggalkan Pertanyaan atau Komentar
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {statusMessage && (
                <div className={`p-4 rounded-xl text-sm ${
                  status === 'success' 
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {statusMessage}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Nama Lengkap</label>
                  <input
                    type="text"
                    placeholder="Masukkan nama Anda"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    placeholder="nama@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500 transition"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Teks Komentar</label>
                <textarea
                  rows={4}
                  placeholder="Apa yang ingin Anda tanyakan?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-cyan-500 transition resize-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full btn-glossy-primary py-4 rounded-xl font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? 'Mengirim...' : 'Kirim Komentar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
