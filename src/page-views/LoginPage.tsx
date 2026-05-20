'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useData } from '../DataContext';
import { Settings, Sun, Moon, Zap, Shield, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';
import { useStore } from '../store/useStore';
import { DefaultBrandIcon } from '../components/Logo';

const BrandBlock: React.FC<{ isDarkMode: boolean; size: 'sm' | 'lg' }> = ({ isDarkMode, size }) => {
  const { generalSettings } = useStore();
  const logoUrl = generalSettings?.logoUrl;
  const isLg = size === 'lg';
  return (
    <div className="flex flex-col items-center gap-1">
      {logoUrl ? (
        <img src={logoUrl} alt="Logo"
          className={cn('object-contain mb-1', isLg ? 'h-20 max-w-[220px]' : 'h-14 max-w-[160px]')}
          referrerPolicy="no-referrer" />
      ) : (
        <>
          <div className="flex items-center gap-2.5 mb-0.5">
            <DefaultBrandIcon className={isLg ? 'w-12 h-12' : 'w-9 h-9'} />
            <span className={cn('font-black tracking-tight', isDarkMode ? 'text-white' : 'text-slate-900', isLg ? 'text-3xl' : 'text-xl')}>
              WattsUp
            </span>
          </div>
          <p className={cn('uppercase tracking-[0.28em] font-bold', isDarkMode ? 'text-slate-400' : 'text-slate-500', isLg ? 'text-[11px]' : 'text-[9px]')}>
            Energy Intelligence
          </p>
        </>
      )}
    </div>
  );
};

export const LoginPage: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    setIsDarkMode(saved ? saved === 'dark' : true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);
  const toggleDarkMode = useCallback(() => setIsDarkMode(p => !p), []);

  const { user, loading: authLoading, profile, login, isConfigured, bypassLogin } = useAuth();
  const { isLoading: dataLoading, loadProgress } = useData();

  useEffect(() => {}, [user, authLoading, dataLoading, profile?.approved]);

  if (!isConfigured) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center p-4', isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900')}>
        <div className={cn('w-full max-w-md p-8 rounded-3xl border shadow-xl text-center', isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200')}>
          <Settings className="text-amber-500 w-10 h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Configuration Required</h1>
          <div className={cn('p-4 rounded-xl text-left text-[10px] font-mono space-y-1', isDarkMode ? 'bg-black/40' : 'bg-slate-100')}>
            {['NEXT_PUBLIC_AZURE_CLIENT_ID','NEXT_PUBLIC_AZURE_TENANT_ID','NEXT_PUBLIC_AZURE_TENANT_NAME','NEXT_PUBLIC_AZURE_USER_FLOW'].map(k => (
              <p key={k} className="text-emerald-500">{k}</p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const showLoading = authLoading || (user && profile?.approved);
  const displayProgress = authLoading ? 30 : (profile && !profile.approved) ? 60 : (!dataLoading && user && profile?.approved) ? 100 : loadProgress;
  const displayStatus = authLoading ? 'Authenticating with Microsoft…'
    : (profile && !profile.approved) ? 'Awaiting Admin Approval…'
    : (!dataLoading && user && profile?.approved) ? 'System Ready'
    : dataLoading ? 'Loading Energy Data…'
    : 'Initializing System…';

  return (
    <div className={cn('min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300', isDarkMode ? 'text-white' : 'text-slate-900')}>
      {/* Background — crisp in day mode */}
      <div className={cn('fixed inset-0 z-0', isDarkMode ? 'bg-slate-950' : 'bg-slate-50')}>
        <img
          src="https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&q=90&w=2070"
          alt=""
          className={cn('w-full h-full object-cover transition-all duration-300',
            isDarkMode ? 'opacity-40 grayscale' : 'opacity-60')}
          referrerPolicy="no-referrer"
        />
        {/* Day: subtle gradient from bottom only, image stays visible */}
        <div className={cn('absolute inset-0', isDarkMode
          ? 'bg-gradient-to-br from-slate-950/30 via-slate-950/60 to-slate-950/95'
          : 'bg-gradient-to-t from-white/70 via-white/20 to-white/10'
        )} />
      </div>

      {/* Day/Night toggle */}
      <button onClick={toggleDarkMode}
        className={cn('fixed top-6 right-6 z-30 p-2.5 rounded-xl border transition-all',
          isDarkMode ? 'bg-white/5 border-white/10 text-amber-400 hover:bg-white/10' : 'bg-white/90 border-white/60 text-slate-600 hover:bg-white shadow-lg')}
        title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
        {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>



      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className={cn(
          'w-full max-w-md rounded-3xl shadow-2xl border relative z-10 backdrop-blur-xl overflow-hidden',
          isDarkMode ? 'bg-slate-900/90 border-white/10' : 'bg-white/90 border-white/80'
        )}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full bg-[#00a4ef]" />

        <div className="p-8">
          {showLoading ? (
            <div className="py-8 flex flex-col items-center text-center">
              <div className="mb-8">
                <BrandBlock isDarkMode={isDarkMode} size="lg" />
              </div>
              {/* Animated electricity icon */}
              <div className="relative mb-6">
                <motion.div
                  animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"
                >
                  <Activity className="w-8 h-8 text-emerald-500" />
                </motion.div>
              </div>
              <p className={cn('text-sm mb-6 font-medium', isDarkMode ? 'text-slate-300' : 'text-slate-600')}>{displayStatus}</p>
              <div className={cn('w-full h-2 rounded-full overflow-hidden mb-2', isDarkMode ? 'bg-slate-800' : 'bg-slate-200')}>
                <motion.div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${displayProgress}%` }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.5 }} />
              </div>
              <p className="text-[10px] font-bold font-mono text-emerald-500">{displayProgress}% Complete</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center mb-8">
                <BrandBlock isDarkMode={isDarkMode} size="lg" />
              </div>

              <div className="space-y-5">
                <div className="text-center space-y-1.5">
                  <h2 className="text-xl font-bold">Welcome Back</h2>
                  <p className={cn('text-sm', isDarkMode ? 'text-slate-400' : 'text-slate-500')}>
                    Sign in with your Microsoft account to access the Energy Intelligence system.
                  </p>
                </div>

                <button onClick={() => login()}
                  className="w-full bg-[#00a4ef] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#00a4ef]/25 hover:bg-[#008ad3] transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]">
                  <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#f3f3f3" d="M0 0h11v11H0z" /><path fill="#f3f3f3" d="M12 0h11v11H12z" />
                    <path fill="#f3f3f3" d="M0 12h11v11H0z" /><path fill="#f3f3f3" d="M12 12h11v11H12z" />
                  </svg>
                  Login with Microsoft
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className={cn('w-full border-t', isDarkMode ? 'border-white/10' : 'border-slate-200')} />
                  </div>
                  <div className="relative flex justify-center">
                    <span className={cn('px-3 text-[10px] uppercase tracking-widest font-bold opacity-40',
                      isDarkMode ? 'bg-slate-900/90' : 'bg-white/90')}>
                      Secure Enterprise Access
                    </span>
                  </div>
                </div>

                <p className={cn('text-[10px] text-center leading-relaxed', isDarkMode ? 'text-slate-500' : 'text-slate-400')}>
                  By signing in, you agree to our Terms of Service and Privacy Policy.
                  Access is restricted to authorized personnel only.
                </p>

                <div className="flex justify-center">
                  <button onClick={() => bypassLogin()}
                    className={cn('text-[10px] uppercase tracking-widest font-bold opacity-20 hover:opacity-70 transition-opacity', isDarkMode ? 'text-white' : 'text-slate-900')}>
                    [ Developer Bypass ]
                  </button>
                </div>
              </div>

              <div className={cn('mt-6 pt-5 border-t text-center', isDarkMode ? 'border-white/5' : 'border-slate-100')}>
                <p className={cn('text-[10px]', isDarkMode ? 'opacity-20' : 'text-slate-400')}>
                  © 2026 WattsUp Energy Intelligence. All rights reserved.
                </p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
