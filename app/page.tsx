import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { CTASection } from '@/components/landing/CTASection';
import { Footer } from '@/components/landing/Footer';
import { AnimatedOrbsWrapper } from '@/components/AnimatedOrbsWrapper';

export default function Home() {
  return (
    <main className="min-h-screen relative">
      {/* Animated Background Orbs */}
      <AnimatedOrbsWrapper />
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[rgba(15,23,42,0.8)] border-b border-white/5">
        <div className="flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-xl font-semibold tracking-tight text-white">
              Suaka <span className="text-cyan-400">Cuanku</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm font-medium">
              Fitur
            </a>
            <a href="#testimonials" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm font-medium">
              Testimoni
            </a>
            <a href="#cta" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm font-medium">
              Kontak
            </a>
          </div>

          <div className="flex gap-4">
            <Link href="/login">
              <Button variant="outline" size="sm" className="rounded-full border-gray-600 text-gray-300 hover:bg-white/10 hover:border-gray-500 text-sm px-6">
                Login
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="glossy" size="sm" className="rounded-full text-sm px-6">
                Register
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </main>
  );
}
