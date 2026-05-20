'use client';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, LabelList
} from 'recharts';
import {
  BarChart2, LineChart as LineChartIcon,
  TrendingUp, TrendingDown, Zap, Activity, RefreshCw,
  Filter, PieChart as PieChartIcon, Settings2, Layers, List, FileDown, Calendar
} from 'lucide-react';
import { Filters } from './Filters';
import { MeterReading } from '../types';
import {
  format, parseISO, startOfMonth, endOfMonth, startOfYear,
  endOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachYearOfInterval,
  differenceInDays, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek
} from 'date-fns';
import { cn } from '../utils/cn';
import { useAuth } from '../auth/AuthContext';
import { ReportButton } from './ReportButton';
import { useData } from '../DataContext';
import { motion, AnimatePresence } from 'motion/react';
import { EquipmentSummaryTable } from './EquipmentSummaryTable';
import { useDebounce } from '../utils/useDebounce';

interface EnergyUserPageProps {
  isDarkMode: boolean;
  readings: MeterReading[];
  allEquipment: string[];
  allAreas: string[];
  refreshData: () => void;
  isLoading: boolean;
}

enum TrendType { DAILY = 'daily', WEEKLY = 'weekly', MONTHLY = 'monthly', YEARLY = 'yearly' }
enum ChartType { BAR = 'bar', LINE = 'line', AREA = 'area' }
// When a specific area is selected, user can choose to view by area total OR per equipment
type AreaViewMode = 'area' | 'equipment';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6'];

// ── Tooltip ───────────────────────────────────────────────────────────────────
const ChartTooltip = ({ isDarkMode }: { isDarkMode: boolean }) =>
  ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={cn(
        'p-3 rounded-xl border shadow-xl text-xs max-w-[220px]',
        isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
      )}>
        <p className="font-bold opacity-50 mb-1.5 truncate">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || p.fill }} />
            <span className="truncate opacity-70">{p.name}:</span>
            <span className="font-bold ml-auto pl-2">{Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
          </div>
        ))}
      </div>
    );
  };

