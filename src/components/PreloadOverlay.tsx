'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, Zap, Activity, Database, Shield } from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { DefaultBrandIcon } from './Logo';

const BrandBlock: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => {
  const { generalSettings } = useStore();
  const logoUrl = generalSettings?.logoUrl;
  if (logoUrl) {
    return <img src={logoUrl} alt="Logo" className="h-16 max-w-[200px] object-contain mb-1" referrerPolicy="no-referrer" />;
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2.5 mb-0.5">
        <DefaultBrandIcon className="w-10 h-10" />
        <span className={cn('font-black text-2xl tracking-tight', isDarkMode ? 'text-white' : 'text-slate-900')}>WattsUp</span>
      </div>
      <p className={cn('text-[10px] uppercase tracking-[0.28em] font-bold', isDarkMode ? 'text-slate-400' : 'text-slate-500')}>
        Energy Intelligence
      </p>
    </div>
  );
};

const STEPS = [
  { icon: Database, label: 'Connecting to database', threshold: 25 },
  { icon: Zap,      label: 'Loading energy data',    threshold: 55 },
  { icon: Activity, label: 'Computing analytics',    threshold: 80 },
  { icon: Shield,   label: 'Finalizing session',     threshold: 100 },
];

interface PreloadOverlayProps {
  progress: number;
  status: string;
  isVisible: boolean;
  isDarkMode?: boolean;
}

export const PreloadOverlay: React.FC<PreloadOverlayProps> = ({ progress, status, isVisible }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    setIsDarkMode(saved ? saved === 'dark' : true);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(p => {
      const next = !p;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  }, []);

  const activeStep = STEPS.findIndex(s => progress < s.threshold);
  const currentStep = activeStep === -1 ? STEPS.length - 1 : activeStep;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6"
        >
          {/* Background image — visible in both modes */}
          <div className={cn('absolute inset-0 z-0', isDarkMode ? 'bg-slate-950' : 'bg-slate-50')}>
            <img
              src="https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&q=90&w=2070"
              alt=""
              className={cn('w-full h-full object-cover', isDarkMode ? 'opacity-40 grayscale' : 'opacity-60')}
              referrerPolicy="no-referrer"
            />
            <div className={cn('absolute inset-0', isDarkMode
              ? 'bg-gradient-to-br from-slate-950/30 via-slate-950/60 to-slate-950/95'
              : 'bg-gradient-to-t from-white/70 via-white/20 to-white/10'
            )} />
          </div>

          {/* Toggle */}
          <button onClick={toggleDarkMode}
            className={cn('fixed top-6 right-6 z-30 p-2.5 rounded-xl border transition-all',
              isDarkMode ? 'bg-white/5 border-white/10 text-amber-400 hover:bg-white/10' : 'bg-white/90 border-white/60 text-slate-600 hover:bg-white shadow-lg')}>
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className={cn(
              'relative z-10 w-full max-w-sm rounded-3xl shadow-2xl border overflow-hidden backdrop-blur-xl',
              isDarkMode ? 'bg-slate-900/90 border-white/10' : 'bg-white/90 border-white/80'
            )}
          >
            {/* Top accent */}
            <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />

            <div className="p-8 flex flex-col items-center text-center">
              <div className="mb-6">
                <BrandBlock isDarkMode={isDarkMode} />
              </div>

              {/* Animated icon for current step */}
              <motion.div
                key={currentStep}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border',
                  isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100')}
              >
                {React.createElement(STEPS[currentStep].icon, { className: 'w-7 h-7 text-emerald-500' })}
              </motion.div>

              {/* Status */}
              <p className={cn('text-sm font-medium mb-6', isDarkMode ? 'text-slate-300' : 'text-slate-600')}>
                {status || STEPS[currentStep].label + '…'}
              </p>

              {/* Progress bar */}
              <div className={cn('w-full h-2 rounded-full overflow-hidden mb-2', isDarkMode ? 'bg-slate-800' : 'bg-slate-200')}>
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                />
              </div>
              <p className="text-[10px] font-bold font-mono text-emerald-500 mb-6">{Math.round(progress)}% Complete</p>

              {/* Step indicators */}
              <div className="flex items-center gap-2">
                {STEPS.map((step, i) => (
                  <div key={i} className={cn(
                    'h-1.5 rounded-full transition-all duration-500',
                    i <= currentStep
                      ? 'bg-emerald-500 w-6'
                      : isDarkMode ? 'bg-slate-700 w-3' : 'bg-slate-200 w-3'
                  )} />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
