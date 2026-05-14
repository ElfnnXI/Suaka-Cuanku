import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  return (
    <section className="pt-40 pb-20 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl -z-10" />

      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-block px-4 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-6 uppercase tracking-widest">
            &#10022; Build on Trusted Network
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight" style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>
            <span className="gradient-text">Solusi Pendanaan Digital</span>
            <br />
            <span className="text-white">Terpercaya & Terdepan</span>{' '}
            <span className="gradient-text-cyan">di Indonesia</span>
          </h1>

          {/* Description */}
          <p className="text-gray-400 max-w-2xl mx-auto text-lg mb-10 leading-relaxed">
            Akses kemudahan finansial dengan standar keamanan tertinggi. Kami hadir untuk membantu kebutuhan mendesak Anda dengan proses yang transparan.
          </p>

          <p className="text-cyan-400 font-medium mb-12">
            Platform P2P Lending Legal yang Mengutamakan Keamanan Data & Kemudahan Akses.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <Link href="/register">
              <Button size="lg" className="btn-glossy-primary w-full sm:w-auto px-8 py-4 rounded-xl font-bold flex items-center gap-2">
                Ajukan Pendanaan Sekarang
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </Link>
            <Link href="#cta">
              <Button variant="outline" size="lg" className="glossy-card w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-white border-white/20 hover:border-cyan-400/50">
                Hubungi Layanan Kami
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center glossy-card p-6 rounded-2xl">
              <div className="text-3xl font-bold text-cyan-400 mb-2">10K+</div>
              <div className="text-gray-400 text-sm">Pengguna Aktif</div>
            </div>
            <div className="text-center glossy-card p-6 rounded-2xl">
              <div className="text-3xl font-bold text-cyan-400 mb-2">Rp 50M+</div>
              <div className="text-gray-400 text-sm">Pinjaman Disalurkan</div>
            </div>
            <div className="text-center glossy-card p-6 rounded-2xl">
              <div className="text-3xl font-bold text-cyan-400 mb-2">98%</div>
              <div className="text-gray-400 text-sm">Tingkat Kepuasan</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
