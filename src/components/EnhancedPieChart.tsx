'use client';
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { cn } from '../utils/cn';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

interface PieData {
  name: string;
  value: number;
  percentage: number;
}

interface EnhancedPieChartProps {
  data: PieData[];
  isDarkMode: boolean;
  totalKWh: number;
  limit: number | 'ALL';
  onLimitChange: (limit: number | 'ALL') => void;
}

export const EnhancedPieChart: React.FC<EnhancedPieChartProps> = ({ 
  data, 
  isDarkMode, 
  totalKWh,
  limit,
  onLimitChange
}) => {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  const limits: (number | 'ALL')[] = [5, 10, 15, 'ALL'];

  return (
    <div className={cn(
      "p-6 rounded-3xl border space-y-6 flex flex-col h-full",
      isDarkMode ? "bg-slate-900/50 border-white/10" : "bg-white border-slate-100 shadow-sm"
    )}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Equipment Share</h3>
          <p className="text-[10px] opacity-40 uppercase tracking-widest">Distribution by kWh</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
          {limits.map((l) => (
            <button
              key={l}
              onClick={() => onLimitChange(l)}
              className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                limit === l 
                  ? "bg-emerald-500 text-white shadow-sm" 
                  : "hover:bg-black/5 dark:hover:bg-white/5 opacity-50"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row items-center gap-8 min-h-[400px]">
        {/* Pie Chart on Left */}
        <div className="flex-1 w-full h-full min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="65%"
                outerRadius="90%"
                dataKey="value"
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                paddingAngle={2}
                label={false}
                labelLine={false}
                animationBegin={0}
                animationDuration={500}
                stroke="none"
              >
                {data.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    className={cn(
                      "transition-all duration-300 cursor-pointer outline-none",
                      activeIndex !== null && activeIndex !== index ? "opacity-20 grayscale-[0.5]" : "opacity-100"
                    )}
                  />
                ))}
              </Pie>
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className={cn(
                        "p-4 rounded-2xl border shadow-2xl backdrop-blur-md",
                        isDarkMode ? "bg-slate-800/90 border-white/10" : "bg-white/90 border-slate-100"
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[data.index % COLORS.length] }} />
                          <p className="text-xs font-bold">{data.name}</p>
                        </div>
                        <p className="text-lg font-bold text-emerald-500 font-mono">
                          {data.value.toLocaleString()} <span className="text-[10px] opacity-50">kWh</span>
                        </p>
                        <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                          <p className="text-[10px] opacity-50">
                            Contribution: <span className="font-bold text-current opacity-100">{data.percentage.toFixed(1)}%</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Legend on Right */}
        <div className="flex-1 w-full max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-1">
          {data.map((entry, index) => (
            <div 
              key={entry.name} 
              className={cn(
                "flex items-center justify-between p-2 rounded-xl transition-all group",
                activeIndex === index 
                  ? (isDarkMode ? "bg-white/10" : "bg-slate-50") 
                  : "hover:bg-black/5 dark:hover:bg-white/5"
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                />
                <span className={cn(
                  "text-[11px] font-bold truncate transition-colors",
                  activeIndex === index ? "text-emerald-500" : "opacity-70"
                )}>
                  {entry.name}
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-[11px] font-mono font-bold">
                  {entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[9px] opacity-40 font-sans">kWh</span>
                </span>
                <span className="text-[10px] opacity-30 w-8 text-right">
                  {entry.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
