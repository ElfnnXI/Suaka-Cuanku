import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Andi Pratama',
    role: 'Pengusaha Kecil',
    content: 'Proses pinjaman sangat cepat dan mudah. Dalam 2 hari dana sudah cair. Sangat membantu untuk modal usaha!',
    rating: 5,
  },
  {
    name: 'Siti Rahayu',
    role: 'Karyawan Swasta',
    content: 'Bunga rendah dan transparan. Tidak ada biaya tersembunyi. Pelayanannya juga sangat responsif.',
    rating: 5,
  },
  {
    name: 'Budi Santoso',
    role: 'Freelancer',
    content: 'Syaratnya mudah dan proses verifikasi cepat. Platform yang sangat membantu untuk kebutuhan mendesak.',
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 relative">
      <div className="max-w-6xl mx-auto px-8">
        {/* Section Title */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>
            <span className="gradient-text">Apa Kata Pengguna Kami</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Ribuan orang telah mempercayai Suaka Cuanku untuk kebutuhan finansial mereka
          </p>
        </div>

        {/* Testimonial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="glossy-card p-8 rounded-2xl"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Content */}
              <p className="text-gray-300 mb-6 leading-relaxed italic">
                &ldquo;{testimonial.content}&rdquo;
              </p>

              {/* Author */}
              <div>
                <div className="font-semibold text-white">{testimonial.name}</div>
                <div className="text-sm text-gray-400">{testimonial.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
