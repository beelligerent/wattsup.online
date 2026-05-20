'use client';
import React, { useState, useMemo, useEffect } from 'react';

import { cn } from '../utils/cn';
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { KPISection } from './KPISection';
import { ChartsSection } from './ChartsSection';
import { Filters } from './Filters';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useAuth } from '../auth/AuthContext';

import { CostKPIs, CostRules, CostDistributionItem, EquipmentSummary, MeterReading, DashboardStats, FilterState } from '../types';
import { Wallet, Link, TrendingUp, BarChart3, Sliders, Clock, CheckCircle2, Zap, Download, Save, Loader2, Calendar } from 'lucide-react';
import { useData } from '../DataContext';
import { motion, AnimatePresence } from 'motion/react';
import { ReportButton } from './ReportButton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CostService } from '../services/CostService';
import { DataService } from '../services/DataService';

import { calculateDetailedCost } from '../utils/EnergyCalculator';

interface CostAnalyticsPageProps {
  isDarkMode: boolean;
  costRules: CostRules;
  setCostRules: React.Dispatch<React.SetStateAction<CostRules>>;
  readings: MeterReading[];
  filteredReadings: MeterReading[];
  stats: DashboardStats;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  isLoading?: boolean;
}

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', 
  '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#84cc16', '#f43f5e',
  '#0ea5e9', '#d946ef', '#facc15', '#22c55e', '#a855f7', '#fb923c'
];

