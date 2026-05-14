'use client';

export function AnimatedOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Orb 1 - Cyan */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)',
          top: '10%',
          left: '20%',
          animation: 'float1 20s ease-in-out infinite',
        }}
      />
      
      {/* Orb 2 - Purple */}
      <div 
        className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%)',
          top: '50%',
          right: '15%',
          animation: 'float2 25s ease-in-out infinite',
        }}
      />
      
      {/* Orb 3 - Blue */}
      <div 
        className="absolute w-[450px] h-[450px] rounded-full opacity-15 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)',
          bottom: '20%',
          left: '10%',
          animation: 'float3 22s ease-in-out infinite',
        }}
      />
      
      {/* Orb 4 - Green */}
      <div 
        className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, transparent 70%)',
          top: '30%',
          left: '50%',
          animation: 'float1 18s ease-in-out infinite reverse',
        }}
      />
      
      {/* Orb 5 - Pink */}
      <div 
        className="absolute w-[350px] h-[350px] rounded-full opacity-15 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%)',
          top: '70%',
          right: '30%',
          animation: 'float2 23s ease-in-out infinite reverse',
        }}
      />
      
      <style>{`
        @keyframes float1 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(100px, -50px) scale(1.1);
          }
          50% {
            transform: translate(50px, 100px) scale(0.9);
          }
          75% {
            transform: translate(-50px, 50px) scale(1.05);
          }
        }
        
        @keyframes float2 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(-80px, 80px) scale(1.15);
          }
          66% {
            transform: translate(60px, -60px) scale(0.95);
          }
        }
        
        @keyframes float3 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          20% {
            transform: translate(120px, 40px) scale(1.08);
          }
          40% {
            transform: translate(80px, -80px) scale(0.92);
          }
          60% {
            transform: translate(-40px, -100px) scale(1.12);
          }
          80% {
            transform: translate(-80px, 40px) scale(0.98);
          }
        }
      `}</style>
    </div>
  );
}
