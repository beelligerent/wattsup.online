'use client';
import React from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  ComposedChart, Area
} from 'recharts';
import { MeterReading, DashboardStats } from '../types';
import { format, parseISO } from 'date-fns';
import { cn } from '../utils/cn';
import { generateForecast } from '../services/ForecastService';
import { useData } from '../DataContext';
import { Loader2 } from 'lucide-react';

interface ChartsSectionProps {
  readings: MeterReading[];
  stats: DashboardStats;
  isDarkMode: boolean;
  costRate?: number;
  isLoading?: boolean;
}

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  '#84cc16', '#14b8a6',
];

export const ChartsSection: React.FC<ChartsSectionProps> = ({
  readings,
  stats,
  isDarkMode,
  costRate = 8.5,
  isLoading = false
}) => {
  const { hasInitialLoad } = useData();

  // ── Derive the complete set of areas from ALL readings (not just first row) ──
  const allAreas = React.useMemo(() => {
    const set = new Set<string>();
    readings.forEach(r => { if (r.area) set.add(r.area); });
    return Array.from(set).sort();
  }, [readings]);

  // ── System Distribution data — guaranteed to have every area in every row ──
  const areaTrendData = React.useMemo(() => {
    if (readings.length === 0) return [];

    // Aggregate kW per (timestamp × area)
    const timeMap = new Map<string, Record<string, number>>();
    readings.forEach(r => {
      if (!timeMap.has(r.timestamp)) {
        const blank: Record<string, number> = {};
        allAreas.forEach(a => { blank[a] = 0; }); // seed every area with 0
        timeMap.set(r.timestamp, blank);
      }
      const entry = timeMap.get(r.timestamp)!;
      entry[r.area] = (entry[r.area] || 0) + r.actualKW;
    });

    return Array.from(timeMap.entries())
      .map(([timestamp, areaKWs]) => ({ timestamp, ...areaKWs }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [readings, allAreas]);

  const forecastData = React.useMemo(() => generateForecast(readings, 14), [readings]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={cn(
        "p-4 rounded-xl border shadow-xl backdrop-blur-md max-w-[200px]",
        isDarkMode
          ? "bg-[var(--color-card-bg-dark)]/90 border-[var(--color-border-dark)]"
          : "bg-white/90 border-slate-200"
      )}>
        <p className="text-[10px] font-bold mb-2 opacity-50 truncate">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <p className="text-xs font-semibold truncate">
              {entry.name}: <span className="text-emerald-500">{Math.round(entry.value).toLocaleString()} kW</span>
            </p>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading && !hasInitialLoad) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className={cn(
          "p-5 rounded-2xl border lg:col-span-2 h-[300px] flex flex-col items-center justify-center space-y-4",
          isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200"
        )}>
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 opacity-20" />
          <p className="text-sm font-bold opacity-50">Initializing Analytics Engine…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

      {/* ── System Distribution ─────────────────────────────────── */}
      <div className={cn(
        "p-5 rounded-2xl border",
        isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="mb-4">
          <h3 className="text-base font-bold">System Distribution</h3>
          <p className="text-[10px] opacity-50">kW distribution by plant system</p>
        </div>
        <div className="h-[240px] w-full">
          {areaTrendData.length === 0 ? (
            <div className="h-full flex items-center justify-center opacity-30 text-xs">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={areaTrendData} margin={{ right: 10 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(str) => {
                    try { return format(parseISO(str), 'MMM d'); } catch { return str; }
                  }}
                  tick={{ fontSize: 9, opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  height={55}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                  unit=" kW"
                  width={65}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 10, paddingTop: 12 }}
                />
                {/* Render a Line for EVERY area derived from readings — not just first row keys */}
                {allAreas.map((area, idx) => (
                  <Line
                    key={area}
                    type="monotone"
                    dataKey={area}
                    stroke={COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Top 10 Consumers ────────────────────────────────────── */}
      <div className={cn(
        "p-5 rounded-2xl border",
        isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="mb-4">
          <h3 className="text-base font-bold">Top 10 Consumers</h3>
          <p className="text-[10px] opacity-50">Cumulative kWh consumption</p>
        </div>
        <div className="h-[240px] w-full">
          {stats.topEquipment.length === 0 ? (
            <div className="h-full flex items-center justify-center opacity-30 text-xs">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topEquipment} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                  unit=" kWh"
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 9, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="totalKWh" name="Total Energy" radius={[0, 6, 6, 0]} barSize={16}>
                  {stats.topEquipment.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── AI Load Forecasting ─────────────────────────────────── */}
      <div className={cn(
        "p-5 rounded-2xl border lg:col-span-2",
        isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold">AI Load Forecasting</h3>
            <p className="text-[10px] opacity-50">14-day predictive trend with confidence intervals</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-medium">Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-60" />
              <span className="text-[10px] font-medium">Forecast</span>
            </div>
          </div>
        </div>
        <div className="h-[240px] w-full">
          {forecastData.length === 0 ? (
            <div className="h-full flex items-center justify-center opacity-30 text-xs">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecastData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(str) => {
                    try { return format(parseISO(str), 'MMM d'); } catch { return str; }
                  }}
                  tick={{ fontSize: 10, opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  height={55}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                  unit=" kW"
                />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="upperBound" stroke="transparent" fill="#10b981" fillOpacity={0.1} name="Confidence Band" />
                <Area
                  type="monotone"
                  dataKey="lowerBound"
                  stroke="transparent"
                  fill={isDarkMode ? "var(--color-main-bg-dark)" : "#fff"}
                  fillOpacity={1}
                  name="Lower Bound"
                />
                <Line type="monotone" dataKey="actual" name="Actual Load" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="forecast" name="AI Forecast" stroke="#10b981" strokeWidth={2.5} strokeDasharray="5 5" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
