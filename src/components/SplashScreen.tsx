import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'show' | 'out'>('show')

  useEffect(() => {
    // After 2.2s start fade out
    const t1 = setTimeout(() => setPhase('out'), 2200)
    // After fade out complete (0.6s) → call onDone
    const t2 = setTimeout(() => onDone(), 2800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #001428 0%, #002952 40%, #0064a8 80%, #0099CC 100%)',
        transition: 'opacity 0.6s ease-out',
        opacity: phase === 'out' ? 0 : 1,
        pointerEvents: phase === 'out' ? 'none' : 'all',
      }}
    >
      {/* Animated rings */}
      {[180, 320, 460, 600].map((size, i) => (
        <div key={size}
          className="absolute rounded-full border border-white/10"
          style={{
            width: size, height: size,
            animation: `pulse-ring 3s ease-in-out ${i * 0.3}s infinite`,
          }}
        />
      ))}

      {/* Particles */}
      {['⚽','🏆','⭐','🌟','✨'].map((emoji, i) => (
        <div key={i}
          className="absolute text-2xl select-none"
          style={{
            animation: `float-particle 4s ease-in-out ${i * 0.5}s infinite`,
            left: `${15 + i * 18}%`,
            top: `${20 + (i % 2) * 55}%`,
            opacity: 0.25,
          }}>
          {emoji}
        </div>
      ))}

      {/* Main content */}
      <div className="flex flex-col items-center gap-6 relative z-10"
        style={{ animation: 'splash-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>

        {/* Logo */}
        <div className="relative">
          {/* Glow behind logo */}
          <div className="absolute inset-0 rounded-3xl bg-[#0099CC]/40 blur-xl scale-110"/>
          <img
            src="/copa2026-logo.jpg"
            alt="Copa 2026"
            className="relative w-36 h-36 rounded-3xl object-cover shadow-2xl"
            style={{ border: '3px solid rgba(255,255,255,0.2)' }}
          />
          {/* Shine effect */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden">
            <div style={{ animation: 'shine 2.5s ease-in-out 0.5s infinite' }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"/>
          </div>
        </div>

        {/* Title */}
        <div className="text-center" style={{ animation: 'fade-up 0.6s ease-out 0.3s both' }}>
          <h1 className="text-white font-black text-[28px] tracking-wide leading-tight"
            style={{ textShadow: '0 2px 20px rgba(0,153,204,0.6)' }}>
            BOLÃO COPA 2026
          </h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className="h-px w-8 bg-white/30"/>
            <span className="text-[#0099CC] font-bold text-[16px] tracking-[0.2em]">BEL</span>
            <div className="h-px w-8 bg-white/30"/>
          </div>
        </div>

        {/* Loading dots */}
        <div className="flex gap-2 mt-2" style={{ animation: 'fade-up 0.6s ease-out 0.5s both' }}>
          {[0, 1, 2].map(i => (
            <div key={i}
              className="w-2 h-2 rounded-full bg-white/50"
              style={{ animation: `bounce-dot 1s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom branding */}
      <div className="absolute bottom-10 text-white/30 text-[11px] tracking-widest uppercase"
        style={{ animation: 'fade-up 0.6s ease-out 0.7s both' }}>
        Copa do Mundo FIFA 2026
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes splash-in {
          from { opacity: 0; transform: scale(0.7) translateY(30px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50%       { transform: scale(1.05); opacity: 0.08; }
        }
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1; }
        }
        @keyframes shine {
          0%   { transform: translateX(-200%) skewX(-12deg); }
          60%, 100% { transform: translateX(300%) skewX(-12deg); }
        }
        @keyframes float-particle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%       { transform: translateY(-20px) rotate(10deg); }
        }
      `}</style>
    </div>
  )
}
