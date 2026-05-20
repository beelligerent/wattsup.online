'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, Calendar, X, Download, ChevronDown, Check, RefreshCw, AlertCircle, Filter } from 'lucide-react';
import { DateFilterType } from '../types';
import { cn } from '../utils/cn';
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useData } from '../DataContext';
import { motion, AnimatePresence } from 'motion/react';

// ── MultiSelect Dropdown ──────────────────────────────────────────────────
const MultiSelectDropdown: React.FC<{
  label: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  isDarkMode: boolean;
  placeholder: string;
}> = ({ label, options, selected, onToggle, onSelectAll, onClear, isDarkMode, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative flex-1 min-w-[160px]" ref={dropdownRef}>
      <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1.5 block ml-1">
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-all",
          isDarkMode
            ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)] hover:bg-[var(--color-sidebar-hover-dark)]"
            : "bg-slate-50 border-slate-200 hover:bg-slate-100 shadow-sm",
          isOpen && (isDarkMode
            ? "border-emerald-500/50 ring-2 ring-emerald-500/10"
            : "border-emerald-500 ring-2 ring-emerald-500/10")
        )}
      >
        <span className={cn(
          "text-xs font-medium truncate",
          selected.length === 0 ? "opacity-40" : "text-emerald-500"
        )}>
          {selected.length === 0 ? placeholder : `${selected.length} Selected`}
        </span>
        <ChevronDown className={cn("w-4 h-4 opacity-40 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className={cn(
          "absolute top-full left-0 min-w-[220px] w-full mt-2 rounded-2xl border shadow-2xl z-[200] overflow-hidden",
          isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200"
        )}>
          <div className="p-3 border-b border-inherit space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <button onClick={onSelectAll} className="text-[10px] font-bold text-emerald-500 hover:underline">Select All</button>
                <button onClick={onClear} className="text-[10px] font-bold text-rose-500 hover:underline">Clear</button>
              </div>
              <span className="text-[10px] opacity-30">{options.length} Total</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-30" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  "w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border",
                  isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-200"
                )}
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-1 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center opacity-30 text-xs">No results found</div>
            ) : (
              filteredOptions.map(option => (
                <button
                  key={option}
                  onClick={() => onToggle(option)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left",
                    selected.includes(option)
                      ? (isDarkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600")
                      : (isDarkMode ? "hover:bg-white/5" : "hover:bg-slate-50")
                  )}
                >
                  <span className="truncate">{option}</span>
                  {selected.includes(option) && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Filter Popup Button — the main export ─────────────────────────────────
export const Filters: React.FC<{
  isDarkMode: boolean;
  showExport?: boolean;
  hideAreaFilter?: boolean;
  hideEquipmentFilter?: boolean;
  showDateBadge?: boolean;
}> = ({
  isDarkMode,
  showExport = true,
  hideAreaFilter = false,
  hideEquipmentFilter = false,
  showDateBadge = true,
}) => {
  const {
    filters,
    setFilters,
    allAreas,
    allEquipment,
    tempDateFilter,
    appliedDateFilter,
    setTempDateFilter,
    applyFilters,
    isFilterDirty,
    isLoading,
    handleExport,
    globalSettings,
  } = useData();

  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const toggleArea = (area: string) => {
    setFilters(prev => ({
      ...prev,
      areas: prev.areas.includes(area) ? prev.areas.filter(a => a !== area) : [...prev.areas, area],
    }));
  };

  const toggleEquipment = (eq: string) => {
    setFilters(prev => ({
      ...prev,
      equipment: prev.equipment.includes(eq) ? prev.equipment.filter(e => e !== eq) : [...prev.equipment, eq],
    }));
  };

  const clearFilters = async () => {
    // Restore global default date range from system settings, fallback to wide range
    const defaultStart = globalSettings?.defaultDateFilter?.startDate || '2020-01-01';
    const defaultEnd = globalSettings?.defaultDateFilter?.endDate
      || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

    setFilters({
      dateRange: [null, null],
      areas: [],
      equipment: [],
      search: '',
      baselineRange: [null, null],
      baselineFactor: 100,
      baselineEquipment: [],
      baselineDecimals: 2,
    });
    setTempDateFilter({ type: 'custom', startDate: defaultStart, endDate: defaultEnd });
    // Auto-apply so data reloads immediately
    await applyFilters();
    setIsOpen(false);
  };

  const handleDateChange = (index: 0 | 1, value: string) => {
    if (index === 0) setTempDateFilter({ startDate: value, type: 'custom' });
    else setTempDateFilter({ endDate: value, type: 'custom' });
  };

  const handleTypeChange = (type: DateFilterType) => {
    const today = new Date();
    if (type === 'custom') return setTempDateFilter({ type: 'custom' });
    const ranges: Record<string, [Date, Date]> = {
      daily:   [today, today],
      monthly: [startOfMonth(today), endOfMonth(today)],
      yearly:  [startOfYear(today), endOfYear(today)],
    };
    const [start, end] = ranges[type] || [today, today];
    setTempDateFilter({ type, startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') });
  };

  const handleApply = async () => {
    await applyFilters();
    setIsOpen(false);
  };

  // Count active filters for badge
  const activeCount = (filters.areas.length > 0 ? 1 : 0)
    + (filters.equipment.length > 0 ? 1 : 0)
    + (isFilterDirty ? 1 : 0);

  return (
    <div className="relative flex items-center gap-2" ref={popupRef}>
      {/* ── Trigger Button ── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all",
          isOpen
            ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20"
            : isDarkMode
              ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)] hover:border-white/30 text-white"
              : "bg-white border-slate-200 hover:border-slate-300 shadow-sm text-slate-700"
        )}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>Filters</span>
        {activeCount > 0 && !isOpen && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black">
            {activeCount}
          </span>
        )}
      </button>

      {/* ── Date badge — shows active date range inline next to button ── */}
      {showDateBadge && (
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all",
            isDarkMode
              ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)] text-white/70 hover:border-white/30"
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm"
          )}
        >
          <Calendar className="w-3.5 h-3.5 opacity-50" />
          <span>
            {(() => {
              try {
                const s = format(parseISO(appliedDateFilter.startDate), 'MMM dd, yyyy');
                const e = format(parseISO(appliedDateFilter.endDate), 'MMM dd, yyyy');
                return `${s} - ${e}`;
              } catch { return 'Select date range'; }
            })()}
          </span>
        </button>
      )}

      {/* ── Popup Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              "absolute right-0 top-full mt-2 w-[700px] max-w-[95vw] rounded-2xl border shadow-2xl z-[150] p-5",
              isDarkMode
                ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]"
                : "bg-white border-slate-200"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-widest opacity-70">Filters</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isDarkMode ? "hover:bg-white/10" : "hover:bg-slate-100"
                )}
              >
                <X className="w-4 h-4 opacity-50" />
              </button>
            </div>

            {/* Date Type */}
            <div className="mb-4">
              <label className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-1.5 block">
                Filter Type
              </label>
              <div className={cn(
                "flex p-1 rounded-xl border w-fit",
                isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-200"
              )}>
                {(['daily', 'monthly', 'yearly', 'custom'] as DateFilterType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => handleTypeChange(t)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all capitalize",
                      tempDateFilter.type === t
                        ? (isDarkMode ? "bg-emerald-500 text-white" : "bg-white shadow-sm text-emerald-600")
                        : "opacity-40 hover:opacity-100"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range + Area + Equipment */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Beginning Date */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-1.5 block">
                  Beginning Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 pointer-events-none" />
                  <input
                    type="date"
                    value={tempDateFilter.startDate}
                    onChange={e => handleDateChange(0, e.target.value)}
                    className={cn(
                      "w-full pl-9 pr-3 py-2.5 rounded-xl border outline-none text-xs font-medium transition-all",
                      isDarkMode
                        ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] focus:border-emerald-500/50"
                        : "bg-slate-50 border-slate-200 focus:border-emerald-500"
                    )}
                  />
                </div>
              </div>

              {/* End Date */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-1.5 block">
                  End Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 pointer-events-none" />
                  <input
                    type="date"
                    value={tempDateFilter.endDate}
                    onChange={e => handleDateChange(1, e.target.value)}
                    className={cn(
                      "w-full pl-9 pr-3 py-2.5 rounded-xl border outline-none text-xs font-medium transition-all",
                      isDarkMode
                        ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] focus:border-emerald-500/50"
                        : "bg-slate-50 border-slate-200 focus:border-emerald-500"
                    )}
                  />
                </div>
              </div>

              {/* Area Filter */}
              {!hideAreaFilter && (
                <MultiSelectDropdown
                  label="Filter by Area"
                  options={allAreas}
                  selected={filters.areas}
                  onToggle={toggleArea}
                  onSelectAll={() => setFilters(prev => ({ ...prev, areas: allAreas }))}
                  onClear={() => setFilters(prev => ({ ...prev, areas: [] }))}
                  isDarkMode={isDarkMode}
                  placeholder="All Areas"
                />
              )}

              {/* Equipment Filter */}
              {!hideEquipmentFilter && (
                <MultiSelectDropdown
                  label="Filter by Equipment"
                  options={allEquipment}
                  selected={filters.equipment}
                  onToggle={toggleEquipment}
                  onSelectAll={() => setFilters(prev => ({ ...prev, equipment: allEquipment }))}
                  onClear={() => setFilters(prev => ({ ...prev, equipment: [] }))}
                  isDarkMode={isDarkMode}
                  placeholder="All Equipment"
                />
              )}
            </div>

            {/* Footer: reset + export + apply */}
            <div className="flex items-center justify-between pt-3 border-t border-inherit">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-rose-500 hover:bg-rose-500/10 transition-colors uppercase tracking-wider"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>

              <div className="flex items-center gap-2">
                {showExport && (
                  <>
                    <button
                      onClick={() => handleExport('csv')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all uppercase tracking-wider",
                        isDarkMode ? "border-[var(--color-border-dark)] hover:bg-white/5" : "border-slate-200 hover:bg-slate-50 shadow-sm"
                      )}
                    >
                      <Download className="w-3 h-3" />CSV
                    </button>
                    <button
                      onClick={() => handleExport('xlsx')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all uppercase tracking-wider",
                        isDarkMode ? "border-[var(--color-border-dark)] hover:bg-white/5" : "border-slate-200 hover:bg-slate-50 shadow-sm"
                      )}
                    >
                      <Download className="w-3 h-3" />Excel
                    </button>
                  </>
                )}

                {isFilterDirty && (
                  <div className="flex items-center gap-1 text-[9px] font-bold text-orange-500 animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    Not applied
                  </div>
                )}

                <button
                  onClick={handleApply}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Filter className="w-3.5 h-3.5" />}
                  Apply Filter
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
