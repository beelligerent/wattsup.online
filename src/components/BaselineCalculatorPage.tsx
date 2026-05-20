'use client';
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ArrowLeft, CheckCircle2, Gauge, Info, Search, Filter, Loader2, Minimize2, Maximize2, X, Bell } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { MeterReading, FilterState } from '../types';
import { cn } from '../utils/cn';
import { DataService } from '../services/DataService';

interface BaselineCalculatorPageProps {
  readings: MeterReading[];
  allEquipment: string[];
  isDarkMode: boolean;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onBack: () => void;
  refreshData: (forceRefresh?: boolean) => Promise<void>;
  // External state props — lifted to AppShell so widget persists across tab navigation
  externalProcessing?: boolean;
  setExternalProcessing?: (v: boolean) => void;
  setExternalProgress?: (v: number) => void;
  setExternalStatus?: (v: string) => void;
  setExternalCommitted?: (v: boolean) => void;
  setExternalMinimized?: (v: boolean) => void;
  setExternalEquipmentCount?: (v: number) => void;
}

export const BaselineCalculatorPage: React.FC<BaselineCalculatorPageProps> = ({
  readings,
  allEquipment,
  isDarkMode,
  filters,
  setFilters,
  onBack,
  refreshData,
  setExternalProcessing,
  setExternalProgress,
  setExternalStatus,
  setExternalCommitted,
  setExternalMinimized,
  setExternalEquipmentCount,
}) => {
  const [localRange, setLocalRange] = useState<[Date | null, Date | null]>(filters.baselineRange);
  const [localFactor, setLocalFactor] = useState<number>(filters.baselineFactor);
  const [localDecimals, setLocalDecimals] = useState<number>(filters.baselineDecimals || 2);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(filters.baselineEquipment || allEquipment);
  const [search, setSearch] = useState('');
  const [isCommitted, setIsCommitted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitStatus, setCommitStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Fetch current baseline config on mount
  const fetchConfig = React.useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const data = await DataService.getBaselineConfig();
      setCurrentConfig(data);
    } catch (err) {
      console.error("Failed to fetch config:", err);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  React.useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Sync local state to global filters for live preview across app
  React.useEffect(() => {
    setFilters(prev => ({
      ...prev,
      baselineRange: localRange,
      baselineFactor: localFactor,
      baselineEquipment: selectedEquipment,
      baselineDecimals: localDecimals
    }));
  }, [localRange, localFactor, selectedEquipment, localDecimals, setFilters]);

  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    try { return format(date, 'yyyy-MM-dd'); } catch { return ''; }
  };

  const handleDateChange = (index: 0 | 1, value: string) => {
    const newDate = value ? new Date(value) : null;
    setLocalRange(prev => {
      const newRange = [...prev] as [Date | null, Date | null];
      newRange[index] = newDate;
      return newRange;
    });
  };

  const equipmentStats = useMemo(() => {
    const readingsByEquipment = new Map<string, MeterReading[]>();
    readings.forEach(r => {
      if (!readingsByEquipment.has(r.equipmentName)) {
        readingsByEquipment.set(r.equipmentName, []);
      }
      readingsByEquipment.get(r.equipmentName)!.push(r);
    });

    return allEquipment.map(name => {
      const equipReadings = readingsByEquipment.get(name) || [];
      const lastAppliedBaseline = equipReadings.length > 0 ? equipReadings[0].baselineKW : 0;
      const isSelected = selectedEquipment.includes(name);

      let baselineReadings = equipReadings;
      if (isSelected && localRange[0] && localRange[1]) {
        baselineReadings = equipReadings.filter(r => {
          const date = parseISO(r.timestamp);
          return isWithinInterval(date, { start: localRange[0]!, end: localRange[1]! });
        });
      }

      const nonZeroReadings = baselineReadings.filter(r => r.actualKW > 0);
      const liveAvgLoad = nonZeroReadings.length > 0
        ? nonZeroReadings.reduce((sum, r) => sum + r.actualKW, 0) / nonZeroReadings.length
        : 0;

      const p = Math.pow(10, localDecimals);
      const newBaseline = isSelected
        ? Math.round(liveAvgLoad * (localFactor / 100) * p) / p
        : Math.round(lastAppliedBaseline * p) / p;

      return {
        name,
        avgLoad: lastAppliedBaseline,
        currentBaseline: lastAppliedBaseline,
        calculatedBaseline: newBaseline,
        liveAvgLoad,
        sampleCount: nonZeroReadings.length,
        totalSamples: baselineReadings.length,
        excludedZeroCount: baselineReadings.length - nonZeroReadings.length,
        isSelected,
      };
    });
  }, [allEquipment, readings, localRange, localFactor, localDecimals, selectedEquipment]);

  const filteredStats = useMemo(() => {
    return equipmentStats.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  }, [equipmentStats, search]);

  const handleCommit = async () => {
    if (selectedEquipment.length === 0) {
      setError("Please select at least one equipment item.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsProcessing(true);
    setCommitProgress(5);
    setCommitStatus('Preparing baseline updates…');
    setError(null);

    // Sync to global (AppShell) state so widget persists when user navigates away
    setExternalProcessing?.(true);
    setExternalProgress?.(5);
    setExternalStatus?.('Preparing baseline updates…');
    setExternalEquipmentCount?.(selectedEquipment.length);
    setExternalMinimized?.(false);

    // Navigate back immediately so user can browse — the global widget will track progress
    onBack();

    try {
      const updates = equipmentStats
        .filter(stat => selectedEquipment.includes(stat.name))
        .map(stat => ({ name: stat.name, baselineKW: stat.calculatedBaseline }));

      setCommitProgress(15);
      setCommitStatus(`Updating ${updates.length} equipment baselines in database…`);
      setExternalProgress?.(15);
      setExternalStatus?.(`Updating ${updates.length} equipment baselines in database…`);
      await DataService.updateEquipmentBaselines(updates);

      setCommitProgress(60);
      setCommitStatus('Saving baseline configuration…');
      setExternalProgress?.(60);
      setExternalStatus?.('Saving baseline configuration…');
      await DataService.saveBaselineConfig({
        equipmentCount: selectedEquipment.length,
        factor: localFactor,
        startDate: localRange[0] ? localRange[0].toISOString() : null,
        endDate: localRange[1] ? localRange[1].toISOString() : null,
        decimals: localDecimals,
      });

      setCommitProgress(72);
      setCommitStatus('Writing audit log…');
      setExternalProgress?.(72);
      setExternalStatus?.('Writing audit log…');
      await DataService.addAuditLog(
        "Baseline Update",
        `Updated baselines for ${selectedEquipment.length} equipment items using factor ${localFactor}% and period ${localRange[0] ? format(localRange[0], 'MMM dd, yyyy') : 'N/A'} – ${localRange[1] ? format(localRange[1], 'MMM dd, yyyy') : 'N/A'}`
      );

      setCommitProgress(82);
      setCommitStatus('Refreshing data from database…');
      setExternalProgress?.(82);
      setExternalStatus?.('Refreshing data from database…');
      await Promise.all([refreshData(true), fetchConfig()]);

      setCommitProgress(100);
      setExternalProgress?.(100);

      // Reset dynamic baseline filters — they are now persisted in DB
      setFilters(prev => ({
        ...prev,
        baselineRange: [null, null],
        baselineFactor: 100,
        baselineEquipment: [],
        baselineDecimals: 2,
      }));

      setIsCommitted(true);
      setExternalCommitted?.(true);
      setTimeout(() => {
        setIsCommitted(false);
        setIsProcessing(false);
        setCommitProgress(0);
        setCommitStatus('');
        // Don't call onBack() again — already navigated away
      }, 2500);
    } catch (error: any) {
      console.error("Failed to apply baseline:", error);
      setError(error.message || "An unexpected error occurred while applying the baseline.");
      setIsProcessing(false);
      setCommitProgress(0);
      setCommitStatus('');
      setExternalProcessing?.(false);
      setExternalProgress?.(0);
      setExternalStatus?.('');
    }
  };

  const toggleEquipment = (name: string) => {
    setSelectedEquipment(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const selectAll = () => setSelectedEquipment(allEquipment);
  const deselectAll = () => setSelectedEquipment([]);

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Minimizable floating progress widget — non-blocking */}
      <AnimatePresence>
        {(isProcessing || isCommitted) && (
          <>
            {/* Expanded modal (when not minimized) — semi-transparent backdrop */}
            {!isMinimized && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[99] bg-black/30 backdrop-blur-sm"
                onClick={() => !isCommitted && setIsMinimized(true)}
              />
            )}

            {/* Floating card — repositions when minimized */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={isMinimized
                ? { opacity: 1, y: 0, scale: 1, bottom: 24, right: 24, top: 'auto', left: 'auto', x: 0 }
                : { opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              style={isMinimized ? { position: 'fixed', bottom: 24, right: 24, zIndex: 200 } : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 200 }}
              className={cn(
                "border shadow-2xl overflow-hidden",
                isMinimized
                  ? "rounded-2xl w-72"
                  : "rounded-[2rem] w-full max-w-sm mx-4",
                isDarkMode ? "bg-slate-900 border-emerald-500/30" : "bg-white border-emerald-100"
              )}
            >
              {/* Header bar — always visible */}
              <div className={cn(
                "flex items-center justify-between px-4 py-3 border-b",
                isDarkMode ? "border-white/5" : "border-slate-100"
              )}>
                <div className="flex items-center gap-2">
                  {isCommitted
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />}
                  <span className="text-xs font-bold">
                    {isCommitted ? 'Baseline Applied!' : `Applying… ${commitProgress}%`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {!isCommitted && (
                    <button
                      onClick={() => setIsMinimized(p => !p)}
                      className={cn('p-1.5 rounded-lg transition-colors', isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100')}
                      title={isMinimized ? 'Expand' : 'Minimize — you can keep using the app'}
                    >
                      {isMinimized ? <Maximize2 className="w-3.5 h-3.5 opacity-50" /> : <Minimize2 className="w-3.5 h-3.5 opacity-50" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar — always visible */}
              <div className="h-1 bg-black/5 dark:bg-white/5">
                <motion.div
                  animate={{ width: `${isCommitted ? 100 : commitProgress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="h-full bg-emerald-500"
                />
              </div>

              {/* Expanded body */}
              {!isMinimized && (
                <div className="p-6 flex flex-col items-center text-center space-y-4">
                  {isCommitted ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold tracking-tight">Baseline Applied!</h3>
                        <p className="text-sm opacity-50 mt-1 leading-relaxed">
                          Baselines saved for {selectedEquipment.length} equipment items. Dashboard data is refreshing…
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <Loader2 className="w-9 h-9 text-emerald-500 animate-spin" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold tracking-tight">Applying Baseline…</h3>
                        <p className="text-sm opacity-50 mt-1">{commitStatus}</p>
                      </div>
                      <p className="text-[10px] font-mono text-emerald-500">{commitProgress}% Complete</p>
                      <button
                        onClick={() => setIsMinimized(true)}
                        className="text-[10px] opacity-40 hover:opacity-80 transition-opacity underline"
                      >
                        Minimize and continue working
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Minimized body — compact status */}
              {isMinimized && !isCommitted && (
                <div className="px-4 py-2">
                  <p className="text-[10px] opacity-50 truncate">{commitStatus}</p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className={cn(
        "p-6 rounded-3xl border mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6",
        isDarkMode ? "bg-[var(--color-card-bg-dark)] border-white/5" : "bg-white border-slate-100 shadow-sm"
      )}>
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Baseline Calculator</h2>
            <p className="text-xs opacity-50 font-medium uppercase tracking-wider">Configure and apply energy baselines</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {error && (
            <div className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold animate-in fade-in zoom-in">
              {error}
            </div>
          )}

          {/* Date range picker */}
          <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl border border-black/5 dark:border-white/5">
            <span className="text-[10px] font-bold opacity-50 px-2 uppercase">Period</span>
            <input
              type="date"
              value={formatDateForInput(localRange[0])}
              onChange={e => handleDateChange(0, e.target.value)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-bold outline-none border transition-all",
                isDarkMode ? "bg-black/20 border-white/5 focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
              )}
            />
            <span className="text-[10px] opacity-30">to</span>
            <input
              type="date"
              value={formatDateForInput(localRange[1])}
              onChange={e => handleDateChange(1, e.target.value)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-bold outline-none border transition-all",
                isDarkMode ? "bg-black/20 border-white/5 focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
              )}
            />
          </div>

          {/* Factor input */}
          <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl border border-black/5 dark:border-white/5">
            <span className="text-[10px] font-bold opacity-50 px-2 uppercase">Factor</span>
            <input
              type="number"
              value={localFactor}
              onChange={e => setLocalFactor(Math.max(0, Math.min(200, parseFloat(e.target.value) || 100)))}
              min={0}
              max={200}
              step={1}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-bold outline-none border transition-all w-16 text-right",
                isDarkMode ? "bg-black/20 border-white/5 focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
              )}
            />
            <span className="text-[10px] font-bold opacity-50 pr-2">%</span>
          </div>

          {/* Decimals */}
          <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl border border-black/5 dark:border-white/5">
            <span className="text-[10px] font-bold opacity-50 px-2 uppercase">Decimals</span>
            <select
              value={localDecimals}
              onChange={e => setLocalDecimals(parseInt(e.target.value))}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-bold outline-none border transition-all w-16",
                isDarkMode ? "bg-black/20 border-white/5 focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
              )}
            >
              {[0, 1, 2, 3, 4].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Commit button */}
          <button
            onClick={handleCommit}
            disabled={isCommitted || isProcessing}
            className={cn(
              "px-6 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg",
              isCommitted
                ? "bg-emerald-500 text-white shadow-emerald-500/20"
                : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:shadow-emerald-500/20",
              isProcessing && "opacity-70 cursor-not-allowed"
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{commitProgress > 0 ? `${commitProgress}%` : 'Applying…'}</span>
              </>
            ) : isCommitted ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Baseline Applied!</span>
              </>
            ) : (
              <>
                <Gauge className="w-4 h-4" />
                <span>Commit Baseline</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2">
          <div className={cn(
            "p-6 rounded-3xl border",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-white/5" : "bg-white border-slate-100 shadow-sm"
          )}>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-500" />
              Calculation Logic
            </h3>
            <div className="space-y-4 text-xs opacity-70 leading-relaxed">
              <p>The baseline is calculated as the average actual load (kW) during the selected period, multiplied by your specified factor.</p>
              <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 font-mono text-[10px]">
                Baseline = Avg(Non-Zero Actual kW) × (Factor / 100)
              </div>
              <p>Selected Equipment: <span className="font-bold text-emerald-500">{selectedEquipment.length}</span></p>
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={selectAll} className="text-left text-[10px] font-bold text-emerald-500 hover:underline">Select All Equipment</button>
                <button onClick={deselectAll} className="text-left text-[10px] font-bold text-rose-500 hover:underline">Deselect All</button>
              </div>
            </div>
          </div>

          {/* Current Baseline Settings */}
          <div className={cn(
            "p-6 rounded-3xl border",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-white/5" : "bg-white border-slate-100 shadow-sm"
          )}>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              Current Baseline Settings
            </h3>
            <div className="space-y-4">
              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin opacity-20" />
                </div>
              ) : !currentConfig ? (
                <p className="text-[10px] opacity-40 text-center py-4">No baseline settings applied yet</p>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Active Factor</span>
                      <span className="text-xs font-bold">{currentConfig.factor}%</span>
                    </div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold opacity-40 uppercase tracking-wider">Date Period</span>
                      <span className="text-[10px] font-medium">
                        {currentConfig.startDate ? format(parseISO(currentConfig.startDate), 'MMM dd, yyyy') : 'N/A'} – {currentConfig.endDate ? format(parseISO(currentConfig.endDate), 'MMM dd, yyyy') : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold opacity-40 uppercase tracking-wider">Last Updated</span>
                      <span className="text-[10px] font-medium opacity-60">
                        {currentConfig.updatedAt ? format(new Date(currentConfig.updatedAt), 'MMM dd, HH:mm') : 'Recently'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[9px] opacity-40 italic text-center">
                    Applied to {currentConfig.equipmentCount} equipment items
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Equipment List */}
        <div className={cn(
          "lg:col-span-3 rounded-3xl border flex flex-col min-h-0 overflow-hidden",
          isDarkMode ? "bg-[var(--color-card-bg-dark)] border-white/5" : "bg-white border-slate-100 shadow-sm"
        )}>
          <div className="p-4 border-b flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
              <input
                type="text"
                placeholder="Search equipment…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={cn(
                  "w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none transition-all",
                  isDarkMode ? "bg-white/5 border-white/10 focus:border-emerald-500/50" : "bg-slate-50 border-slate-200 focus:border-emerald-500"
                )}
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold opacity-50 uppercase tracking-wider">
              <Filter className="w-3 h-3" />
              <span>{filteredStats.length} Items</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredStats.map(stat => (
                <div
                  key={stat.name}
                  onClick={() => toggleEquipment(stat.name)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer group",
                    selectedEquipment.includes(stat.name)
                      ? (isDarkMode ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-50 border-emerald-200")
                      : (isDarkMode ? "bg-white/5 border-white/5 hover:border-white/20" : "bg-slate-50 border-slate-100 hover:border-slate-200")
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                        selectedEquipment.includes(stat.name)
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-slate-300 dark:border-white/20"
                      )}>
                        {selectedEquipment.includes(stat.name) && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                      <span className="text-xs font-bold truncate max-w-[150px]">{stat.name}</span>
                    </div>
                    <span className="text-[10px] font-bold opacity-40 uppercase">{stat.sampleCount} Non-Zero Samples</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[8px] font-bold opacity-40 uppercase tracking-wider mb-1">Current Baseline</p>
                      <p className="text-xs font-mono font-bold">{stat.avgLoad.toFixed(localDecimals)} kW</p>
                      {stat.excludedZeroCount > 0 && (
                        <p className="text-[7px] opacity-30 mt-0.5">{stat.excludedZeroCount} zero-kW days excluded</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[8px] font-bold opacity-40 uppercase tracking-wider mb-1 text-emerald-500">New Baseline</p>
                      <p className="text-xs font-mono font-bold text-emerald-500">{stat.calculatedBaseline.toFixed(localDecimals)} kW</p>
                      {stat.isSelected && (
                        <p className="text-[7px] opacity-30 mt-0.5">{stat.sampleCount} non-zero samples</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
