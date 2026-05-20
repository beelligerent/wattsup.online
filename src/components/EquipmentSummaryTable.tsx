'use client';
import React, { useState, useMemo } from 'react';
import { 
  Search, ArrowUpDown, ArrowUp, ArrowDown, 
  Info, TrendingUp, TrendingDown, LayoutPanelLeft 
} from 'lucide-react';
import { cn } from '../utils/cn';

interface EquipmentSummary {
  name: string;
  actual: number;
  baseline: number;
  variance: number;
  percentDiff: number;
}

interface EquipmentSummaryTableProps {
  data: EquipmentSummary[];
  isDarkMode: boolean;
  selectedArea: string;
}

export const EquipmentSummaryTable: React.FC<EquipmentSummaryTableProps> = ({ 
  data, 
  isDarkMode, 
  selectedArea 
}) => {
  const [sortConfig, setSortConfig] = useState<{ key: keyof EquipmentSummary; direction: 'asc' | 'desc' } | null>({ 
    key: 'actual', 
    direction: 'desc' 
  });
  const [search, setSearch] = useState('');

  const sortedData = useMemo(() => {
    let filtered = [...data];
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(item => item.name.toLowerCase().includes(s));
    }
    if (sortConfig) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [data, search, sortConfig]);

  const handleSort = (key: keyof EquipmentSummary) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <div className={cn(
      "p-6 rounded-3xl border space-y-6",
      isDarkMode ? "bg-slate-900/50 border-white/10" : "bg-white border-slate-100 shadow-sm"
    )}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <LayoutPanelLeft className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Equipment Performance Summary</h3>
            <p className="text-[10px] opacity-40 uppercase tracking-widest">Aggregated metrics for {selectedArea}</p>
          </div>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
          <input
            type="text"
            placeholder="Search equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-9 pr-3 py-2 rounded-xl text-xs border outline-none focus:border-emerald-500 transition-all",
              isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
            )}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-white/5">
              {[
                { label: 'Equipment Name', key: 'name' },
                { label: 'Baseline (kWh)', key: 'baseline' },
                { label: 'Total Consumption (kWh)', key: 'actual' },
                { label: 'Variance', key: 'variance' },
                { label: '% Difference', key: 'percentDiff' }
              ].map(col => (
                <th 
                  key={col.key} 
                  className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest opacity-40 cursor-pointer hover:opacity-100 transition-opacity"
                  onClick={() => handleSort(col.key as keyof EquipmentSummary)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {sortConfig?.key === col.key ? (
                      sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-20" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs">
            {sortedData.map((row, i) => {
              const isHigh = row.actual > data.reduce((acc, curr) => acc + curr.actual, 0) / data.length;
              return (
                <tr 
                  key={i} 
                  className={cn(
                    "border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors",
                    isHigh && (isDarkMode ? "bg-emerald-500/5" : "bg-emerald-50/30")
                  )}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isHigh ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                      )} />
                      <span className="font-bold">{row.name}</span>
                      {isHigh && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[8px] font-bold uppercase">
                          High
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono opacity-60">
                    {row.baseline.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-4 font-mono font-bold text-emerald-500">
                    {row.actual.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className={cn(
                    "px-4 py-4 font-mono font-bold",
                    // Variance = Baseline - Total: negative means over-consuming (red), positive means efficient (green)
                    row.variance < 0 ? "text-rose-500" : "text-emerald-500"
                  )}>
                    {/* Display as Baseline - Total */}
                    {(-row.variance) > 0 ? '+' : ''}{(-row.variance).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-bold flex items-center gap-1",
                        // Over-consuming (actual > baseline) = red; under-consuming = green
                        row.variance < 0 ? "text-rose-500" : "text-emerald-500"
                      )}>
                        {row.variance < 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(row.percentDiff).toFixed(1)}%
                      </span>
                      <div className="flex-1 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden min-w-[60px]">
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            row.variance < 0 ? "bg-rose-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(Math.abs(row.percentDiff), 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center opacity-40 italic">
                  No equipment data found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
