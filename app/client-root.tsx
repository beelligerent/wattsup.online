'use client';

import dynamic from 'next/dynamic';

// Dynamically import the full SPA with ssr:false
// This MUST be in a 'use client' file — not in a Server Component
const ClientApp = dynamic(() => import('../src/ClientApp'), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#020817',
    }}>
      <div style={{
        width: 48,
        height: 48,
        border: '4px solid rgba(16,185,129,0.2)',
        borderTop: '4px solid #10b981',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
});

export default function ClientRoot() {
  return <ClientApp />;
}
