'use client';
import React from 'react';
import { ShieldX } from 'lucide-react';

interface AccessDeniedPageProps {
  onBack?: () => void;
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-8 text-center">
      <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mb-8 border border-rose-500/20">
        <ShieldX className="w-10 h-10 text-rose-500" />
      </div>
      <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
      <p className="opacity-70 max-w-md mb-8">
        You don't have permission to access this page. Contact your administrator if you believe this is an error.
      </p>
      {onBack && (
        <button
          onClick={onBack}
          className="bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-emerald-600 transition-all"
        >
          Go Back
        </button>
      )}
    </div>
  );
};