export const EnergyUserPage: React.FC<EnergyUserPageProps> = ({
  isDarkMode, readings, allEquipment, allAreas, refreshData, isLoading: isGlobalLoading
}) => {
  const { filters, fetchFilteredData, isLoading: isContextLoading, hasInitialLoad, appliedDateFilter, setTempDateFilter, applyFilters, globalSettings } = useData();
  const pageRef = useRef<HTMLDivElement>(null);
  const { hasPermission } = useAuth();

  if (!hasPermission('view_energy_user')) return null;

  const [selectedArea, setSelectedArea] = useState<string>('All Areas');
  // areaViewMode: only active when a specific area is selected
  const [areaViewMode, setAreaViewMode] = useState<AreaViewMode>('area');
  const [trendType, setTrendType] = useState<TrendType>(TrendType.DAILY);
  const [chartType, setChartType] = useState<ChartType>(ChartType.AREA);
  const [selectedUnit, setSelectedUnit] = useState<'kw' | 'kwh'>('kwh');
  const [baselineMode, setBaselineMode] = useState<'static' | 'average'>('average');

  const isAllAreas = selectedArea === 'All Areas';

  // trendType is now controlled directly by the chart toolbar — not synced from filter

  const isLoading = isGlobalLoading || isContextLoading;
  const showSkeleton = isLoading && (!hasInitialLoad || readings.length === 0);

  useEffect(() => {
    fetchFilteredData(undefined, appliedDateFilter.startDate, appliedDateFilter.endDate);
  }, [appliedDateFilter]);

  useEffect(() => {
    if (allAreas.length > 0 && !allAreas.includes(selectedArea) && selectedArea !== 'All Areas') {
      setSelectedArea('All Areas');
    }
  }, [allAreas]);

  const { setFilters } = useData();
  const handleAreaChange = useCallback((area: string) => {
    setSelectedArea(area);
    // When switching to All Areas, reset view mode to area (no per-equip on All Areas)
    if (area === 'All Areas') setAreaViewMode('area');
    setFilters(prev => ({ ...prev, areas: area === 'All Areas' ? [] : [area] }));
  }, [setFilters]);

  // ── Filtered readings ─────────────────────────────────────────────────────
  const filteredReadings = useMemo(() => {
    if (readings.length === 0) return [];
    const start = startOfDay(parseISO(appliedDateFilter.startDate));
    const end = endOfDay(parseISO(appliedDateFilter.endDate));
    return readings.filter(r => {
      const d = parseISO(r.timestamp);
      return isWithinInterval(d, { start, end }) &&
        (isAllAreas || r.area === selectedArea);
    });
  }, [readings, appliedDateFilter, selectedArea, isAllAreas]);

  const hasData = filteredReadings.length > 0;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const empty = { totalKWh: 0, peakKW: 0, avgEfficiency: 0, topEquipment: [], equipmentSummary: [], savingsOpportunities: [], avgKWhPerDay: 0, avgKW: 0, daysInPeriod: 0 };
    if (!hasData) return empty;

    const totalKWh = filteredReadings.reduce((s, r) => s + r.kwh, 0);
    const peakKW = Math.max(...filteredReadings.map(r => r.actualKW));
    const avgEfficiency = filteredReadings.reduce((s, r) => s + r.efficiencyScore, 0) / filteredReadings.length;

    const equipmentMap = new Map<string, { actual: number; baselineSum: number; actualKW_Sum: number; count: number }>();
    filteredReadings.forEach(r => {
      const c = equipmentMap.get(r.equipmentName) || { actual: 0, baselineSum: 0, actualKW_Sum: 0, count: 0 };
      c.actual += r.kwh; c.baselineSum += r.baselineKW; c.actualKW_Sum += r.actualKW; c.count++;
      equipmentMap.set(r.equipmentName, c);
    });

    const equipmentSummary = Array.from(equipmentMap.entries()).map(([name, data]) => {
      const totalActualKWh = data.actual;
      const avgBaselineKW = data.baselineSum / (data.count || 1);
      const avgActualKW = data.actualKW_Sum / (data.count || 1);
      const baselineKWh = baselineMode === 'static'
        ? totalActualKWh * (avgBaselineKW / (avgActualKW || 1))
        : totalActualKWh * 0.95;
      const variance = totalActualKWh - baselineKWh;
      return { name, actual: totalActualKWh, baseline: baselineKWh, variance, percentDiff: baselineKWh > 0 ? (variance / baselineKWh) * 100 : 0 };
    }).sort((a, b) => b.actual - a.actual);

    const topEquipment = equipmentSummary.slice(0, 5).map(eq => ({ name: eq.name, value: eq.actual }));
    const PHP_PER_KWH = 12;
    const startD = parseISO(appliedDateFilter.startDate);
    const endD = parseISO(appliedDateFilter.endDate);
    const daysInPeriod = Math.max(1, differenceInDays(endD, startD) + 1);
    const savingsOpportunities = equipmentSummary.filter(e => e.variance > 0).sort((a, b) => b.variance - a.variance).slice(0, 3).map(e => ({ ...e, costPerDay: (e.variance * PHP_PER_KWH) / daysInPeriod }));
    const avgKWhPerDay = totalKWh / daysInPeriod;
    // avgKW: mean of all actual kW readings (consistent with dashboard avgLoad calculation)
    const avgKW = filteredReadings.length > 0
      ? filteredReadings.reduce((s, r) => s + r.actualKW, 0) / filteredReadings.length
      : 0;

    return { totalKWh, peakKW, avgEfficiency, topEquipment, equipmentSummary, savingsOpportunities, avgKWhPerDay, avgKW, daysInPeriod };
  }, [filteredReadings, baselineMode, hasData, appliedDateFilter]);

  // ── Unique areas in data ──────────────────────────────────────────────────
  const areasInData = useMemo(() =>
    Array.from(new Set(filteredReadings.map(r => r.area))).sort(),
    [filteredReadings]);

  // ── Unique equipment names ────────────────────────────────────────────────
  const equipmentNames = useMemo(() =>
    Array.from(new Set(filteredReadings.map(r => r.equipmentName))).sort(),
    [filteredReadings]);

  // ── Trend Data — two modes ────────────────────────────────────────────────
  // Mode A (All Areas OR area+total): aggregate per AREA
  // Mode B (specific area + equipment view): aggregate per EQUIPMENT
  const showPerEquipment = !isAllAreas && areaViewMode === 'equipment';
  const trendKeys = showPerEquipment ? equipmentNames : areasInData;

  const trendData = useMemo(() => {
    if (!hasData) return [];
    const start = parseISO(appliedDateFilter.startDate);
    const end = parseISO(appliedDateFilter.endDate);

    const getKey = (date: Date) => {
      if (trendType === TrendType.DAILY) return format(date, 'yyyy-MM-dd');
      if (trendType === TrendType.WEEKLY) return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (trendType === TrendType.MONTHLY) return format(date, 'yyyy-MM');
      return format(date, 'yyyy');
    };
    const getLabel = (key: string) => {
      if (trendType === TrendType.DAILY) return format(parseISO(key), 'MMM dd');
      if (trendType === TrendType.WEEKLY) return `W${format(parseISO(key), 'w')} ${format(parseISO(key), 'MMM dd')}`;
      if (trendType === TrendType.MONTHLY) return format(parseISO(key + '-01'), 'MMM yyyy');
      return key;
    };

    const dataMap = new Map<string, any>();

    // Build interval buckets
    let interval: Date[] = [];
    if (trendType === TrendType.DAILY) interval = eachDayOfInterval({ start, end });
    else if (trendType === TrendType.WEEKLY) interval = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    else if (trendType === TrendType.MONTHLY) interval = eachMonthOfInterval({ start: startOfMonth(start), end: endOfMonth(end) });
    else interval = eachYearOfInterval({ start: startOfYear(start), end: endOfYear(end) });

    interval.forEach(date => {
      const key = getKey(date);
      if (!dataMap.has(key)) {
        const entry: any = { name: getLabel(key), _key: key };
        trendKeys.forEach(k => { entry[k] = 0; });
        dataMap.set(key, entry);
      }
    });

    filteredReadings.forEach(r => {
      const key = getKey(parseISO(r.timestamp));
      const entry = dataMap.get(key);
      if (entry) {
        const groupKey = showPerEquipment ? r.equipmentName : r.area;
        entry[groupKey] = (entry[groupKey] || 0) + (selectedUnit === 'kwh' ? r.kwh : r.actualKW);
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => a._key.localeCompare(b._key));
  }, [filteredReadings, trendType, appliedDateFilter, selectedUnit, hasData, trendKeys, showPerEquipment]);

  // ── Tooltip factory ───────────────────────────────────────────────────────
  const tooltipStyle = {
    borderRadius: '12px', border: 'none',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
    backgroundColor: isDarkMode ? '#1e293b' : '#fff', fontSize: 11
  };
  const axisTickStyle = { fill: isDarkMode ? '#94a3b8' : '#64748b' };

  const renderChart = () => {
    const unit = selectedUnit === 'kwh' ? ' kWh' : ' kW';
    const commonProps = { data: trendData, margin: { top: 4, right: 8, bottom: 50, left: 0 } };
    const commonAxis = (
      <>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
        <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} tick={axisTickStyle} angle={-35} textAnchor="end" height={55} interval="preserveStartEnd" />
        <YAxis fontSize={9} axisLine={false} tickLine={false} tick={axisTickStyle} unit={unit} width={72} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
      </>
    );

    if (chartType === ChartType.BAR) {
      return (
        <BarChart {...commonProps}>
          {commonAxis}
          {trendKeys.map((k, idx) => (
            <Bar key={k} dataKey={k} stackId="a" fill={COLORS[idx % COLORS.length]}
              radius={idx === trendKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      );
    }
    if (chartType === ChartType.AREA) {
      return (
        <AreaChart {...commonProps}>
          <defs>
            {trendKeys.map((k, idx) => (
              <linearGradient key={k} id={`grad-eu-${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {commonAxis}
          {trendKeys.map((k, idx) => (
            <Area key={k} type="monotone" dataKey={k}
              stroke={COLORS[idx % COLORS.length]} strokeWidth={1.5}
              fill={`url(#grad-eu-${idx})`} dot={false} />
          ))}
        </AreaChart>
      );
    }
    return (
      <LineChart {...commonProps}>
        {commonAxis}
        {trendKeys.map((k, idx) => (
          <Line key={k} type="monotone" dataKey={k}
            stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    );
  };

  // ── Card style helper ─────────────────────────────────────────────────────
  const card = cn('rounded-3xl border', isDarkMode ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-100 shadow-sm');

  return (
    <div className="space-y-6 pb-12" ref={pageRef}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Energy User</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Filters isDarkMode={isDarkMode} showExport={false} hideAreaFilter={true} />
          {/* Quick Report Button */}
          <button
            onClick={async () => {
              // Collect report data from current view
              const { default: jsPDF } = await import('jspdf');
              const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
              const area = selectedArea;
              const dateRange = `${appliedDateFilter.startDate} to ${appliedDateFilter.endDate}`;
              doc.setFontSize(18); doc.setFont('helvetica', 'bold');
              doc.text('WattsUp — Energy User Report', 14, 18);
              doc.setFontSize(10); doc.setFont('helvetica', 'normal');
              doc.text(`Area: ${area}   Period: ${dateRange}   Trend: ${trendType}`, 14, 26);
              doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text('Key Performance Indicators', 14, 36);
              doc.setFontSize(10); doc.setFont('helvetica', 'normal');
              const kpis = [
                ['Total Consumption', `${stats.totalKWh.toLocaleString(undefined, {maximumFractionDigits:1})} kWh`],
                ['Avg Daily Consumption', `${stats.avgKWhPerDay.toLocaleString(undefined, {maximumFractionDigits:0})} kWh/day`],
                ['Peak Demand', `${stats.peakKW.toLocaleString(undefined, {maximumFractionDigits:2})} kW`],
                ['Avg Demand', `${stats.avgKW.toLocaleString(undefined, {maximumFractionDigits:1})} kW`],
                ['Days in Period', String(stats.daysInPeriod)],
              ];
              kpis.forEach(([k, v], i) => {
                doc.text(`${k}:`, 14, 44 + i * 7);
                doc.setFont('helvetica', 'bold');
                doc.text(v, 80, 44 + i * 7);
                doc.setFont('helvetica', 'normal');
              });
              doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text('Top 10 Consumers', 14, 90);
              doc.setFontSize(9); doc.setFont('helvetica', 'normal');
              stats.equipmentSummary.slice(0, 10).forEach((eq, i) => {
                doc.text(`${i+1}. ${eq.name}`, 14, 98 + i * 6);
                doc.text(`${eq.actual.toLocaleString(undefined, {maximumFractionDigits:0})} kWh`, 120, 98 + i * 6);
              });
              doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text('Savings Opportunities', 170, 90);
              doc.setFontSize(9); doc.setFont('helvetica', 'normal');
              stats.savingsOpportunities.forEach((eq, i) => {
                doc.text(`${eq.name}`, 170, 98 + i * 10);
                doc.text(`+${eq.variance.toLocaleString(undefined, {maximumFractionDigits:0})} kWh potential`, 170, 103 + i * 10);
              });
              doc.setFontSize(8); doc.setTextColor(150);
              doc.text(`Generated: ${new Date().toLocaleString()}  |  WattsUp Energy Intelligence`, 14, 200);
              doc.save(`EnergyUser_${area.replace(/ /g,'_')}_${appliedDateFilter.startDate}_${appliedDateFilter.endDate}.pdf`);
            }}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all hover:scale-105 active:scale-95',
              isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-sm')}
          >
            <FileDown className="w-3.5 h-3.5" />
            Generate Report
          </button>
          <button onClick={refreshData} disabled={isLoading}
            className={cn('p-2.5 rounded-xl border transition-all hover:scale-105 active:scale-95',
              isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-600 shadow-sm')}>
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Area Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button onClick={() => handleAreaChange('All Areas')}
          className={cn('px-6 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0',
            isAllAreas
              ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : isDarkMode ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm')}>
          All Areas
        </button>
        {allAreas.map(area => (
          <button key={area} onClick={() => handleAreaChange(area)}
            className={cn('px-6 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0',
              selectedArea === area
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : isDarkMode ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm')}>
            {area}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {showSkeleton ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className={cn('p-5 rounded-3xl border animate-pulse h-32', card)} />
              ))}
            </div>
          </motion.div>
        ) : !hasData ? (
          <motion.div key="empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={cn('h-[400px] flex flex-col items-center justify-center space-y-4 rounded-3xl border border-dashed',
              isDarkMode ? 'bg-slate-900/30 border-white/10' : 'bg-slate-50/50 border-slate-200')}>
            <Filter className="w-10 h-10 opacity-20" />
            <h3 className="text-lg font-bold">No Data Available</h3>
            <p className="text-sm opacity-50 max-w-xs text-center">No data for the selected area and date range. The current filter may not match available data.</p>
            <button
              onClick={async () => {
                const defaultStart = globalSettings?.defaultDateFilter?.startDate || '2025-01-01';
                const defaultEnd = globalSettings?.defaultDateFilter?.endDate || '2026-12-31';
                setTempDateFilter({ type: 'custom', startDate: defaultStart, endDate: defaultEnd });
                await applyFilters();
                setSelectedArea('All Areas');
              }}
              className="px-5 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 hover:scale-105 transition-transform"
            >
              Reset to Default Date Range
            </button>
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Consumption */}
              <div className={cn('p-5 rounded-3xl border relative overflow-hidden group', card)}>
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Zap className="w-12 h-12 text-emerald-500" />
                </div>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">Total Consumption</p>
                <h3 className="text-2xl font-bold tracking-tight">{stats.totalKWh.toLocaleString(undefined, { maximumFractionDigits: 1 })}</h3>
                <p className="text-[10px] font-bold text-emerald-500 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> kWh for period
                </p>
                <div className={cn('mt-2 pt-2 border-t', isDarkMode ? 'border-white/5' : 'border-slate-100')}>
                  <p className="text-[9px] opacity-40 uppercase tracking-widest">Avg Daily</p>
                  <p className="text-sm font-bold">{stats.avgKWhPerDay.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[9px] font-medium opacity-60">kWh/day</span></p>
                </div>
              </div>

              {/* Peak Demand */}
              <div className={cn('p-5 rounded-3xl border relative overflow-hidden group', card)}>
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Activity className="w-12 h-12 text-blue-500" />
                </div>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">Peak Demand</p>
                <h3 className="text-2xl font-bold tracking-tight">{stats.peakKW.toLocaleString(undefined, { maximumFractionDigits: 2 })}</h3>
                <p className="text-[10px] font-bold text-blue-500 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Max KW recorded
                </p>
                <div className={cn('mt-2 pt-2 border-t', isDarkMode ? 'border-white/5' : 'border-slate-100')}>
                  <p className="text-[9px] opacity-40 uppercase tracking-widest">Avg Demand</p>
                  <p className="text-sm font-bold">{stats.avgKW.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-[9px] font-medium opacity-60">kW / day</span></p>
                </div>
              </div>

              {/* Savings */}
              <div className={cn('p-5 rounded-3xl border', card)}>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-2">Savings Opportunities</p>
                <div className="space-y-2">
                  {stats.savingsOpportunities.map(eq => (
                    <div key={eq.name} className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold truncate max-w-[100px]">{eq.name}</span>
                        <span className="text-[8px] opacity-50">Potential Savings</span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-500">+{eq.variance.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh</span>
                    </div>
                  ))}
                  {stats.savingsOpportunities.length === 0 && <p className="text-[10px] opacity-30 italic">All within baseline</p>}
                </div>
              </div>

              {/* Cost */}
              <div className={cn('p-5 rounded-3xl border relative overflow-hidden', card)}>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <TrendingDown className="w-12 h-12 text-rose-500" />
                </div>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-2">Cost Implications</p>
                <div className="space-y-2">
                  {stats.savingsOpportunities.map(eq => (
                    <div key={eq.name} className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold truncate max-w-[100px]">{eq.name}</span>
                        <span className="text-[8px] opacity-50">Wasted Cost</span>
                      </div>
                      <span className="text-[10px] font-bold text-rose-500">₱{eq.costPerDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day</span>
                    </div>
                  ))}
                  {stats.savingsOpportunities.length === 0 && <p className="text-[10px] opacity-30 italic">No wasted cost</p>}
                </div>
              </div>
            </div>

            {/* Performance Insights */}
            <div className={cn('p-5 rounded-3xl border flex items-center gap-5',
              isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-100 shadow-sm')}>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                <PieChartIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold mb-0.5">Performance Insights</h4>
                <p className="text-xs opacity-60">
                  {stats.topEquipment[0] ? (
                    <><span className="font-bold text-emerald-500">{stats.topEquipment[0].name}</span> is the highest consumer, accounting for <span className="font-bold">{(stats.topEquipment[0].value / (stats.totalKWh || 1) * 100).toFixed(1)}%</span> of total energy.{stats.savingsOpportunities.length > 0 && ` ${stats.savingsOpportunities.length} equipment items have savings potential.`}</>
                  ) : 'No significant consumption patterns detected.'}
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Consumption Trend */}
              <div className={cn('lg:col-span-2 p-6 rounded-3xl border', card)}>
                {/* Chart header */}
                {/* Chart header — title + all controls in one compact row */}
                <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                  <div className="shrink-0">
                    <h3 className="text-sm font-bold leading-tight">Consumption Trend</h3>
                    <p className="text-[9px] opacity-40 uppercase tracking-widest">
                      {isAllAreas ? 'Per area total' : areaViewMode === 'area' ? `${selectedArea} total` : `${selectedArea} per equip`}
                    </p>
                  </div>

                  {/* All toggles in one compact flex row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Area / Equipment — only when specific area selected */}
                    {!isAllAreas && (
                      <div className={cn('flex p-0.5 rounded-lg', isDarkMode ? 'bg-white/5' : 'bg-slate-100')}>
                        <button onClick={() => setAreaViewMode('area')} title="Area Total"
                          className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-wide transition-all',
                            areaViewMode === 'area' ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                          <Layers className="w-2.5 h-2.5" /> Area
                        </button>
                        <button onClick={() => setAreaViewMode('equipment')} title="Per Equipment"
                          className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-wide transition-all',
                            areaViewMode === 'equipment' ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                          <List className="w-2.5 h-2.5" /> Equip
                        </button>
                      </div>
                    )}

                    {/* Period selector */}
                    <div className={cn('flex p-0.5 rounded-lg', isDarkMode ? 'bg-white/5' : 'bg-slate-100')}>
                      {([
                        { key: TrendType.DAILY, label: 'D' },
                        { key: TrendType.WEEKLY, label: 'W' },
                        { key: TrendType.MONTHLY, label: 'M' },
                        { key: TrendType.YEARLY, label: 'Y' },
                      ].map(({ key, label }) => (
                        <button key={key} onClick={() => setTrendType(key)}
                          title={key.charAt(0).toUpperCase() + key.slice(1)}
                          className={cn('px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-wide transition-all',
                            trendType === key ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                          {label}
                        </button>
                      )))}
                    </div>

                    {/* Baseline */}
                    <div className={cn('flex p-0.5 rounded-lg', isDarkMode ? 'bg-white/5' : 'bg-slate-100')}>
                      {(['static', 'average'] as const).map(m => (
                        <button key={m} onClick={() => setBaselineMode(m)}
                          className={cn('flex items-center gap-0.5 px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-wide transition-all',
                            baselineMode === m ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                          {m === 'static' ? <Settings2 className="w-2.5 h-2.5" /> : <Activity className="w-2.5 h-2.5" />}
                          {m === 'static' ? 'Static' : 'Avg'}
                        </button>
                      ))}
                    </div>

                    {/* KWH / KW */}
                    <div className={cn('flex p-0.5 rounded-lg', isDarkMode ? 'bg-white/5' : 'bg-slate-100')}>
                      {(['kwh', 'kw'] as const).map(u => (
                        <button key={u} onClick={() => setSelectedUnit(u)}
                          className={cn('px-2.5 py-1 rounded-md text-[8px] font-bold uppercase tracking-wide transition-all',
                            selectedUnit === u ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                          {u}
                        </button>
                      ))}
                    </div>

                    {/* Chart type */}
                    <div className={cn('flex p-0.5 rounded-lg', isDarkMode ? 'bg-white/5' : 'bg-slate-100')}>
                      {[ChartType.AREA, ChartType.BAR, ChartType.LINE].map(c => (
                        <button key={c} onClick={() => setChartType(c)}
                          className={cn('p-1 rounded-md transition-all',
                            chartType === c ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                          {c === ChartType.BAR ? <BarChart2 className="w-3.5 h-3.5" /> : c === ChartType.LINE ? <LineChartIcon className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="h-[370px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {renderChart() as any}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Consumers — dynamic height based on item count */}
              <div className={cn('p-6 rounded-3xl border flex flex-col', card)}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold">Top Consumers</h3>
                    <p className="text-[10px] opacity-40 uppercase tracking-widest">
                      {isAllAreas ? 'Top 10 by area' : `Top 10 in ${selectedArea}`}
                    </p>
                  </div>
                  <BarChart2 className="w-4 h-4 opacity-20" />
                </div>

                {/* Auto-height: fills available space proportionally, no gaps */}
                {(() => {
                  const items = stats.equipmentSummary.slice(0, 10);
                  const count = items.length || 1;
                  // Each bar = fixed 28px, gap = 6px, chart fills exact needed height
                  const barH = 28;
                  const gap = 6;
                  const chartH = Math.max(180, count * (barH + gap) + 16);
                  return (
                    <div style={{ height: chartH }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={items}
                          margin={{ left: 0, right: 68, top: 2, bottom: 2 }}
                          barCategoryGap={`${Math.round((gap / (barH + gap)) * 100)}%`}
                          barGap={0}
                        >
                          <XAxis type="number" hide />
                          <YAxis
                            type="category" dataKey="name"
                            axisLine={false} tickLine={false} width={108}
                            tick={{ fontSize: 10, fontWeight: 700, fill: isDarkMode ? '#94a3b8' : '#475569' }}
                          />
                          <Tooltip
                            cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}
                            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', backgroundColor: isDarkMode ? '#1e293b' : '#fff', fontSize: 11 }}
                            formatter={(v: number) => [`${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`, 'Consumption']}
                          />
                          <Bar dataKey="actual" radius={[0, 5, 5, 0]} barSize={barH}>
                            {items.map((_, idx) => (
                              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                            ))}
                            <LabelList
                              dataKey="actual" position="right"
                              formatter={(v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(Math.round(v))}
                              style={{ fontSize: 10, fontWeight: 700, fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Equipment Table */}
            <EquipmentSummaryTable data={stats.equipmentSummary} isDarkMode={isDarkMode} selectedArea={selectedArea} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
