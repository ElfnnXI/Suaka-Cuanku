import Link from 'next/link';
import { Mail, Phone, MapPin, Globe, Share2, MessageCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="text-center py-10 border-t border-white/5 text-gray-500 text-sm">
      <div className="max-w-6xl mx-auto px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8 text-left">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <span className="text-xl font-semibold text-white">
                Suaka <span className="text-cyan-400">Cuanku</span>
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Platform peminjaman uang modern dengan proses cepat, transparan, dan terpercaya.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-white">Menu</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Beranda
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Masuk
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Daftar
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-4 text-white">Dukungan</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Syarat & Ketentuan
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Kebijakan Privasi
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-white">Kontak</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-gray-400 text-sm">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-400" />
                <span>support@suakacuanku.com</span>
              </li>
              <li className="flex items-start gap-2 text-gray-400 text-sm">
                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-400" />
                <span>+62 812-3456-7890</span>
              </li>
              <li className="flex items-start gap-2 text-gray-400 text-sm">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-400" />
                <span>Jakarta, Indonesia</span>
              </li>
            </ul>

            {/* Social Media */}
            <div className="flex gap-3 mt-4">
              <a href="#" className="w-8 h-8 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/50 rounded-lg flex items-center justify-center transition-colors">
                <Globe className="w-4 h-4 text-gray-400" />
              </a>
              <a href="#" className="w-8 h-8 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/50 rounded-lg flex items-center justify-center transition-colors">
                <Share2 className="w-4 h-4 text-gray-400" />
              </a>
              <a href="#" className="w-8 h-8 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/50 rounded-lg flex items-center justify-center transition-colors">
                <MessageCircle className="w-4 h-4 text-gray-400" />
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-white/5 text-center text-gray-500 text-sm">
          &copy; 2026 Suaka Cuanku. Seluruh Hak Cipta Dilindungi.
        </div>
      </div>
    </footer>
  );
}
