'use client';
import React from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, ReferenceLine, Dot
} from 'recharts';
import { Filters } from './Filters';
import { MeterReading, EquipmentSummary, FilterState } from '../types';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, TrendingUp, Gauge, Zap, Clock, Activity, Calendar, Download, ArrowLeft, Settings } from 'lucide-react';
import { ReportButton } from './ReportButton';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface EquipmentAnalyticsProps {
  equipmentNames: string[];
  readings: MeterReading[];
  summaries: EquipmentSummary[];
  isDarkMode: boolean;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onBack: () => void;
  isLoading?: boolean;
}

import { useData } from '../DataContext';

export const EquipmentAnalytics: React.FC<EquipmentAnalyticsProps> = ({ 
  readings, 
  summaries, 
  isDarkMode,
  filters,
  setFilters,
  onBack,
  equipmentNames: initialEquipmentNames,
  isLoading = false
}) => {
  const { appliedDateFilter, hasInitialLoad } = useData();
  const pageRef = React.useRef<HTMLDivElement>(null);
  const [filterAnomaliesFor, setFilterAnomaliesFor] = React.useState<string | null>(null);
  const [equipmentNames, setEquipmentNames] = React.useState<string[]>(initialEquipmentNames);

  React.useEffect(() => {
    setEquipmentNames(initialEquipmentNames);
  }, [initialEquipmentNames]);

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

  const comparisonData = React.useMemo(() => {
    // Get all unique timestamps across all selected equipment
    let selectedReadings = readings.filter(r => equipmentNames.includes(r.equipmentName));
    
    if (filterAnomaliesFor) {
      // Filter to only timestamps where the specific equipment has an anomaly
      const anomalousTimestamps = selectedReadings
        .filter(r => r.equipmentName === filterAnomaliesFor && r.isAnomaly)
        .map(r => r.timestamp);
      
      selectedReadings = selectedReadings.filter(r => anomalousTimestamps.includes(r.timestamp));
    }

    const timestamps = Array.from(new Set(selectedReadings.map(r => r.timestamp))).sort();
    
    return timestamps.map(ts => {
      const dataPoint: any = { timestamp: ts };
      equipmentNames.forEach(name => {
        const reading = selectedReadings.find(r => r.timestamp === ts && r.equipmentName === name);
        dataPoint[name] = reading ? reading.actualKW : null;
        dataPoint[`${name}_isAnomaly`] = reading ? reading.isAnomaly : false;
      });
      return dataPoint;
    });
  }, [readings, equipmentNames, filterAnomaliesFor]);

  const CustomDot = (props: any) => {
    const { cx, cy, payload, dataKey } = props;
    const isAnomaly = payload[`${dataKey}_isAnomaly`];

    if (isAnomaly) {
      return (
        <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="white" strokeWidth={2} />
      );
    }

    return null;
  };

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  if (isLoading && !hasInitialLoad) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm font-bold opacity-50">Analyzing Equipment Data...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 scroll-smooth pb-12">
      <div className="space-y-6" ref={pageRef} id="equipment-analytics-report">
        <div className={cn(
          "p-4 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-inherit",
          isDarkMode ? "bg-[var(--color-card-bg-dark)] border-white/5" : "bg-white border-slate-100 shadow-sm"
        )}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Back to Inventory"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold tracking-tight uppercase">
              {equipmentNames.length > 1 ? 'Equipment Comparison' : 'Equipment Analysis'}
            </h2>
            <p className="text-[10px] opacity-50 font-bold uppercase tracking-wider">
              {equipmentNames.join(' vs ')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filters popup */}
          <Filters isDarkMode={isDarkMode} />
          {/* Date Range Display */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 opacity-40" />
              <span className="text-xs font-bold">
                {format(parseISO(appliedDateFilter.startDate), 'MMM dd, yyyy')} - {format(parseISO(appliedDateFilter.endDate), 'MMM dd, yyyy')}
              </span>
            </div>
          </div>

          <ReportButton 
            isDarkMode={isDarkMode} 
            contentRef={pageRef}
            filename={`WattsUp_Equipment_${equipmentNames.join('_')}_${new Date().toISOString().split('T')[0]}`}
            title="Equipment Analysis Report"
            data={summaries.map(s => ({
              Name: s.name,
              Area: s.area,
              'Avg Load (kW)': s.avgLoad,
              'Max Demand (kW)': s.maxDemand,
              'Total KWh': s.totalKWh,
              'Efficiency (%)': s.avgEfficiency,
              'Status': s.efficiencyStatus
            }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {equipmentNames.map((name, index) => {
          const summary = summaries.find(s => s.name === name);
          if (!summary) return null;

          const stats = [
            { label: 'AVE KW', value: `${Math.round(summary.avgLoad).toLocaleString()} kW`, icon: TrendingUp, color: 'text-emerald-500' },
            { label: 'AVE KWH', value: `${Math.round(summary.avgKWh).toLocaleString()} kWh`, icon: Zap, color: 'text-emerald-500' },
            { label: 'BASELINE KW', value: summary.computedBaseline ? `${summary.computedBaseline.toFixed(filters.baselineDecimals ?? 2).toLocaleString()} kW` : `${summary.baselineKW.toFixed(filters.baselineDecimals ?? 2).toLocaleString()} kW`, icon: Gauge, color: 'text-emerald-500' },
            { label: 'DESIGN KW', value: `${Math.round(summary.designKW).toLocaleString()} kW`, icon: Settings, color: 'text-blue-500' },
            { label: 'ANOMALIES', value: summary.anomalyCount.toString(), icon: AlertTriangle, color: 'text-rose-500' },
            { label: 'DAYS ONLINE', value: `${summary.daysOnline} days`, icon: Clock, color: 'text-amber-500' },
            { label: 'UTILIZATION %', value: `${summary.utilization.toFixed(1)}%`, icon: Activity, color: 'text-indigo-500' },
          ];

          return (
            <div 
              key={`${name}-${index}`} 
              onClick={() => {
                if (summary.anomalyCount > 0) {
                  setFilterAnomaliesFor(prev => prev === name ? null : name);
                }
              }}
              className={cn(
                "p-5 rounded-3xl border flex flex-col gap-4 transition-all duration-300 cursor-pointer group",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-white/10" : "bg-white border-slate-200 shadow-sm",
                filterAnomaliesFor === name && (isDarkMode ? "ring-2 ring-rose-500/50 border-rose-500/50" : "ring-2 ring-rose-500 border-rose-500"),
                summary.anomalyCount > 0 && "hover:border-rose-500/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold truncate max-w-[150px]">{name}</h2>
                      {summary.anomalyCount > 0 && (
                        <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[10px] opacity-50 uppercase tracking-wider font-bold">{summary.area}</p>
                  </div>
                </div>
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  index === 0 ? "bg-[#10b981]" : 
                  index === 1 ? "bg-[#3b82f6]" : 
                  index === 2 ? "bg-[#f59e0b]" :
                  index === 3 ? "bg-[#8b5cf6]" :
                  index === 4 ? "bg-[#ec4899]" : "bg-[#06b6d4]"
                )} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {stats.map((stat) => (
                  <div key={stat.label} className={cn(
                    "p-3 rounded-2xl border",
                    isDarkMode ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"
                  )}>
                    <div className="flex items-center gap-2 mb-1 opacity-50">
                      <stat.icon className={cn("w-3 h-3", stat.color)} />
                      <span className="text-[8px] font-bold uppercase tracking-wider">{stat.label}</span>
                    </div>
                    <p className="text-sm font-bold">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-4 border-t border-inherit">
                <div className="flex items-center justify-between text-[10px] font-bold opacity-50 uppercase tracking-wider">
                  <span>Status</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full",
                    summary.efficiencyStatus === 'Efficient' ? "bg-emerald-500/10 text-emerald-500" :
                    summary.efficiencyStatus === 'Normal' ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                  )}>{summary.efficiencyStatus}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={cn(
        "p-6 rounded-3xl border",
        isDarkMode ? "bg-[var(--color-card-bg-dark)] border-white/10" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-bold">
              {filterAnomaliesFor ? `Anomalous Readings: ${filterAnomaliesFor}` : 'Comparative Load Profile (kW)'}
            </h3>
            {filterAnomaliesFor && (
              <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">
                Showing only timestamps with detected anomalies
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {equipmentNames.map((name, index) => (
              <div key={`${name}-${index}`} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[index] }} />
                <span className="text-[10px] font-bold opacity-50 truncate max-w-[80px]">{name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={comparisonData}>
              <defs>
                {equipmentNames.map((name, index) => (
                  <linearGradient key={name} id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors[index]} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={colors[index]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(str) => format(parseISO(str), 'MMM d, HH:mm')}
                tick={{ fontSize: 10, opacity: 0.5 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, opacity: 0.5 }}
                axisLine={false}
                tickLine={false}
                unit=" kW"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDarkMode ? 'var(--color-card-bg-dark)' : '#fff', 
                  borderColor: isDarkMode ? 'var(--color-border-dark)' : 'rgba(0,0,0,0.1)',
                  borderRadius: '16px',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
              />
              {equipmentNames.length === 1 && summaries[0].computedBaseline && (
                <ReferenceLine 
                  y={summaries[0].computedBaseline} 
                  stroke="#10b981" 
                  strokeDasharray="5 5" 
                  label={{ 
                    value: `Baseline: ${summaries[0].computedBaseline.toFixed(filters.baselineDecimals ?? 2)} kW`, 
                    position: 'insideTopRight', 
                    fill: '#10b981', 
                    fontSize: 10,
                    fontWeight: 'bold'
                  }} 
                />
              )}
              {equipmentNames.map((name, index) => (
                <Area 
                  key={`${name}-${index}`}
                  type="monotone" 
                  dataKey={name} 
                  stroke={colors[index]} 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill={`url(#color${index})`}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  dot={<CustomDot />}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      </div>
    </div>
  );
};
