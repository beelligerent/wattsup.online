'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import { msalInstance } from './auth/msalConfig';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { DataProvider, useData } from './DataContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { KPISection } from './components/KPISection';
import { ChartsSection } from './components/ChartsSection';
import { Filters } from './components/Filters';
import { CSVUpload } from './components/CSVUpload';
import { EquipmentTable } from './components/EquipmentTable';
import { EquipmentAnalytics } from './components/EquipmentAnalytics';
import { BaselineCalculatorPage } from './components/BaselineCalculatorPage';
import { CostAnalyticsPage } from './components/CostAnalyticsPage';
import { ReportsPage } from './components/ReportsPage';
import { AIAnalyst } from './components/AIAnalyst';
import { LoginPage } from './page-views/LoginPage';
import { UserManagementPage } from './page-views/UserManagementPage';
import { SettingsPage } from './page-views/SettingsPage';
import { EnergyUserPage } from './components/EnergyUserPage';
import { PreloadOverlay } from './components/PreloadOverlay';
import { PreloadService } from './services/PreloadService';
import { useStore } from './store/useStore';
import { CostRules } from './types';
import { CostService } from './services/CostService';
import { CosmosService } from './services/CosmosService';
import { cn } from './utils/cn';

// ─────────────────────────────────────────────────────────────────────────────
// MainApp — rendered only when user is authenticated and data is loaded
// ─────────────────────────────────────────────────────────────────────────────
const MainApp = ({
  activeTab, setActiveTab,
  isDarkMode, toggleDarkMode,
  selectedEquipments, setSelectedEquipments,
  showBaselineCalculator, setShowBaselineCalculator,
  costRules, setCostRules,
  dashboardRef,
  baselineProcessing, setBaselineProcessing,
  baselineProgress, setBaselineProgress,
  baselineStatus, setBaselineStatus,
  baselineCommitted, setBaselineCommitted,
  baselineMinimized, setBaselineMinimized,
  baselineEquipmentCount, setBaselineEquipmentCount,
}: any) => {
  const { hasPermission } = useAuth();
  const {
    readings, filteredReadings, stats, filters, setFilters,
    setReadings, allAreas, allEquipment, allEquipmentObjects,
    refreshData, isLoading,
  } = useData();

  const renderContent = () => {
    if (activeTab === 'database') {
      if (!hasPermission('manage_data')) { setActiveTab('dashboard'); return null; }
      return (
        <div className="w-full py-12">
          <CSVUpload
            isDarkMode={isDarkMode}
            onGoToDashboard={() => setActiveTab('dashboard')}
            onRefresh={async () => { await refreshData(); }}
            onDataLoaded={async (data: any, metadata: any) => { await setReadings(data, metadata); }}
          />
        </div>
      );
    }
    if (activeTab === 'cost-analytics') {
      if (!hasPermission('view_cost_analytics')) { setActiveTab('dashboard'); return null; }
      return (
        <CostAnalyticsPage
          isDarkMode={isDarkMode} costRules={costRules} setCostRules={setCostRules}
          readings={readings} filteredReadings={filteredReadings} stats={stats}
          filters={filters} setFilters={setFilters} isLoading={isLoading}
        />
      );
    }
    if (activeTab === 'ai-analyst') {
      if (!hasPermission('view_ai_analyst')) { setActiveTab('dashboard'); return null; }
      return <AIAnalyst readings={readings} summaries={stats.allEquipment} isDarkMode={isDarkMode} />;
    }
    if (activeTab === 'users') {
      if (!hasPermission('manage_users') && !hasPermission('view_audit_logs')) { setActiveTab('dashboard'); return null; }
      return <UserManagementPage isDarkMode={isDarkMode} />;
    }
    if (activeTab === 'energy-user') {
      if (!hasPermission('view_energy_user')) { setActiveTab('dashboard'); return null; }
      return (
        <EnergyUserPage isDarkMode={isDarkMode} readings={readings}
          allEquipment={allEquipment} allAreas={allAreas} refreshData={refreshData} isLoading={isLoading}
        />
      );
    }
    if (activeTab === 'reports') {
      if (!hasPermission('view_reports')) { setActiveTab('dashboard'); return null; }
      return (
        <ReportsPage
          isDarkMode={isDarkMode} costRules={costRules} readings={readings}
          filteredReadings={filteredReadings} stats={stats} allEquipment={allEquipment}
          allAreas={allAreas} allEquipmentObjects={allEquipmentObjects}
          isLoading={isLoading} refreshData={refreshData} setFilters={setFilters}
        />
      );
    }
    if (activeTab === 'settings') {
      return (
        <SettingsPage isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode}
          costRate={costRules.energyPrice}
          setCostRate={(rate: number) => setCostRules((p: CostRules) => ({ ...p, energyPrice: rate }))}
        />
      );
    }
    if (activeTab === 'analytics') {
      if (!hasPermission('view_analytics')) { setActiveTab('dashboard'); return null; }
      if (showBaselineCalculator) {
        return (
          <div className="flex-1 flex flex-col min-h-0">
            <BaselineCalculatorPage
              readings={readings} allEquipment={allEquipment} isDarkMode={isDarkMode}
              filters={filters} setFilters={setFilters}
              onBack={() => setShowBaselineCalculator(false)} refreshData={refreshData}
              externalProcessing={baselineProcessing}
              setExternalProcessing={setBaselineProcessing}
              setExternalProgress={setBaselineProgress}
              setExternalStatus={setBaselineStatus}
              setExternalCommitted={setBaselineCommitted}
              setExternalMinimized={setBaselineMinimized}
              setExternalEquipmentCount={setBaselineEquipmentCount}
            />
          </div>
        );
      }
      if (selectedEquipments?.length > 0) {
        const summaries = stats.allEquipment.filter((e: any) => selectedEquipments.includes(e.name));
        if (!summaries.length) return null;
        return (
          <EquipmentAnalytics
            equipmentNames={selectedEquipments} readings={filteredReadings} summaries={summaries}
            isDarkMode={isDarkMode} filters={filters} setFilters={setFilters}
            onBack={() => setSelectedEquipments(null)} isLoading={isLoading}
          />
        );
      }
      return (
        <div className="flex-1 flex flex-col min-h-0">
          <EquipmentTable
            equipment={stats.allEquipment}
            onSelect={(name: string) => setSelectedEquipments([name])}
            onCompare={(names: string[]) => setSelectedEquipments(names)}
            onOpenBaselineCalculator={() => setShowBaselineCalculator(true)}
            isDarkMode={isDarkMode} filters={filters} setFilters={setFilters}
            costRules={costRules} isLoading={isLoading}
          />
        </div>
      );
    }
    // Dashboard
    return (
      <div className="space-y-4" ref={dashboardRef} id="dashboard-report">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-bold tracking-tight">WattsUp Malita</h2>
          <div className="flex items-center gap-3">
            <Filters isDarkMode={isDarkMode} showExport={true} />
            <div className={cn('flex items-center gap-2 p-2 rounded-2xl border',
              isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white shadow-sm')}>
              <span className="text-xs font-bold px-2 opacity-60">Energy Rate:</span>
              <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border',
                isDarkMode ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200')}>
                <span className="text-xs opacity-50">₱</span>
                <input type="number" value={costRules.energyPrice || 0}
                  onChange={(e) => setCostRules((p: CostRules) => ({ ...p, energyPrice: Number(e.target.value) }))}
                  className="w-14 bg-transparent outline-none text-sm font-bold" />
                <span className="text-[10px] opacity-50">/kWh</span>
              </div>
            </div>
          </div>
        </div>
        <KPISection stats={stats} costRules={costRules} isDarkMode={isDarkMode} isLoading={isLoading} />
        <ChartsSection
          key={`charts-${filteredReadings.length}-${stats.totalPlantKWh}`}
          readings={filteredReadings} stats={stats} isDarkMode={isDarkMode}
          costRate={costRules.energyPrice} isLoading={isLoading}
        />
      </div>
    );
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode}>
      {renderContent()}
    </Layout>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AppShell — auth-aware shell, rendered only after MSAL is initialized
// ─────────────────────────────────────────────────────────────────────────────
const AppShell = () => {
  const { user, loading, profile } = useAuth();
  const dashboardRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedEquipments, setSelectedEquipments] = useState<string[] | null>(null);
  const [showBaselineCalculator, setShowBaselineCalculator] = useState(false);
  const [costRules, setCostRules] = useState<CostRules>({
    energyPrice: 4.5, demandCharge: 0, systemLoss: 5.2, vat: 12, monthlyBudget: 500000,
  });
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadStatus, setPreloadStatus] = useState('');
  const isLoaded = useStore(state => state.isLoaded);

  // ── Global baseline progress state — persists across tab navigation ──
  const [baselineProcessing, setBaselineProcessing] = useState(false);
  const [baselineProgress, setBaselineProgress] = useState(0);
  const [baselineStatus, setBaselineStatus] = useState('');
  const [baselineCommitted, setBaselineCommitted] = useState(false);
  const [baselineMinimized, setBaselineMinimized] = useState(false);
  const [baselineEquipmentCount, setBaselineEquipmentCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    setIsDarkMode(saved ? saved === 'dark' : true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => setIsDarkMode(p => !p), []);

  useEffect(() => {
    const userId = user?.localAccountId || user?.homeAccountId
      || (user as any)?.uid || useStore.getState().userProfile?.uid;
    if (user && userId && !isLoaded && !isPreloading) {
      setIsPreloading(true);
      PreloadService.preload(userId, (progress, status) => {
        setPreloadProgress(progress);
        setPreloadStatus(status);
        if (progress === 100) setTimeout(() => setIsPreloading(false), 500);
      });
    }
  }, [user, isLoaded, isPreloading]);

  useEffect(() => {
    if (!user) return;
    const unsub = CostService.subscribeToCostRules(rules => setCostRules(rules));
    return () => unsub();
  }, [user]);

  // Prevent hydration mismatch
  if (!mounted) return null;
  // Show login when not authenticated
  if (!loading && !user) return <LoginPage />;
  if (!loading && user && profile && !profile.approved) return <LoginPage />;

  return (
    <>
      <PreloadOverlay isVisible={isPreloading || loading} progress={preloadProgress}
        status={preloadStatus} isDarkMode={isDarkMode} />
      {!isPreloading && !loading && user && profile?.approved && (
        <MainApp
          dashboardRef={dashboardRef} activeTab={activeTab} setActiveTab={setActiveTab}
          isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode}
          selectedEquipments={selectedEquipments} setSelectedEquipments={setSelectedEquipments}
          showBaselineCalculator={showBaselineCalculator} setShowBaselineCalculator={setShowBaselineCalculator}
          costRules={costRules} setCostRules={setCostRules}
          baselineProcessing={baselineProcessing} setBaselineProcessing={setBaselineProcessing}
          baselineProgress={baselineProgress} setBaselineProgress={setBaselineProgress}
          baselineStatus={baselineStatus} setBaselineStatus={setBaselineStatus}
          baselineCommitted={baselineCommitted} setBaselineCommitted={setBaselineCommitted}
          baselineMinimized={baselineMinimized} setBaselineMinimized={setBaselineMinimized}
          baselineEquipmentCount={baselineEquipmentCount} setBaselineEquipmentCount={setBaselineEquipmentCount}
        />
      )}

      {/* ── Global Baseline Progress Widget — always visible across all tabs ── */}
      {(baselineProcessing || baselineCommitted) && (
        <div className={cn(
          'fixed z-[9000] border shadow-2xl overflow-hidden backdrop-blur-xl transition-all duration-300',
          baselineMinimized ? 'bottom-6 right-6 w-72 rounded-2xl' : 'bottom-6 right-6 w-80 rounded-2xl',
          isDarkMode ? 'bg-slate-900/95 border-white/10' : 'bg-white/95 border-slate-200'
        )}>
          {/* Header */}
          <div className={cn('flex items-center justify-between px-4 py-3 border-b', isDarkMode ? 'border-white/5' : 'border-slate-100')}>
            <div className="flex items-center gap-2">
              {baselineCommitted
                ? <span className="text-emerald-500 text-lg">✓</span>
                : <svg className="w-4 h-4 text-emerald-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              }
              <span className="text-xs font-bold">
                {baselineCommitted ? '✅ Baseline Applied!' : `Applying Baseline… ${baselineProgress}%`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {!baselineCommitted && (
                <button onClick={() => setBaselineMinimized(p => !p)}
                  className={cn('p-1 rounded-lg text-[10px] transition-colors', isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100')}>
                  {baselineMinimized ? '⤢' : '⤡'}
                </button>
              )}
              {baselineCommitted && (
                <button onClick={() => { setBaselineCommitted(false); setBaselineProcessing(false); setBaselineProgress(0); setBaselineStatus(''); }}
                  className={cn('p-1 rounded-lg text-[10px] transition-colors', isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100')}>
                  ✕
                </button>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-black/5 dark:bg-white/5">
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${baselineCommitted ? 100 : baselineProgress}%` }} />
          </div>
          {/* Body — only when not minimized */}
          {!baselineMinimized && (
            <div className="px-4 py-3">
              {baselineCommitted ? (
                <p className="text-xs opacity-60">Baselines saved for {baselineEquipmentCount} equipment items. Dashboard data refreshed.</p>
              ) : (
                <>
                  <p className="text-[11px] opacity-50 mb-1 truncate">{baselineStatus}</p>
                  <button onClick={() => setBaselineMinimized(true)} className="text-[10px] text-emerald-500 hover:underline">Minimize — keep working</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MsalInitializer — awaits msalInstance.initialize() before rendering children.
// This is REQUIRED in @azure/msal-react v5+ — MsalProvider does NOT auto-initialize.
// Calling handleRedirectPromise() before initialize() causes:
//   BrowserAuthError: uninitialized_public_client_application
// ─────────────────────────────────────────────────────────────────────────────
const MsalInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const initStarted = useRef(false);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    msalInstance.initialize()
      .then(() => {
        // Set active account from cache if available
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
          msalInstance.setActiveAccount(accounts[0]);
        }
        // Track login success events
        msalInstance.addEventCallback((event) => {
          if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
            const account = (event.payload as any).account;
            if (account) msalInstance.setActiveAccount(account);
          }
        });
        setInitialized(true);
      })
      .catch((err: any) => {
        console.error('[MSAL] Initialization failed:', err);
        setInitError(err?.message || 'MSAL initialization failed');
      });
  }, []);

  if (initError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020817', color: 'white', padding: 32, flexDirection: 'column', textAlign: 'center' }}>
        <h1 style={{ color: '#ef4444', fontSize: 24, marginBottom: 16 }}>Authentication Error</h1>
        <p style={{ opacity: 0.7, marginBottom: 16, maxWidth: 480 }}>{initError}</p>
        <button
          onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }}
          style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Clear Cache &amp; Retry
        </button>
      </div>
    );
  }

  if (!initialized) {
    // Show spinner while MSAL initializes (typically < 100ms)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020817' }}>
        <div style={{ width: 40, height: 40, border: '4px solid rgba(16,185,129,0.2)', borderTop: '4px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Root export — entry point loaded via dynamic import with ssr:false
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientApp() {
  return (
    <ErrorBoundary>
      <MsalInitializer>
        <MsalProvider instance={msalInstance}>
          <AuthProvider>
            <DataProvider>
              <AppShell />
            </DataProvider>
          </AuthProvider>
        </MsalProvider>
      </MsalInitializer>
    </ErrorBoundary>
  );
}
