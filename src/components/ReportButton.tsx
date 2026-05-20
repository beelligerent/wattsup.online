'use client';
import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { cn } from '../utils/cn';

interface ReportButtonProps {
  isDarkMode: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  data?: any[];
  filename: string;
  title: string;
}

export const ReportButton: React.FC<ReportButtonProps> = ({ 
  isDarkMode, 
  contentRef, 
  data, 
  filename, 
  title 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [status, setStatus] = useState<'idle' | 'generating' | 'success'>('idle');

  const generatePDF = async () => {
    if (!contentRef.current) return;
    
    setIsGenerating(true);
    setStatus('generating');
    setShowOptions(false);

    try {
      const element = contentRef.current;
      
      // Use toPng from html-to-image which handles oklch and other modern CSS better
      const dataUrl = await toPng(element, {
        backgroundColor: isDarkMode ? '#020617' : '#F8FAFC',
        quality: 1,
        pixelRatio: 2,
        style: {
          padding: '20px'
        }
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [element.offsetWidth * 2, element.offsetHeight * 2]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, element.offsetWidth * 2, element.offsetHeight * 2);
      pdf.save(`${filename}.pdf`);
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setStatus('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateExcel = () => {
    if (!data || data.length === 0) return;
    
    setIsGenerating(true);
    setStatus('generating');
    setShowOptions(false);

    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report Data');
      
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `${filename}.xlsx`);
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error('Error generating Excel:', error);
      setStatus('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={isGenerating}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg",
          status === 'success' 
            ? "bg-emerald-500 text-white" 
            : isDarkMode 
              ? "bg-white/10 text-white hover:bg-white/20 border border-white/10" 
              : "bg-slate-900 text-white hover:bg-slate-800"
        )}
      >
        {status === 'generating' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : status === 'success' ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {status === 'generating' ? 'Generating...' : status === 'success' ? 'Downloaded' : 'Generate Report'}
      </button>

      {showOptions && !isGenerating && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowOptions(false)} 
          />
          <div className={cn(
            "absolute right-0 mt-2 w-48 rounded-2xl border shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2",
            isDarkMode ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"
          )}>
            <button
              onClick={generatePDF}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors text-left",
                isDarkMode ? "hover:bg-white/5 text-white" : "hover:bg-slate-50 text-slate-900"
              )}
            >
              <FileText className="w-4 h-4 text-rose-500" />
              Download PDF
            </button>
            {data && (
              <button
                onClick={generateExcel}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors text-left",
                  isDarkMode ? "hover:bg-white/5 text-white" : "hover:bg-slate-50 text-slate-900"
                )}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                Download Excel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
