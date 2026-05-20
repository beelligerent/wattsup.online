'use client';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
  Search, ChevronRight, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, 
  Filter, X, Calendar, Gauge, Settings, Eye, EyeOff, GripVertical, Download 
} from 'lucide-react';
import { EquipmentSummary, FilterState, CostRules } from '../types';
import { format, differenceInDays } from 'date-fns';
import { ReportButton } from './ReportButton';
import { useData } from '../DataContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface EquipmentTableProps {
  equipment: EquipmentSummary[];
  onSelect: (name: string) => void;
  onCompare: (names: string[]) => void;
  onOpenBaselineCalculator: () => void;
  isDarkMode: boolean;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  costRules: CostRules;
  isLoading?: boolean;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export const EquipmentTable: React.FC<EquipmentTableProps> = ({ 
  equipment, 
  onSelect, 
  onCompare, 
  onOpenBaselineCalculator,
  isDarkMode,
  filters,
  setFilters,
  costRules,
  isLoading = false
}) => {
  const { hasInitialLoad } = useData();
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    name: 200,
    area: 120,
    computedBaseline: 110,
    designKW: 110,
    avgLoad: 110,
    variance: 100,
    costGainLoss: 140,
    avgKWh: 110,
    totalKWh: 110,
    co2kg: 100,
    daysOnline: 100,
    runningSince: 120,
    efficiencyStatus: 110,
  });

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    area: true,
    computedBaseline: true,
    designKW: false,
    avgLoad: true,
    variance: true,
    costGainLoss: true,
    avgKWh: false,
    totalKWh: true,
    co2kg: false,
    daysOnline: true,
    runningSince: false,
    efficiencyStatus: true,
  });

  const [columnOrder, setColumnOrder] = useState<string[]>([
    'name', 'area', 'computedBaseline', 'designKW', 'avgLoad', 'avgKWh', 'variance', 'costGainLoss', 'totalKWh', 'co2kg', 'daysOnline', 'runningSince', 'efficiencyStatus'
  ]);

  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<'xs' | 'sm' | 'base'>('xs');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const colMap = useMemo(() => ({
    name: 'Equipment Name',
    area: 'Area',
    computedBaseline: 'Baseline KW',
    designKW: 'Design KW',
    avgLoad: 'AVG Load KW',
    avgKWh: 'Avg KWH',
    variance: '% Variance',
    costGainLoss: 'Cost Gain/Loss',
    totalKWh: 'Total Energy KWH',
    co2kg: 'CO2 (kg)',
    daysOnline: 'Days Online',
    runningSince: 'Running Since',
    efficiencyStatus: 'Status'
  }), []);

  const handleDragStart = (e: React.DragEvent, key: string) => {
    setDraggedColumn(key);
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetKey) return;

    const newOrder = [...columnOrder];
    const draggedIdx = newOrder.indexOf(draggedColumn);
    const targetIdx = newOrder.indexOf(targetKey);

    newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, draggedColumn);
    setColumnOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  const daysSelected = useMemo(() => {
    if (filters.dateRange[0] && filters.dateRange[1]) {
      return Math.max(1, differenceInDays(filters.dateRange[1], filters.dateRange[0]) + 1);
    }
    return 1;
  }, [filters.dateRange]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const startResizing = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      key,
      startX: e.pageX,
      startWidth: columnWidths[key]
    };
    document.addEventListener('mousemove', handleResizing);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  };

  const handleResizing = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { key, startX, startWidth } = resizingRef.current;
    const delta = e.pageX - startX;
    setColumnWidths(prev => ({
      ...prev,
      [key]: Math.max(50, startWidth + delta)
    }));
  };

  const stopResizing = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleResizing);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = '';
  };

  const tableRef = useRef<HTMLDivElement>(null);

  const toggleCompareSelection = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setSelectedForCompare(prev => {
      if (prev.includes(name)) {
        return prev.filter(n => n !== name);
      }
      if (prev.length >= 6) return prev;
      return [...prev, name];
    });
  };

  const uniqueAreas = useMemo(() => {
    const areas = new Set(equipment.map(e => e.area));
    return Array.from(areas).sort();
  }, [equipment]);

  const uniqueStatuses = ['Efficient', 'Normal', 'Inefficient'];

  const filteredAndSorted = useMemo(() => {
    let result = [...equipment];

    // Global search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e => 
        e.name.toLowerCase().includes(s) || 
        e.area.toLowerCase().includes(s) ||
        e.efficiencyStatus.toLowerCase().includes(s)
      );
    }

    // Column filters
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (!value) return;
      const v = value.toLowerCase();
      result = result.filter(e => {
        const val = e[key as keyof EquipmentSummary];
        return String(val).toLowerCase().includes(v);
      });
    });

    // Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        if (sortConfig.key === 'variance') {
          aVal = a.computedBaseline ? (a.computedBaseline - a.avgLoad) / a.computedBaseline : -Infinity;
          bVal = b.computedBaseline ? (b.computedBaseline - b.avgLoad) / b.computedBaseline : -Infinity;
        } else if (sortConfig.key === 'costGainLoss') {
          aVal = a.computedBaseline ? (a.computedBaseline - a.avgLoad) * 24 * daysSelected * costRules.energyPrice : -Infinity;
          bVal = b.computedBaseline ? (b.computedBaseline - b.avgLoad) * 24 * daysSelected * costRules.energyPrice : -Infinity;
        } else {
          aVal = a[sortConfig.key as keyof EquipmentSummary];
          bVal = b[sortConfig.key as keyof EquipmentSummary];
        }

        if (aVal === bVal) return 0;
        
        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          if (sortConfig.key === 'runningSince') {
            comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
          } else {
            comparison = aVal.localeCompare(bVal);
          }
        } else {
          comparison = (aVal || 0) - (bVal || 0);
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [equipment, search, sortConfig, columnFilters, daysSelected, costRules.energyPrice]);

  const renderSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />;
  };

  const toggleFilter = (key: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setColumnFilters({});
    setSearch('');
  };

  const handleDateChange = (index: 0 | 1, value: string) => {
    const newDate = value ? new Date(value) : null;
    setFilters(prev => {
      const newRange = [...prev.dateRange] as [Date | null, Date | null];
      newRange[index] = newDate;
      return { ...prev, dateRange: newRange };
    });
  };

  const handleBaselineDateChange = (index: 0 | 1, value: string) => {
    const newDate = value ? new Date(value) : null;
    setFilters(prev => {
      const newRange = [...prev.baselineRange] as [Date | null, Date | null];
      newRange[index] = newDate;
      return { ...prev, baselineRange: newRange };
    });
  };

  const handleBaselineFactorChange = (value: string) => {
    const factor = parseFloat(value) || 0;
    setFilters(prev => ({ ...prev, baselineFactor: factor }));
  };

  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    try {
      return format(date, 'yyyy-MM-dd');
    } catch (e) {
      return '';
    }
  };

  if (isLoading && !hasInitialLoad) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm font-bold opacity-50">Loading Equipment Inventory...</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col h-[calc(100vh-12rem)] min-h-[600px] flex-1 rounded-2xl border transition-all duration-300",
      isDarkMode ? "bg-[var(--color-table-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-100 shadow-sm"
    )} ref={tableRef}>
      {/* Header Section - Fixed Height */}
      <div className={cn(
        "flex-none p-4 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-4 z-40 bg-inherit",
        isDarkMode ? "bg-[var(--color-table-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-100"
      )}>
        <div className="shrink-0">
          <h3 className="text-lg font-bold tracking-tight">Equipment Analysis</h3>
          <p className="text-[10px] opacity-50 uppercase tracking-wider font-bold">Performance metrics per unit ({filteredAndSorted.length} items)</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 flex-1 justify-end">
          <div className="flex items-center gap-2 mr-2">
            <button
              onClick={() => scroll('left')}
              className={cn(
                "p-2 rounded-xl border transition-all hover:bg-emerald-500/10",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
              )}
              title="Scroll Left"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <button
              onClick={() => scroll('right')}
              className={cn(
                "p-2 rounded-xl border transition-all hover:bg-emerald-500/10",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
              )}
              title="Scroll Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className={cn(
            "flex items-center gap-1 p-1 rounded-xl border mr-2",
            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-200"
          )}>
            {(['xs', 'sm', 'base'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-bold transition-all uppercase",
                  fontSize === size
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "hover:bg-emerald-500/10 opacity-50"
                )}
              >
                {size}
              </button>
            ))}
          </div>

          {selectedForCompare.length > 0 && (
            <button
              onClick={() => onCompare(selectedForCompare)}
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2 animate-in fade-in slide-in-from-right-4"
            >
              Compare ({selectedForCompare.length})
            </button>
          )}

          <button
            onClick={onOpenBaselineCalculator}
            className={cn(
              "px-4 py-2 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold",
              isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)] hover:bg-[var(--color-sidebar-hover-dark)]" : "bg-white border-slate-200 hover:bg-slate-50 shadow-sm"
            )}
          >
            <Gauge className="w-3.5 h-3.5 text-emerald-500" />
            <span>Baseline Calculator</span>
          </button>

          {/* Date Range Filters */}
          <div className={cn(
            "flex items-center gap-2 p-1 rounded-xl border",
            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-200"
          )}>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 opacity-40 pointer-events-none" />
              <input
                type="date"
                value={formatDateForInput(filters.dateRange[0])}
                onChange={(e) => handleDateChange(0, e.target.value)}
                className={cn(
                  "pl-8 pr-2 py-1.5 rounded-lg text-[10px] font-bold outline-none border transition-all w-32",
                  isDarkMode ? "bg-black/20 border-white/5 focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
                )}
              />
            </div>
            <span className="opacity-30 text-[10px] font-bold">TO</span>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 opacity-40 pointer-events-none" />
              <input
                type="date"
                value={formatDateForInput(filters.dateRange[1])}
                onChange={(e) => handleDateChange(1, e.target.value)}
                className={cn(
                  "pl-8 pr-2 py-1.5 rounded-lg text-[10px] font-bold outline-none border transition-all w-32",
                  isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)] focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
                )}
              />
            </div>
          </div>

          <ReportButton 
            isDarkMode={isDarkMode}
            contentRef={tableRef}
            filename={`Equipment_Analysis_${new Date().toISOString().split('T')[0]}`}
            title="Equipment Analysis Report"
            data={filteredAndSorted.map(eq => ({
              'Equipment Name': eq.name,
              'Area': eq.area,
              'Baseline (kW)': eq.computedBaseline,
              'Design KW': eq.designKW,
              'Avg Load (kW)': eq.avgLoad,
              'Avg KWH': eq.avgKWh,
              'CO2 (kg)': (eq.avgKWh * 0.7).toFixed(2),
              'Variance (%)': eq.computedBaseline ? ((eq.computedBaseline - eq.avgLoad) / eq.computedBaseline * 100).toFixed(1) : '-',
              'Cost Gain/Loss (₱)': eq.computedBaseline ? (eq.computedBaseline - eq.avgLoad) * 24 * daysSelected * costRules.energyPrice : '-',
              'Total Energy (kWh)': eq.totalKWh,
              'Days Online': eq.daysOnline,
              'Running Since': eq.runningSince,
              'Status': eq.efficiencyStatus
            }))}
          />

          <div className="relative flex-1 max-w-xs min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
            <input
              type="text"
              placeholder="Search equipment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none transition-all",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)] focus:border-emerald-500/50" : "bg-slate-50 border-slate-200 focus:border-emerald-500"
              )}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "px-4 py-2 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold",
              showFilters 
                ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" 
                : (isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)] hover:bg-[var(--color-sidebar-hover-dark)]" : "bg-white border-slate-200 hover:bg-slate-50 shadow-sm")
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          {(Object.values(columnFilters).some(v => v) || search) && (
            <button
              onClick={clearFilters}
              className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
              title="Clear all filters"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Column Visibility Toggles */}
      <div className={cn(
        "flex-none px-4 py-3 border-b flex flex-wrap items-center gap-2",
        isDarkMode ? "bg-[var(--color-table-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50/50 border-slate-100"
      )}>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 mr-2">Visible Columns:</span>
        {columnOrder.map((key) => (
          <button
            key={`toggle-${key}`}
            onClick={() => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border whitespace-nowrap flex items-center gap-2",
              visibleColumns[key]
                ? (isDarkMode 
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]" 
                    : "bg-emerald-500 text-white border-emerald-600 shadow-sm")
                : (isDarkMode 
                    ? "bg-white/5 border-white/10 text-white/40 hover:bg-white/10" 
                    : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50")
            )}
          >
            {visibleColumns[key] ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {colMap[key]}
          </button>
        ))}
      </div>

      {/* Table Section - Scrollable Body */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        <div className="h-full overflow-auto scroll-smooth scrollbar-hide" ref={scrollContainerRef}>
          <table className={cn(
            "w-full text-left border-collapse table-fixed",
            fontSize === 'xs' ? "text-[10px]" : fontSize === 'sm' ? "text-xs" : "text-sm"
          )} style={{ width: 'max-content', minWidth: '100%' }}>
            <thead className="sticky top-0 z-50">
              <tr className={cn(
                "uppercase tracking-wider font-bold opacity-70",
                isDarkMode ? "bg-[var(--color-table-header-dark)] border-b border-[var(--color-border-dark)]" : "bg-white border-b border-slate-100"
              )}>
                <th key="selection-header" className="px-4 py-2 w-12 bg-inherit align-middle"></th>
                {columnOrder.map((key, idx) => {
                  if (!visibleColumns[key]) return null;
                  return (
                    <th 
                      key={`${key}-${idx}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, key)}
                      onDragOver={(e) => handleDragOver(e, key)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "px-4 py-2 cursor-move hover:opacity-100 transition-opacity sticky top-0 bg-inherit z-30 align-middle relative group/th whitespace-normal break-words",
                        draggedColumn === key && "opacity-20"
                      )}
                      style={{ width: columnWidths[key] }}
                    >
                      <div className="flex items-center gap-2" onClick={() => handleSort(key)}>
                        <span className="leading-tight">{colMap[key]}</span>
                        {renderSortIcon(key)}
                      </div>
                      {/* Resize Handle */}
                      <div 
                        onMouseDown={(e) => startResizing(e, key)}
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-500/50 transition-colors flex items-center justify-center group-hover/th:opacity-100 opacity-0"
                      >
                        <div className="w-[1px] h-4 bg-inherit opacity-20" />
                      </div>
                    </th>
                  );
                })}
                <th key="actions-header" className="px-4 py-2 w-12 sticky top-0 bg-inherit z-30 align-middle"></th>
              </tr>
              {showFilters && (
                <tr className={cn(
                  "border-b border-inherit sticky top-[33px] z-50",
                  isDarkMode ? "bg-[var(--color-table-header-dark)]" : "bg-white shadow-sm"
                )}>
                  <th key="selection-filter" className="px-4 py-2 bg-inherit"></th>
                  {columnOrder.map((key, idx) => {
                    if (!visibleColumns[key]) return null;
                    if (key === 'name') return (
                      <th key={`filter-name-${idx}`} className="px-2 py-2 bg-inherit">
                        <input
                          type="text"
                          placeholder="Filter name..."
                          value={columnFilters['name'] || ''}
                          onChange={(e) => toggleFilter('name', e.target.value)}
                          className={cn(
                            "w-full px-2 py-1 rounded-lg text-[10px] border outline-none transition-all font-normal",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
                          )}
                        />
                      </th>
                    );
                    if (key === 'area') return (
                      <th key={`filter-area-${idx}`} className="px-2 py-2">
                        <select
                          value={columnFilters['area'] || ''}
                          onChange={(e) => toggleFilter('area', e.target.value)}
                          className={cn(
                            "w-full px-2 py-1 rounded-lg text-[10px] border outline-none transition-all font-normal",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
                          )}
                        >
                          <option value="">All Areas</option>
                          {uniqueAreas.map(area => <option key={area} value={area}>{area}</option>)}
                        </select>
                      </th>
                    );
                    if (key === 'avgLoad') return (
                      <th key={`filter-avgLoad-${idx}`} className="px-2 py-2">
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters['avgLoad'] || ''}
                          onChange={(e) => toggleFilter('avgLoad', e.target.value)}
                          className={cn(
                            "w-full px-2 py-1 rounded-lg text-[10px] border outline-none transition-all font-normal",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
                          )}
                        />
                      </th>
                    );
                    if (key === 'totalKWh') return (
                      <th key={`filter-totalKWh-${idx}`} className="px-2 py-2">
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters['totalKWh'] || ''}
                          onChange={(e) => toggleFilter('totalKWh', e.target.value)}
                          className={cn(
                            "w-full px-2 py-1 rounded-lg text-[10px] border outline-none transition-all font-normal",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
                          )}
                        />
                      </th>
                    );
                    if (key === 'daysOnline') return (
                      <th key={`filter-daysOnline-${idx}`} className="px-2 py-2">
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters['daysOnline'] || ''}
                          onChange={(e) => toggleFilter('daysOnline', e.target.value)}
                          className={cn(
                            "w-full px-2 py-1 rounded-lg text-[10px] border outline-none transition-all font-normal",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
                          )}
                        />
                      </th>
                    );
                    if (key === 'runningSince') return (
                      <th key={`filter-runningSince-${idx}`} className="px-2 py-2">
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters['runningSince'] || ''}
                          onChange={(e) => toggleFilter('runningSince', e.target.value)}
                          className={cn(
                            "w-full px-2 py-1 rounded-lg text-[10px] border outline-none transition-all font-normal",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
                          )}
                        />
                      </th>
                    );
                    if (key === 'efficiencyStatus') return (
                      <th key={`filter-efficiencyStatus-${idx}`} className="px-2 py-2">
                        <select
                          value={columnFilters['efficiencyStatus'] || ''}
                          onChange={(e) => toggleFilter('efficiencyStatus', e.target.value)}
                          className={cn(
                            "w-full px-2 py-1 rounded-lg text-[10px] border outline-none transition-all font-normal",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] focus:border-emerald-500/50" : "bg-white border-slate-200 focus:border-emerald-500"
                          )}
                        >
                          <option value="">All Status</option>
                          {uniqueStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </th>
                    );
                    return <th key={`filter-empty-${idx}`} className="px-2 py-2"></th>;
                  })}
                  <th key="actions-filter" className="px-2 py-2"></th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-inherit">
              {filteredAndSorted.map((eq, idx) => {
                const variance = eq.computedBaseline ? ((eq.computedBaseline - eq.avgLoad) / eq.computedBaseline * 100) : null;
                const costGainLoss = eq.computedBaseline ? (eq.computedBaseline - eq.avgLoad) * 24 * daysSelected * costRules.energyPrice : null;

                return (
                  <tr 
                    key={`eq-row-${eq.name}-${idx}`}
                    onClick={() => onSelect(eq.name)}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      isDarkMode ? "hover:bg-[var(--color-table-row-hover-dark)]" : "hover:bg-slate-50"
                    )}
                  >
                    <td className="px-4 py-2 align-middle bg-inherit">
                      <input 
                        type="checkbox"
                        checked={selectedForCompare.includes(eq.name)}
                        onChange={() => {}}
                        onClick={(e) => toggleCompareSelection(e, eq.name)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    {columnOrder.map((key, colIdx) => {
                      if (!visibleColumns[key]) return null;
                      if (key === 'name') return (
                        <td key={`name-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words bg-inherit" style={{ width: columnWidths['name'] }}>
                          <span className="font-semibold text-sm block" title={eq.name}>{eq.name}</span>
                        </td>
                      );
                      if (key === 'area') return (
                        <td key={`area-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words" style={{ width: columnWidths['area'] }}>
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg font-bold uppercase block",
                            isDarkMode ? "bg-[var(--color-sidebar-hover-dark)] text-white/70" : "bg-slate-100 text-slate-600"
                          )}>
                            {eq.area}
                          </span>
                        </td>
                      );
                      if (key === 'computedBaseline') return (
                        <td key={`computedBaseline-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words font-mono text-emerald-500 font-bold" style={{ width: columnWidths['computedBaseline'] }}>
                          {eq.computedBaseline ? eq.computedBaseline.toFixed(filters.baselineDecimals ?? 2).toLocaleString() : '-'}
                        </td>
                      );
                      if (key === 'designKW') return (
                        <td key={`designKW-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words font-mono text-emerald-500 font-bold" style={{ width: columnWidths['designKW'] }}>
                          {eq.designKW ? Math.round(eq.designKW).toLocaleString() : '-'}
                        </td>
                      );
                      if (key === 'avgLoad') return (
                        <td key={`avgLoad-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words font-mono" style={{ width: columnWidths['avgLoad'] }}>
                          {Math.round(eq.avgLoad).toLocaleString()}
                        </td>
                      );
                      if (key === 'avgKWh') return (
                        <td key={`avgKWh-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words font-mono text-emerald-500 font-bold" style={{ width: columnWidths['avgKWh'] }}>
                          {Math.round(eq.avgKWh).toLocaleString()}
                        </td>
                      );
                      if (key === 'variance') return (
                        <td key={`variance-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words font-mono" style={{ width: columnWidths['variance'] }}>
                          {variance !== null ? (
                            <span className={cn(
                              "font-bold",
                              variance >= 0 ? "text-emerald-500" : "text-rose-500"
                            )}>
                              {variance.toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                      );
                      if (key === 'costGainLoss') return (
                        <td key={`costGainLoss-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words font-mono" style={{ width: columnWidths['costGainLoss'] }}>
                          {costGainLoss !== null ? (
                            <span className={cn(
                              "font-bold",
                              costGainLoss >= 0 ? "text-emerald-500" : "text-rose-500"
                            )}>
                              ₱{Math.round(costGainLoss).toLocaleString()}
                            </span>
                          ) : '-'}
                        </td>
                      );
                      if (key === 'totalKWh') return (
                        <td key={`totalKWh-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words font-mono text-emerald-500 font-bold" style={{ width: columnWidths['totalKWh'] }}>
                          {Math.round(eq.totalKWh).toLocaleString()}
                        </td>
                      );
                      if (key === 'co2kg') return (
                        <td key={`co2kg-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words font-mono text-emerald-500 font-bold" style={{ width: columnWidths['co2kg'] }}>
                          {(eq.avgKWh * 0.7).toFixed(2)}
                        </td>
                      );
                      if (key === 'daysOnline') return (
                        <td key={`daysOnline-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words font-mono" style={{ width: columnWidths['daysOnline'] }}>
                          {eq.daysOnline}
                        </td>
                      );
                      if (key === 'runningSince') return (
                        <td key={`runningSince-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words font-mono opacity-70" style={{ width: columnWidths['runningSince'] }}>
                          {eq.runningSince}
                        </td>
                      );
                      if (key === 'efficiencyStatus') return (
                        <td key={`efficiencyStatus-${colIdx}`} className="px-4 py-2 align-middle whitespace-normal break-words" style={{ width: columnWidths['efficiencyStatus'] }}>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                            eq.efficiencyStatus === 'Efficient' ? "bg-emerald-500/10 text-emerald-500" :
                            eq.efficiencyStatus === 'Normal' ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                          )}>
                            {eq.efficiencyStatus}
                          </span>
                        </td>
                      );
                      return null;
                    })}
                    <td className="px-4 py-2 align-middle text-right">
                      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-5px] group-hover:translate-x-0" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredAndSorted.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
          <AlertTriangle className="w-8 h-8 mb-4 opacity-20" />
          <p className="text-sm opacity-50">No equipment found matching your filters.</p>
          <button 
            onClick={clearFilters}
            className="mt-4 text-xs font-bold text-emerald-500 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
};

