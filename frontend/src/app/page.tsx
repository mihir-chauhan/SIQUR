"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  Shield, 
  Target, 
  Cpu, 
  Lock, 
  ChevronRight, 
  BarChart3, 
  Globe,
  Zap,
  Eye
} from "lucide-react";

// --- Components ---

function GridBackground() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <div 
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(circle at 50% 50%, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 30%, transparent 70%)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
    </div>
  );
}

function ShinyBadge({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-white/70 overflow-hidden group cursor-default"
    >
      <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <span className="relative z-10">{children}</span>
      <ChevronRight size={12} className="relative z-10 opacity-50 group-hover:translate-x-0.5 transition-transform" />
    </motion.div>
  );
}

function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`spotlight-card group ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(255,255,255,0.06), transparent 40%)`,
        }}
      />
      <div className="relative z-10 p-8 h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}

export default function VercelHeroPage() {
  const router = useRouter();
  const [isMounting, setIsMounting] = useState(true);

  useEffect(() => {
    setIsMounting(false);
  }, []);

  if (isMounting) return <div className="min-h-screen bg-black" />;

  return (
    <main className="relative min-h-screen w-full bg-black text-white selection:bg-white selection:text-black overflow-x-hidden font-sans">
      <GridBackground />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 backdrop-blur-md border-b border-white/5 bg-black/50">
        <div className="flex items-center gap-2 font-bold tracking-tight text-xl">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <Shield size={18} className="text-black" />
          </div>
          <span>CATAPULT</span>
        </div>
        <div className="flex items-center gap-8 text-sm font-medium text-white/60">
          <a href="#" className="hover:text-white transition-colors">Documentation</a>
          <a href="#" className="hover:text-white transition-colors">Pricing</a>
          <button 
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-white/90 transition-all active:scale-95"
          >
            Dashboard
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-4 md:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        <ShinyBadge>Introducing Catapult v2.0 AI Persistence</ShinyBadge>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-8 text-6xl md:text-8xl font-black tracking-tight leading-[1.1]"
        >
          Security at the <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40">
            Speed of Thought.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-8 text-lg md:text-xl text-white/50 max-w-2xl leading-relaxed"
        >
          The next generation of autonomous surveillance. Catapult leverages advanced neural networks to provide real-time, predictive intelligence for complex environments.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 flex flex-col sm:flex-row items-center gap-4"
        >
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-black font-bold text-lg hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all active:scale-95 flex items-center justify-center gap-2 group"
          >
            Open Dashboard
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button className="w-full sm:w-auto px-8 py-4 rounded-full border border-white/10 bg-white/5 font-semibold text-lg hover:bg-white/10 transition-all">
            Contact Sales
          </button>
        </motion.div>
      </section>

      {/* Bento Grid Section */}
      <section className="relative py-20 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[250px]">
          
          {/* Main Feature */}
          <SpotlightCard className="md:col-span-8 md:row-span-2">
            <div className="mb-auto">
              <Globe className="text-white/40 mb-4" size={32} />
              <h3 className="text-2xl font-bold mb-2">Global Persistence</h3>
              <p className="text-white/50 leading-relaxed max-w-md">
                Deploy monitoring agents across any terrain. Our satellite orchestration ensures 99.9% uptime for critical feeds.
              </p>
            </div>
            <div className="mt-8 w-full h-40 rounded-xl bg-gradient-to-tr from-white/5 to-transparent border border-white/5 overflow-hidden flex items-center justify-center">
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="absolute w-32 h-32 rounded-full border border-white/10 animate-[spin_20s_linear_infinite]" />
                <div className="absolute w-48 h-48 rounded-full border border-white/5 animate-[spin_30s_linear_infinite_reverse]" />
                <Target size={40} className="text-white animate-pulse" />
              </div>
            </div>
          </SpotlightCard>

          {/* Quick Metrics */}
          <SpotlightCard className="md:col-span-4 md:row-span-1">
            <BarChart3 className="text-white/40 mb-4" size={24} />
            <h3 className="text-xl font-bold mb-1">0.3ms Latency</h3>
            <p className="text-sm text-white/50">Edge processing for zero-lag intelligence.</p>
          </SpotlightCard>

          {/* Neural Engine */}
          <SpotlightCard className="md:col-span-4 md:row-span-1">
            <Cpu className="text-white/40 mb-4" size={24} />
            <h3 className="text-xl font-bold mb-1">Neural Core v4</h3>
            <p className="text-sm text-white/50">Predictive analysis powered by transformers.</p>
          </SpotlightCard>

          {/* Vision Modes */}
          <SpotlightCard className="md:col-span-4 md:row-span-2">
            <Eye className="text-white/40 mb-4" size={32} />
            <h3 className="text-2xl font-bold mb-2">Multispectral</h3>
            <p className="text-white/50 text-sm mb-6">Switch between Standard, FLIR, and NV modes instantly.</p>
            <div className="grid grid-cols-2 gap-2 mt-auto">
              <div className="aspect-square rounded-lg bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-1 group/mode cursor-pointer hover:bg-white/10 transition-colors">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-white/40 uppercase">NV MODE</span>
              </div>
              <div className="aspect-square rounded-lg bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-white/10 transition-colors">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[10px] font-bold text-white/40 uppercase">FLIR</span>
              </div>
            </div>
          </SpotlightCard>

          {/* Secure Access */}
          <SpotlightCard className="md:col-span-8 md:row-span-1">
            <div className="flex items-center justify-between h-full">
              <div>
                <Lock className="text-white/40 mb-4" size={24} />
                <h3 className="text-xl font-bold mb-1">Quantum Encryption</h3>
                <p className="text-sm text-white/50">Your data is secured by post-quantum cryptosystems.</p>
              </div>
              <Zap size={60} className="text-white/10" />
            </div>
          </SpotlightCard>

        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 px-8 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2 font-bold opacity-50">
          <Shield size={16} />
          <span>CATAPULT</span>
        </div>
        <p className="text-white/30 text-xs tracking-widest uppercase">
          © 2026 Catapult Intelligence Platforms. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