export const CostAnalyticsPage: React.FC<CostAnalyticsPageProps> = ({ 
  isDarkMode, 
  costRules, 
  setCostRules,
  readings,
  filteredReadings,
  stats,
  filters,
  setFilters,
  isLoading = false
}) => {
  const { appliedDateFilter, hasInitialLoad } = useData();
  const pageRef = React.useRef<HTMLDivElement>(null);
  const { hasPermission } = useAuth();
  if (!hasPermission('view_cost_analytics')) return null;

  const startDate = appliedDateFilter.startDate;
  const endDate = appliedDateFilter.endDate;
  const [selectedTopCount, setSelectedTopCount] = useState<'5' | '10' | '15' | 'all'>('10');
  const [targetReduction, setTargetReduction] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { profile } = useAuth();

  const calculateCostKPIs = useMemo(() => {
    if (filteredReadings.length === 0) {
      return {
        totalEnergyCost: 0,
        costPerKwh: 0,
        peakDemandCost: 0,
        projectedMonthlyTotal: 0,
        totalKwh: 0,
        totalEnergyCostComparison: 0,
      };
    }

    const totalKwh = stats.totalPlantKWh;
    const costDetails = calculateDetailedCost(totalKwh, stats.maxDemand, costRules);

    // Simple projection: current month's cost extrapolated for a full month
    const daysInPeriod = (parseISO(endDate).getTime() - parseISO(startDate).getTime()) / (1000 * 60 * 60 * 24);
    const projectedMonthlyTotal = daysInPeriod > 0 ? (costDetails.totalCost / daysInPeriod) * 30 : costDetails.totalCost;

    return {
      totalEnergyCost: costDetails.totalCost,
      costPerKwh: costDetails.avgCostPerKWh,
      peakDemandCost: costDetails.peakDemandCharge,
      projectedMonthlyTotal: projectedMonthlyTotal,
      totalKwh: totalKwh,
      totalEnergyCostComparison: 5.2, // Example value
    };
  }, [readings, startDate, endDate, costRules, stats.maxDemand]);

  const calculateCostDistribution = useMemo(() => {
    if (stats.allEquipment.length === 0 || filteredReadings.length === 0) {
      return [];
    }

    const equipmentCosts = stats.allEquipment.map(eq => {
      const costDetails = calculateDetailedCost(eq.totalKWh, 0, costRules);
      return {
        name: eq.name,
        value: costDetails.totalCost,
      };
    }).sort((a, b) => b.value - a.value);

    const totalCost = equipmentCosts.reduce((sum, item) => sum + item.value, 0);

    if (totalCost === 0) {
      return [];
    }

    const topFiltered = selectedTopCount === 'all' 
      ? equipmentCosts 
      : equipmentCosts.slice(0, Number(selectedTopCount));

    return topFiltered.map(item => ({
      ...item,
      percentage: (item.value / totalCost) * 100,
    }));
  }, [stats.allEquipment, costRules, selectedTopCount]);

  const projectedMonthlySavings = useMemo(() => {
    const currentProjected = calculateCostKPIs.projectedMonthlyTotal;
    return currentProjected * (targetReduction / 100);
  }, [calculateCostKPIs.projectedMonthlyTotal, targetReduction]);

  const totalCostImpact = useMemo(() => {
    return stats.allEquipment.reduce((sum, eq) => {
      if (eq.computedBaseline) {
        const impact = (eq.computedBaseline - eq.avgLoad) * 24 * stats.daysInPeriod * costRules.energyPrice;
        return sum + impact;
      }
      return sum;
    }, 0);
  }, [stats.allEquipment, stats.daysInPeriod, costRules.energyPrice]);

  const handleExport = (format: 'csv' | 'xlsx') => {
    const dataToExport = filteredReadings.map(r => ({
      Timestamp: r.timestamp,
      Equipment: r.equipmentName,
      Area: r.area,
      'Load (kW)': r.actualKW,
      'Consumption (kWh)': r.kwh,
      'Cost (₱)': r.kwh * calculateCostKPIs.costPerKwh
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cost Data');

    if (format === 'xlsx') {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `WattsUp_Cost_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws);
      saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `WattsUp_Cost_Export_${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const formatCurrency = (value: number) => {
    return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={cn(
          "p-3 rounded-lg shadow-lg border text-sm",
          isDarkMode ? "bg-black/70 border-white/10 text-white" : "bg-white/90 border-slate-200 text-gray-900"
        )}>
          <p className="font-bold">{payload[0].name}</p>
          <p>Cost: {formatCurrency(payload[0].value)}</p>
          <p>Contribution: {formatPercentage(payload[0].payload.percentage)}</p>
        </div>
      );
    }
    return null;
  };

  const handleSaveRules = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await CostService.saveCostRules(costRules);
      
      // Log Cost Rules Update
      try {
        await DataService.addAuditLog(
          'Cost Rules Update',
          `Updated energy cost rules. Price: ${costRules.energyPrice} PHP/kWh, Budget: ${costRules.monthlyBudget} PHP`
        );
      } catch (logError) {
        console.error('Failed to log cost rules update:', logError);
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save cost rules:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12" ref={pageRef} id="cost-analytics-report">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight uppercase">Cost Analytics</h2>
            </div>
            <p className="text-[10px] opacity-50 font-medium mt-1 uppercase tracking-wider">WattsUp Monitoring System</p>
          </div>
          <div className="flex items-center gap-3">
            <Filters isDarkMode={isDarkMode} showExport={false} />
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 opacity-40" />
              <span className="text-xs font-bold">
                {format(parseISO(startDate), 'MMM dd, yyyy')} - {format(parseISO(endDate), 'MMM dd, yyyy')}
              </span>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isLoading && !hasInitialLoad ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[600px] flex flex-col items-center justify-center space-y-4"
            >
              <div className="w-12 h-12 border-4 border-[var(--color-primary-accent)]/20 border-t-[var(--color-primary-accent)] rounded-full animate-spin" />
              <p className="text-sm font-bold opacity-50">Calculating Financial Impact...</p>
            </motion.div>
          ) : filteredReadings.length === 0 && hasInitialLoad ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "h-[500px] flex flex-col items-center justify-center space-y-6 rounded-3xl border border-dashed",
                isDarkMode ? "bg-slate-900/30 border-white/10" : "bg-slate-50/50 border-slate-200"
              )}
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Wallet className="w-10 h-10 text-emerald-500 opacity-50" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold">No Cost Data Available</h3>
                <p className="text-sm opacity-50 max-w-xs mx-auto">
                  No energy readings found for the selected date range. Please adjust your filters to see cost analytics.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className={cn(
            "rounded-2xl p-5 space-y-2 flex flex-col justify-center relative overflow-hidden",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-100 shadow-sm"
          )}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-6 -mt-6" />
            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" />
              POTENTIAL SAVINGS
            </div>
            <p className={cn("text-xl sm:text-2xl font-bold tracking-tight", totalCostImpact >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {formatCurrency(Math.abs(totalCostImpact))}
            </p>
            <p className="text-[10px] opacity-50">{totalCostImpact >= 0 ? 'Total Savings' : 'Total Loss'}</p>
          </div>

          <div className={cn(
            "rounded-2xl p-5 space-y-2 flex flex-col justify-center relative overflow-hidden",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-100 shadow-sm"
          )}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-6 -mt-6" />
            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider">
              <Wallet className="w-3.5 h-3.5" />
              EST. MONTHLY BILL
            </div>
            <p className="text-xl sm:text-2xl font-bold tracking-tight">{formatCurrency(calculateCostKPIs.projectedMonthlyTotal)}</p>
            <p className="text-[10px] opacity-50 flex items-center gap-1">
              {costRules.monthlyBudget > 0 ? formatPercentage((calculateCostKPIs.projectedMonthlyTotal / costRules.monthlyBudget) * 100) : '0.0%'} of Budget
            </p>
          </div>

          <div className={cn(
            "rounded-2xl p-5 space-y-2 flex flex-col justify-center relative overflow-hidden",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-100 shadow-sm"
          )}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-6 -mt-6" />
            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider">
              <Link className="w-3.5 h-3.5" />
              COST PER KWH
            </div>
            <p className="text-xl sm:text-2xl font-bold tracking-tight">{formatCurrency(calculateCostKPIs.costPerKwh)}</p>
            <p className="text-[10px] opacity-50">Including fixed charges</p>
          </div>

          <div className={cn(
            "rounded-2xl p-5 space-y-2 flex flex-col justify-center relative overflow-hidden",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-100 shadow-sm"
          )}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full -mr-6 -mt-6" />
            <div className="flex items-center gap-2 text-[10px] font-bold text-rose-500/70 uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" />
              DEMAND CHARGE
            </div>
            <p className="text-xl sm:text-2xl font-bold tracking-tight">{formatCurrency(calculateCostKPIs.peakDemandCost)}</p>
            <p className="text-[10px] opacity-50">Peak: {stats.maxDemand ? stats.maxDemand.toFixed(1) : '0.0'} kW</p>
          </div>

          <div className={cn(
            "rounded-2xl p-5 space-y-2 flex flex-col justify-center relative overflow-hidden",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-100 shadow-sm"
          )}>
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full -mr-6 -mt-6" />
            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500/70 uppercase tracking-wider">
              <BarChart3 className="w-3.5 h-3.5" />
              ENERGY CHARGE
            </div>
            <p className="text-xl sm:text-2xl font-bold tracking-tight">{formatCurrency(calculateCostKPIs.totalEnergyCost)}</p>
            <p className="text-[10px] opacity-50">{calculateCostKPIs.totalKwh ? calculateCostKPIs.totalKwh.toFixed(0) : '0'} kWh total</p>
          </div>
        </div>


        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1">
          {/* Cost Configuration Panel */}
          <div className={cn(
            "rounded-2xl p-6 space-y-6 flex flex-col",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-[var(--color-card-bg-light)] border-[var(--color-border-light)] shadow-sm"
          )}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Sliders className="w-5 h-5 opacity-50" />
                Tariff Rules
              </h3>
              <button
                onClick={handleSaveRules}
                disabled={isSaving}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  saveSuccess 
                    ? "bg-emerald-500 text-white" 
                    : "bg-[var(--color-primary-accent)] text-white hover:opacity-90 disabled:opacity-50"
                )}
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (saveSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />)}
                {isSaving ? 'Saving...' : (saveSuccess ? 'Saved!' : 'Save Configuration')}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold opacity-50 uppercase tracking-wider">Energy Rate (PHP/kWh)</label>
                <input
                  type="number"
                  value={costRules.energyPrice || 0}
                  onChange={(e) => setCostRules({ ...costRules, energyPrice: Number(e.target.value) })}
                  className={cn(
                    "w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs outline-none focus:border-[var(--color-primary-accent)] transition-colors",
                    isDarkMode ? "text-white" : "text-black"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold opacity-50 uppercase tracking-wider">Demand Charge (PHP/kW)</label>
                <input
                  type="number"
                  value={costRules.demandCharge || 0}
                  onChange={(e) => setCostRules({ ...costRules, demandCharge: Number(e.target.value) })}
                  className={cn(
                    "w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs outline-none focus:border-[var(--color-primary-accent)] transition-colors",
                    isDarkMode ? "text-white" : "text-black"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold opacity-50 uppercase tracking-wider">System Loss (%)</label>
                <input
                  type="number"
                  value={costRules.systemLoss || 0}
                  onChange={(e) => setCostRules({ ...costRules, systemLoss: Number(e.target.value) })}
                  className={cn(
                    "w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs outline-none focus:border-[var(--color-primary-accent)] transition-colors",
                    isDarkMode ? "text-white" : "text-black"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold opacity-50 uppercase tracking-wider">VAT (%)</label>
                <input
                  type="number"
                  value={costRules.vat || 0}
                  onChange={(e) => setCostRules({ ...costRules, vat: Number(e.target.value) })}
                  className={cn(
                    "w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs outline-none focus:border-[var(--color-primary-accent)] transition-colors",
                    isDarkMode ? "text-white" : "text-black"
                  )}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[9px] font-bold opacity-50 uppercase tracking-wider">Monthly Budget (PHP)</label>
                <input
                  type="number"
                  value={costRules.monthlyBudget || 0}
                  onChange={(e) => setCostRules({ ...costRules, monthlyBudget: Number(e.target.value) })}
                  className={cn(
                    "w-full bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-xs outline-none focus:border-[var(--color-primary-accent)] transition-colors",
                    isDarkMode ? "text-white" : "text-black"
                  )}
                />
              </div>
            </div>
          </div>

          {/* Cost Distribution */}
          <div className={cn(
            "rounded-2xl p-6 space-y-6 flex flex-col",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-[var(--color-card-bg-light)] border-[var(--color-border-light)] shadow-sm"
          )}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 opacity-50" />
                Cost Centers
              </h3>
              <div className="flex items-center gap-1.5 text-[9px] font-bold">
                {['5', '10', '15', 'all'].map(count => (
                  <button
                    key={count}
                    onClick={() => setSelectedTopCount(count as typeof selectedTopCount)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl transition-colors uppercase tracking-wider",
                      selectedTopCount === count
                        ? "bg-[var(--color-primary-accent)] text-white"
                        : (isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200")
                    )}
                  >
                    {count === 'all' ? 'All' : count}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-6 flex-1 min-h-[250px]">
              <div className="w-full lg:w-1/2 h-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={calculateCostDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {calculateCostDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full lg:w-1/2 space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin pr-2">
                {calculateCostDistribution.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <p className="opacity-70 truncate font-medium">{item.name}</p>
                    </div>
                    <p className="font-bold shrink-0">{formatCurrency(item.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Optimization Simulator */}
        <div className={cn(
          "rounded-2xl p-6 space-y-4 flex flex-col xl:flex-row xl:items-center justify-between transition-all duration-300",
          isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-900",
          "text-white shadow-xl shadow-emerald-500/20"
        )}>
          <div className="flex-1 space-y-3">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Impact Simulator
            </h3>
            <p className="opacity-70 text-xs">Visualize potential financial gains by optimizing your energy strategy.</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-bold opacity-50 uppercase tracking-wider">Target Reduction</label>
                <span className="text-lg font-bold text-amber-400">{targetReduction}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={targetReduction}
                onChange={(e) => setTargetReduction(Number(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
          </div>
          <div className="xl:w-1/3 p-6 bg-white/5 border border-white/10 rounded-2xl space-y-1 text-right xl:ml-6" >
            <p className="text-[9px] opacity-70 font-bold tracking-widest">PROJECTED MONTHLY SAVINGS</p>
            <p className="text-3xl font-bold text-amber-400">{formatCurrency(projectedMonthlySavings)}</p>
            <p className="text-[10px] opacity-50 flex items-center justify-end gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Validated Estimation
            </p>
          </div>
        </div>

      </motion.div>
      )}
    </AnimatePresence>
  </div>
);
};
