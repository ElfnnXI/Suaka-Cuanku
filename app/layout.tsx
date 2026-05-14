import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Suaka Cuanku - Solusi Pendanaan Digital Terpercaya",
  description: "Platform P2P Lending legal yang mengutamakan keamanan data dan kemudahan akses untuk kebutuhan finansial Anda.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body className={`${inter.className} ${poppins.variable} min-h-screen`}>
        <div className="relative min-h-screen">
          {/* Background glow spheres */}
          <div className="glow-sphere top-0 left-0" />
          <div className="glow-sphere bottom-0 right-0" />
          {children}
        </div>
      </body>
    </html>
  );
}
