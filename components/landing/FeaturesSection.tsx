import { Shield, TrendingUp, Clock, CheckCircle, DollarSign, Lock } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Keamanan Terjamin',
    description: 'Sistem enkripsi data berlapis memastikan informasi pribadi dan finansial Anda 100% aman dan rahasia.',
  },
  {
    icon: DollarSign,
    title: 'Transparan Tanpa Biaya Tersembunyi',
    description: 'Semua bunga dan tenor dijelaskan di awal. Tidak ada biaya administrasi yang mengejutkan.',
  },
  {
    icon: Clock,
    title: 'Proses Cepat & Mudah',
    description: 'Pengajuan 100% online tanpa ribet. Persetujuan cepat dengan teknologi verifikasi canggih.',
  },
  {
    icon: CheckCircle,
    title: 'Terdaftar & Diawasi Ketat',
    description: 'Kami beroperasi penuh sesuai regulasi pemerintah Indonesia untuk perlindungan konsumen.',
  },
  {
    icon: TrendingUp,
    title: 'Bunga Kompetitif',
    description: 'Suku bunga rendah dan kompetitif yang disesuaikan dengan profil kredit Anda.',
  },
  {
    icon: Lock,
    title: 'Privasi Terjaga',
    description: 'Informasi pribadi Anda dilindungi dengan kebijakan privasi ketat dan standar internasional.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 relative">
      <div className="max-w-6xl mx-auto px-8">
        {/* Section Title */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>
            <span className="gradient-text">Mengapa Memilih Suaka Cuanku?</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Kami memberikan layanan terbaik untuk kebutuhan finansial Anda dengan standar keamanan tertinggi
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="glossy-card p-8 rounded-2xl flex gap-6"
            >
              <div className="text-cyan-400 text-3xl flex-shrink-0">
                <feature.icon />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-white">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
