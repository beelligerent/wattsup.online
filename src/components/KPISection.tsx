'use client';
import React, { useMemo } from 'react';
import { Zap, Activity, AlertTriangle, TrendingUp, Package, Leaf, BarChart3, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';
import { DashboardStats, CostRules } from '../types';
import { calculateDetailedCost } from '../utils/EnergyCalculator';
import { useAuth } from '../auth/AuthContext';
import { useData } from '../DataContext';

interface KPISectionProps {
  stats: DashboardStats;
  costRules: CostRules;
  isDarkMode: boolean;
  isLoading?: boolean;
}

// These match EXACTLY the colors used in ChartsSection's COLORS array
// so area KPI cards match the legend in System Distribution chart
const AREA_COLORS = [
  { bg: '#10b981', text: '#fff', light: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' },  // emerald
  { bg: '#3b82f6', text: '#fff', light: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)' },  // blue
  { bg: '#f59e0b', text: '#fff', light: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  }, // amber
  { bg: '#ef4444', text: '#fff', light: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'   }, // red
  { bg: '#8b5cf6', text: '#fff', light: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)'  }, // violet
  { bg: '#ec4899', text: '#fff', light: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.3)'  }, // pink
  { bg: '#06b6d4', text: '#fff', light: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.3)'   }, // cyan
  { bg: '#f97316', text: '#fff', light: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)'  }, // orange
];

// ── Area KPI card with colored accent matching chart legend ───────────────
const AreaKPICard: React.FC<{
  kpi: any;
  color: typeof AREA_COLORS[0];
  isDarkMode: boolean;
  isLoading?: boolean;
  hasInitialLoad: boolean;
  index: number;
}> = ({ kpi, color, isDarkMode, isLoading, hasInitialLoad, index }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.92 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.04, type: 'spring', stiffness: 400, damping: 30 }}
    className="p-3 sm:p-4 rounded-2xl border transition-colors duration-200 flex flex-col justify-between h-full relative overflow-hidden"
    style={{
      backgroundColor: isDarkMode ? `rgba(17,28,46,1)` : 'transparent',
      borderColor: color.border,
    }}
  >
    {/* Colored top accent bar */}
    <div
      className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
      style={{ backgroundColor: color.bg }}
    />

    <div className="flex items-center justify-between mb-2 mt-1">
      {/* Colored dot matching chart legend */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color.bg }} />
        <span
          className="text-[9px] font-black uppercase tracking-widest"
          style={{ color: color.bg }}
        >
          Avg Load
        </span>
      </div>
      <div
        className="p-1.5 rounded-lg"
        style={{ backgroundColor: `${color.bg}22` }}
      >
        <Zap className="w-3.5 h-3.5" style={{ color: color.bg }} />
      </div>
    </div>

    <h3 className="text-[10px] font-medium opacity-50 mb-0.5 uppercase tracking-wider truncate">
      {kpi.label}
    </h3>

    <div className="mt-1">
      {isLoading && !hasInitialLoad ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin opacity-50" />
          <p className="text-xs font-bold opacity-50">Loading</p>
        </div>
      ) : (
        <p
          className="text-lg font-bold tracking-tight truncate"
          title={String(kpi.value)}
          style={{ color: isDarkMode ? '#e6edf7' : '#0f172a' }}
        >
          {kpi.value}
        </p>
      )}
    </div>
  </motion.div>
);

// ── General KPI card ──────────────────────────────────────────────────────
const KPICard: React.FC<{
  kpi: any;
  isDarkMode: boolean;
  isLoading?: boolean;
  hasInitialLoad: boolean;
  index: number;
}> = ({ kpi, isDarkMode, isLoading, hasInitialLoad, index }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.92 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.04, type: 'spring', stiffness: 400, damping: 30 }}
    className={cn(
      "p-3 sm:p-4 rounded-2xl border transition-colors duration-200 flex flex-col justify-between h-full",
      isDarkMode
        ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]"
        : "bg-[var(--color-card-bg-light)] border-[var(--color-border-light)] shadow-sm"
    )}
  >
    <div className="flex items-center justify-between mb-2">
      <div className={cn("p-1.5 rounded-lg", kpi.bg)}>
        <kpi.icon className={cn("w-4 h-4", kpi.color)} />
      </div>
      <span className={cn(
        "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
        isDarkMode ? "bg-white/5 text-white/40" : "bg-slate-100 text-slate-500"
      )}>
        {kpi.trend}
      </span>
    </div>
    <h3 className="text-[10px] font-medium opacity-50 mb-0.5 uppercase tracking-wider truncate">{kpi.label}</h3>
    <div className="mt-1">
      {isLoading && !hasInitialLoad ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin opacity-50" />
          <p className="text-xs font-bold opacity-50">Loading</p>
        </div>
      ) : (
        <p className="text-lg font-bold tracking-tight truncate" title={String(kpi.value)}>{kpi.value}</p>
      )}
    </div>
  </motion.div>
);

