'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '../utils/cn';
import { format, parseISO, differenceInDays } from 'date-fns';
import { 
  X, Zap, Activity, PhilippinePeso
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ReportElement } from '../types';
import { Logo } from './Logo';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface DraggableElementProps {
  element: ReportElement;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<ReportElement>) => void;
  onRemove: () => void;
  customReport: any;
  readings: any[];
  startDate: string;
  endDate: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  pageNumber?: number;
  totalPages?: number;
}

export const DraggableElement: React.FC<DraggableElementProps> = ({ 
  element, 
  isSelected, 
  onSelect, 
  onUpdate, 
  onRemove,
  customReport,
  readings,
  startDate,
  endDate,
  containerRef,
  pageNumber,
  totalPages
}) => {
  const [localContent, setLocalContent] = useState(element.content || '');
  const quillRef = useRef<any>(null);

  // Sync local content when element changes from outside (but not while typing)
  useEffect(() => {
    if (!isSelected) {
      setLocalContent(element.content || '');
    }
  }, [element.content, isSelected]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = element.x;
    const initialY = element.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const pageHeight = containerRef.current.children[0]?.clientHeight || containerRef.current.offsetHeight;
      const dx = ((moveEvent.clientX - startX) / containerRef.current.offsetWidth) * 100;
      const dy = ((moveEvent.clientY - startY) / pageHeight) * 100;
      onUpdate({ 
        x: Math.max(0, Math.min(100 - element.width, initialX + dx)), 
        y: initialY + dy 
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialW = element.width;
    const initialH = element.height;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const pageHeight = containerRef.current.children[0]?.clientHeight || containerRef.current.offsetHeight;
      const dx = ((moveEvent.clientX - startX) / containerRef.current.offsetWidth) * 100;
      const dy = ((moveEvent.clientY - startY) / pageHeight) * 100;
      onUpdate({ width: Math.max(5, initialW + dx), height: Math.max(2, initialH + dy) });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleQuillChange = (content: string) => {
    setLocalContent(content);
    // Debounce or update on blur is better, but let's try immediate update first with local state
    onUpdate({ content });
  };

  const filteredElementData = useMemo(() => {
    if (element.type !== 'chart' && element.type !== 'table') return [];
    
    const filters = element.filters || {};
    const start = filters.startDate ? parseISO(filters.startDate) : parseISO(startDate);
    const end = filters.endDate ? parseISO(filters.endDate) : parseISO(endDate);
    const selectedAreas = filters.areas || (filters.area && filters.area !== 'All Areas' ? [filters.area] : []);
    const equipment = filters.equipment || [];
    const unit = filters.unit || 'kwh';
    const trend = filters.trendType || 'daily';

    const filtered = readings.filter(r => {
      const readingDate = parseISO(r.timestamp);
      const matchesDate = readingDate >= start && readingDate <= end;
      const matchesArea = selectedAreas.length === 0 || selectedAreas.includes(r.area);
      const matchesEquipment = equipment.length === 0 || equipment.includes(r.equipmentName);
      return matchesDate && matchesArea && matchesEquipment;
    });

    if (element.type === 'table') return filtered;

    const dataMap = new Map<string, any>();
    filtered.forEach(r => {
      const readingDate = parseISO(r.timestamp);
      let key = '';
      if (trend === 'daily') key = format(readingDate, 'yyyy-MM-dd');
      else if (trend === 'monthly') key = format(readingDate, 'yyyy-MM');
      else if (trend === 'yearly') key = format(readingDate, 'yyyy');

      const current = dataMap.get(key) || { name: key, total: 0 };
      const value = unit === 'kwh' ? r.kwh : r.actualKW;
      
      if (equipment.length > 0) {
        current[r.equipmentName] = (current[r.equipmentName] || 0) + value;
      } else if (selectedAreas.length > 0) {
        current[r.area] = (current[r.area] || 0) + value;
      }
      
      current.total = (current.total || 0) + value;
      dataMap.set(key, current);
    });

    return Array.from(dataMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [element.type, element.filters, readings, startDate, endDate]);

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['clean']
    ],
  };

  return (
    <div
      className={cn(
        "absolute group cursor-move select-none",
        isSelected && "ring-2 ring-emerald-500 ring-offset-2 z-20",
        !isSelected && "hover:ring-1 hover:ring-emerald-500/50"
      )}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.width}%`,
        height: `${element.height}%`,
        fontFamily: element.style.fontFamily,
        fontSize: `${element.style.fontSize}px`,
        color: element.style.color,
        fontWeight: element.style.fontWeight,
        textAlign: element.style.textAlign,
        backgroundColor: element.style.backgroundColor,
        padding: `${element.style.padding}px`,
        borderRadius: `${element.style.borderRadius}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {element.type === 'header' && (
         <div 
           className="flex items-center gap-4 w-full h-full border-b-2 pb-2"
           style={{ 
             borderColor: element.style.borderColor || '#10b981',
             borderBottomWidth: `${element.style.borderWidth || 2}px`,
             paddingBottom: `${element.style.paddingBottom || 8}px`
           }}
         >
           <Logo 
             showTagline={false} 
             showText={false} 
             iconClassName="h-10 w-10" 
           />
           <div className="flex-1 min-w-0">
             <h1 
               className="truncate"
               style={{ 
                 fontSize: `${element.style.fontSize || 18}px`,
                 color: element.style.color || '#10b981',
                 fontWeight: element.style.fontWeight || '900',
                 fontFamily: element.style.fontFamily,
                 textAlign: element.style.textAlign || 'left',
                 textTransform: 'uppercase',
                 letterSpacing: '-0.025em'
               }}
             >
               {customReport.reportTitle}
             </h1>
             <p className="text-[6px] font-bold uppercase tracking-[0.2em] opacity-50">WattsUp Energy Intelligence</p>
           </div>
         </div>
      )}
      {element.type === 'footer' && (
         <div 
           className="w-full h-full border-t pt-2 flex items-center justify-center"
           style={{ 
             borderColor: element.style.borderColor || '#e2e8f0',
             borderTopWidth: `${element.style.borderWidth || 1}px`,
             paddingTop: `${element.style.paddingTop || 8}px`
           }}
         >
           <p 
             className="uppercase tracking-widest opacity-30"
             style={{ 
               fontSize: `${element.style.fontSize || 7}px`,
               color: element.style.color || '#0f172a',
               fontWeight: element.style.fontWeight || 'bold',
               fontFamily: element.style.fontFamily,
               textAlign: element.style.textAlign || 'center'
             }}
           >
             {element.content || (pageNumber && totalPages ? `Page ${pageNumber} of ${totalPages}` : `Confidential • WattsUp Intelligence Report • ${new Date().getFullYear()}`)}
           </p>
         </div>
      )}
      {(element.type === 'title' || element.type === 'text') && (
        <div 
          className="w-full h-full relative quill-container prose prose-sm max-w-none"
          style={{ 
            fontSize: `${element.style.fontSize}px`,
            fontFamily: element.style.fontFamily,
            color: element.style.color || '#0f172a',
          }}
        >
          {isSelected ? (
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={localContent || (element.type === 'title' ? customReport.reportTitle : '')}
              onChange={handleQuillChange}
              modules={quillModules}
              className="h-full bg-white text-[#0f172a]"
              placeholder={element.type === 'title' ? "Enter title..." : "Enter text..."}
            />
          ) : (
            <div 
              className="w-full h-full break-words"
              style={{
                textAlign: element.style.textAlign as any,
                fontSize: 'inherit',
                fontFamily: 'inherit',
                color: 'inherit',
              }}
              dangerouslySetInnerHTML={{ __html: localContent || (element.type === 'title' ? customReport.reportTitle : '') }}
            />
          )}
        </div>
      )}
      {element.type === 'author-info' && (
        <div className="grid grid-cols-2 gap-2 w-full h-full bg-slate-50/50 p-2 rounded border border-slate-100">
          <div>
            <p className="text-[6px] uppercase opacity-50 font-bold">Prepared By</p>
            <p className="font-bold truncate">{customReport.name || 'Author Name'}</p>
            <p className="text-[8px] opacity-60 truncate">{customReport.position}</p>
          </div>
          <div className="text-right">
            <p className="text-[6px] uppercase opacity-50 font-bold">Organization</p>
            <p className="font-bold truncate">{customReport.company || 'Company'}</p>
            <p className="text-[8px] opacity-60">{format(new Date(), 'MMM dd, yyyy')}</p>
          </div>
        </div>
      )}
      {element.type === 'chart' && (
        <div className="w-full h-full bg-slate-50 rounded p-2 border border-slate-100 flex flex-col overflow-hidden">
          <p className="text-[8px] font-bold uppercase opacity-50 mb-1 truncate">{element.content?.title || 'Chart'}</p>
          <div className="flex-1 min-h-0">
             <ResponsiveContainer width="100%" height="100%">
               {(() => {
                 const ChartComp = element.filters?.chartType === 'bar' ? BarChart : element.filters?.chartType === 'area' ? AreaChart : LineChart;
                 const filters = element.filters || {};
                 const selectedAreas = filters.areas || (filters.area && filters.area !== 'All Areas' ? [filters.area] : []);
                 const selectedEquip = filters.equipment || [];
                 
                 const keys = selectedEquip.length > 0 
                   ? selectedEquip 
                   : (selectedAreas.length > 0 ? selectedAreas : ['total']);
                 
                 const isTotalView = keys.length === 1 && keys[0] === 'total';

                 return (
                   <ChartComp data={filteredElementData}>
                     <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                     <XAxis dataKey="name" hide />
                     <YAxis fontSize={6} />
                     <Tooltip />
                     {isTotalView ? (
                       element.filters?.chartType === 'bar' ? <Bar dataKey="total" fill="#10b981" /> :
                       element.filters?.chartType === 'area' ? <Area type="monotone" dataKey="total" fill="#10b981" stroke="#10b981" fillOpacity={0.1} /> :
                       <Line type="monotone" dataKey="total" stroke="#10b981" dot={false} />
                     ) : (
                       keys.map((key, idx) => {
                         const color = COLORS[idx % COLORS.length];
                         return element.filters?.chartType === 'bar' ? <Bar key={key} dataKey={key} fill={color} /> :
                         element.filters?.chartType === 'area' ? <Area key={key} type="monotone" dataKey={key} fill={color} stroke={color} fillOpacity={0.1} /> :
                         <Line key={key} type="monotone" dataKey={key} stroke={color} dot={false} />;
                       })
                     )}
                   </ChartComp>
                 );
               })()}
             </ResponsiveContainer>
          </div>
        </div>
      )}
      {element.type === 'table' && (
        <div className="w-full h-full bg-white border border-slate-100 rounded overflow-hidden flex flex-col">
           <p className="text-[8px] font-bold uppercase opacity-50 p-1 bg-slate-50 border-b truncate">{element.content?.title || 'Table'}</p>
           <div className="flex-1 overflow-auto">
              {element.filters?.tableType === 'detailed' ? (
                <table className="w-full text-[6px]">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="opacity-50 uppercase font-bold">
                      <th className="p-1 text-left">Timestamp</th>
                      <th className="p-1 text-left">Equipment</th>
                      <th className="p-1 text-left">Area</th>
                      <th className="p-1 text-right">KW</th>
                      <th className="p-1 text-right">KWh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredElementData.map((row: any, idx: number) => (
                      <tr key={`${row.timestamp}-${row.equipmentName}-${idx}`} className="border-t hover:bg-slate-50">
                        <td className="p-1 opacity-70">{row.timestamp}</td>
                        <td className="p-1 font-bold">{row.equipmentName}</td>
                        <td className="p-1">{row.area}</td>
                        <td className="p-1 text-right text-emerald-600 font-bold">{row.actualKW.toFixed(2)}</td>
                        <td className="p-1 text-right text-blue-600 font-bold">{row.kwh.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-[6px]">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="opacity-50 uppercase font-bold">
                      <th className="p-1 text-left">Equipment</th>
                      <th className="p-1 text-left">Area</th>
                      <th className="p-1 text-right">Total KWh</th>
                      <th className="p-1 text-right">Avg Efficiency</th>
                      <th className="p-1 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const summaryMap = new Map<string, any>();
                      const filters = element.filters || {};
                      const elStart = filters.startDate ? parseISO(filters.startDate) : parseISO(startDate);
                      const elEnd = filters.endDate ? parseISO(filters.endDate) : parseISO(endDate);
                      const elDays = Math.max(1, differenceInDays(elEnd, elStart) + 1);

                      filteredElementData.forEach((r: any) => {
                        const current = summaryMap.get(r.equipmentName) || { 
                          name: r.equipmentName, 
                          area: r.area, 
                          loadSum: 0,
                          efficiencySum: 0, 
                          count: 0 
                        };
                        current.loadSum += r.actualKW;
                        current.efficiencySum += r.efficiencyScore;
                        current.count += 1;
                        summaryMap.set(r.equipmentName, current);
                      });
                      return Array.from(summaryMap.values()).map(eq => {
                        const avgLoad = eq.loadSum / eq.count;
                        const totalKWh = avgLoad * 24 * elDays;
                        const avgEff = eq.efficiencySum / eq.count;
                        
                        return (
                          <tr key={eq.name} className="border-t hover:bg-slate-50">
                            <td className="p-1 font-bold">{eq.name}</td>
                            <td className="p-1 opacity-70">{eq.area}</td>
                            <td className="p-1 text-right font-mono">{totalKWh.toFixed(1)}</td>
                            <td className="p-1 text-right">{avgEff.toFixed(1)}%</td>
                            <td className="p-1 text-center">
                              <span className={cn(
                                "px-1 py-0.5 rounded-full text-[5px] font-bold uppercase",
                                avgEff > 90 ? "bg-emerald-100 text-emerald-600" : 
                                avgEff > 70 ? "bg-blue-100 text-blue-600" : "bg-rose-100 text-rose-600"
                              )}>
                                {avgEff > 90 ? 'Efficient' : avgEff > 70 ? 'Normal' : 'Inefficient'}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              )}
           </div>
        </div>
      )}
      {element.type === 'image' && <img src={element.content} className="w-full h-full object-contain pointer-events-none" />}

      {isSelected && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg z-30"
          >
            <X className="w-3 h-3" />
          </button>
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-30"
            onMouseDown={handleResize}
          >
            <div className="w-2 h-2 bg-emerald-500 rounded-full absolute bottom-0 right-0" />
          </div>
        </>
      )}
    </div>
  );
};