// ── KPISection ────────────────────────────────────────────────────────────
export const KPISection: React.FC<KPISectionProps> = ({ stats, costRules, isDarkMode, isLoading }) => {
  const { hasPermission } = useAuth();
  const { hasInitialLoad } = useData();

  const costDetails = useMemo(() =>
    calculateDetailedCost(stats.totalPlantKWh, stats.maxDemand, costRules),
    [stats.totalPlantKWh, stats.maxDemand, costRules]
  );

  const totalCostImpact = useMemo(() => {
    return stats.allEquipment.reduce((sum, eq) => {
      if (eq.computedBaseline) {
        const impact = (eq.computedBaseline - eq.avgLoad) * 24 * stats.daysInPeriod * costRules.energyPrice;
        return sum + impact;
      }
      return sum;
    }, 0);
  }, [stats.allEquipment, stats.daysInPeriod, costRules.energyPrice]);

  // Row 1 — per-area KPIs colored to match chart legend
  const areaKPIs = useMemo(() => {
    // Sort alphabetically — MUST match ChartsSection's allAreas.sort() so colors align
    const sorted = [...stats.areaBreakdown].sort((a, b) => a.area.localeCompare(b.area));
    return sorted.map((area, i) => ({
      id: `area-${area.area}`,
      label: `${area.area} Load`,
      value: `${area.totalKW.toLocaleString(undefined, { maximumFractionDigits: 1 })} kW`,
      colorIdx: i,
    }));
  }, [stats.areaBreakdown]);

  // Row 2 — general KPIs
  const generalKPIs = useMemo(() => ([
    {
      id: 'energy-intensity',
      label: 'Energy Intensity',
      value: `${stats.energyIntensity.toFixed(2)} kWh/MW`,
      icon: BarChart3,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      trend: 'Efficiency KPI',
    },
    {
      id: 'carbon-footprint',
      label: 'Carbon Footprint',
      value: `${stats.totalCarbonEmission.toFixed(2)} Tons`,
      icon: Leaf,
      color: 'text-teal-500',
      bg: 'bg-teal-500/10',
      trend: 'CO₂ Emission',
    },
    {
      id: 'anomalies',
      label: 'Anomalies',
      value: stats.anomalyCount,
      icon: AlertTriangle,
      color: stats.anomalyCount > 0 ? 'text-rose-500' : 'text-emerald-500',
      bg: stats.anomalyCount > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10',
      trend: 'Critical Alerts',
    },
    hasPermission('view_cost_analytics') && {
      id: 'estimated-cost',
      label: 'Estimated Cost',
      value: `₱${costDetails.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: Activity,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      trend: `₱${costDetails.avgCostPerKWh.toFixed(2)}/kWh`,
    },
    hasPermission('view_cost_analytics') && {
      id: 'potential-savings',
      label: 'Potential Savings',
      value: `₱${totalCostImpact.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: TrendingUp,
      color: totalCostImpact >= 0 ? 'text-emerald-500' : 'text-rose-500',
      bg: totalCostImpact >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10',
      trend: totalCostImpact >= 0 ? 'Savings' : 'Loss',
    },
    {
      id: 'monitored-equipment',
      label: 'Monitored Equipment',
      value: stats.totalEquipmentCount,
      icon: Package,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      trend: 'Inventory',
    },
  ] as any[]).filter(Boolean), [stats, costDetails, totalCostImpact, hasPermission]);

  return (
    <div className="space-y-3 mb-4">
      {/* Row 1 — Per-area consumption with matching chart colors */}
      {areaKPIs.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(areaKPIs.length, 8)}, minmax(0, 1fr))` }}
        >
          <AnimatePresence mode="popLayout">
            {areaKPIs.map((kpi, i) => (
              <AreaKPICard
                key={kpi.id}
                kpi={kpi}
                color={AREA_COLORS[kpi.colorIdx % AREA_COLORS.length]}
                isDarkMode={isDarkMode}
                isLoading={isLoading}
                hasInitialLoad={hasInitialLoad}
                index={i}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Row 2 — General KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <AnimatePresence mode="popLayout">
          {generalKPIs.map((kpi, i) => (
            <KPICard key={kpi.id} kpi={kpi} isDarkMode={isDarkMode} isLoading={isLoading} hasInitialLoad={hasInitialLoad} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
