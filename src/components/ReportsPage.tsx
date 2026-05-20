'use client';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { cn } from '../utils/cn';
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInDays, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { 
  PhilippinePeso, Zap, FileText, Download, Save, History, Check, Trash2, Eye, X, 
  Activity, Calendar, TrendingUp, Gauge, AlertTriangle, Clock, Sliders, 
  BarChart3, PieChart as PieChartIcon, Upload, User, Building2, Briefcase, 
  Layout, Type, Plus, Minus, Sparkles, Image as ImageIcon, Settings,
  Bold, Italic, List, AlignLeft, AlignCenter, AlignRight, Type as TypeIcon
} from 'lucide-react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { ReportService } from '../services/ReportService';
import { DataService } from '../services/DataService';
import { SystemSettingsService } from '../services/SystemSettingsService';
import { Logo } from './Logo';
import { getAIInsights } from '../services/AIService';
import { useAuth } from '../auth/AuthContext';
import { DraggableElement } from './DraggableElement';
import { Filters } from './Filters';
import { Report, CostRules, MeterReading, EquipmentSummary, FilterState, ReportElement, CustomReport } from '../types';
import { calculateDetailedCost } from '../utils/EnergyCalculator';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { motion, AnimatePresence } from 'motion/react';

interface ReportsPageProps {
  isDarkMode: boolean;
  costRules: CostRules;
  readings: MeterReading[];
  filteredReadings: MeterReading[];
  stats: any;
  allEquipment: string[];
  allAreas: string[];
  allEquipmentObjects: any[];
  isLoading: boolean;
  refreshData: () => void;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

enum ReportMode {
  STANDARD = 'standard',
  CUSTOM = 'custom'
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

import { useData } from '../DataContext';

import { useStore } from '../store/useStore';

export const ReportsPage: React.FC<ReportsPageProps> = ({ 
  isDarkMode, 
  costRules,
  readings,
  filteredReadings,
  stats,
  allEquipment,
  allAreas,
  allEquipmentObjects,
  isLoading,
  refreshData,
  setFilters
}) => {
  const { appliedDateFilter, setTempDateFilter, applyFilters, hasInitialLoad } = useData();
  const { generalSettings } = useStore();
  const [reportMode, setReportMode] = useState<ReportMode>(ReportMode.STANDARD);
  const [reportTrendPeriod, setReportTrendPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportHistory, setReportHistory] = useState<Report[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Standard Selection State
  const [includeEnergy, setIncludeEnergy] = useState(true);
  const [includeEquipment, setIncludeEquipment] = useState(true);
  const [includeCost, setIncludeCost] = useState(true);
  const [standardAiAnalysis, setStandardAiAnalysis] = useState<string>('');
  const [isStandardAiGenerating, setIsStandardAiGenerating] = useState(false);

  // Use appliedDateFilter for report generation
  const startDate = appliedDateFilter.startDate;
  const endDate = appliedDateFilter.endDate;

  // Custom Report State
  const [customReport, setCustomReport] = useState<CustomReport>({
    logo: '',
    name: '',
    company: '',
    department: '',
    position: '',
    reportTitle: 'Energy Performance Audit Report',
    pages: [
      {
        id: 'page-1',
        elements: [
          {
            id: 'header-1',
            type: 'header',
            x: 0,
            y: 0,
            width: 100,
            height: 15,
            style: { fontSize: 24, fontFamily: 'Inter', color: '#10b981', fontWeight: '900' }
          },
          {
            id: 'author-1',
            type: 'author-info',
            x: 0,
            y: 18,
            width: 100,
            height: 10,
            style: { fontSize: 12, fontFamily: 'Inter', color: '#0f172a' }
          },
          {
            id: 'footer-1',
            type: 'footer',
            x: 0,
            y: 95,
            width: 100,
            height: 5,
            style: { fontSize: 7, fontFamily: 'Inter', color: '#0f172a', fontWeight: 'bold', textAlign: 'center' }
          }
        ] as ReportElement[]
      }
    ]
  });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingElementId, setResizingElementId] = useState<string | null>(null);
  const [resizeType, setResizeType] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [systemLogoUrl, setSystemLogoUrl] = useState<string | null>(null);

  const { profile } = useAuth();

  // Load System Logo
  useEffect(() => {
    if (generalSettings?.logoUrl) {
      setSystemLogoUrl(generalSettings.logoUrl);
    } else {
      setSystemLogoUrl(null);
    }
  }, [generalSettings]);

  // Load Custom Report Template
  useEffect(() => {
    const loadTemplate = async () => {
      if (profile?.uid) {
        const template = await ReportService.getCustomReportTemplate(profile.uid);
        if (template) {
          setCustomReport(template);
          if (template.updatedAt) setLastSaved(new Date(template.updatedAt));
        } else {
          // Default to profile details if no template exists
          setCustomReport(prev => ({
            ...prev,
            name: profile.name || '',
            company: profile.company || '',
            department: profile.department || '',
            position: profile.position || ''
          }));
        }
      }
    };
    loadTemplate();
  }, [profile]);

  // Auto-save Custom Report Template
  useEffect(() => {
    if (reportMode !== ReportMode.CUSTOM || !profile?.uid) return;

    const timer = setTimeout(async () => {
      try {
        await ReportService.saveCustomReportTemplate(profile.uid, customReport);
        setLastSaved(new Date());
      } catch (error) {
        console.error("Auto-save failed:", error);
      }
    }, 3000); // Auto-save after 3 seconds of inactivity

    return () => clearTimeout(timer);
  }, [customReport, profile?.uid, reportMode]);

  const handleSaveTemplate = async () => {
    if (!profile?.uid) return;
    setIsSavingTemplate(true);
    try {
      await ReportService.saveCustomReportTemplate(profile.uid, customReport);
      setLastSaved(new Date());
      setNotification({ type: 'success', message: 'Report template saved successfully' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to save report template' });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const reportContentRef = useRef<HTMLDivElement>(null);
  const customReportRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    if (profile?.uid) {
      const history = await ReportService.getReports(profile.uid);
      setReportHistory(history.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()));
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [profile?.uid]);

  const handleGenerateReport = async () => {
    if (reportMode === ReportMode.STANDARD) {
      if (!includeEnergy && !includeEquipment && !includeCost) {
        setNotification({ type: 'error', message: "Please select at least one section to include in the report." });
        return;
      }
      
      // Generate AI analysis for standard report
      setIsStandardAiGenerating(true);
      try {
        const prompt = `Generate a comprehensive energy performance audit analysis for the period ${startDate} to ${endDate}. 
        Include observations on energy consumption, equipment efficiency, and cost optimization opportunities. 
        The report includes: ${includeEnergy ? 'Energy Consumption, ' : ''}${includeEquipment ? 'Equipment Analysis, ' : ''}${includeCost ? 'Cost Analysis' : ''}.`;
        
        const analysis = await getAIInsights(filteredReadings, stats.allEquipment, prompt);
        setStandardAiAnalysis(analysis.reportText);
      } catch (error) {
        console.error("Standard AI Analysis Error:", error);
        setStandardAiAnalysis("AI analysis could not be generated at this time. Please review the data visualizations for insights.");
      } finally {
        setIsStandardAiGenerating(false);
      }
    }
    setShowPreview(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomReport(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (reportMode !== ReportMode.CUSTOM) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const newElement: ReportElement = {
                id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'image',
                content: event.target?.result as string,
                x: 25,
                y: 25,
                width: 50,
                height: 30,
                style: {}
              };
              setCustomReport(prev => {
                const newPages = [...prev.pages];
                newPages[activePageIndex] = {
                  ...newPages[activePageIndex],
                  elements: [...newPages[activePageIndex].elements, newElement]
                };
                return { ...prev, pages: newPages };
              });
              setSelectedElementId(newElement.id);
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [reportMode, activePageIndex]);

  const generateAiSummary = async () => {
    setIsAiGenerating(true);
    try {
      const prompt = "Generate a concise findings summary for an energy performance report based on the provided data. Focus on key consumption trends and efficiency opportunities.";
      const summary = await getAIInsights(filteredReadings, stats.allEquipment, prompt);
      
      const newElement: ReportElement = {
        id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'text',
        content: summary,
        x: 10,
        y: 50,
        width: 80,
        height: 20,
        style: { fontSize: 12, fontFamily: 'Inter', color: '#0f172a' }
      };

      setCustomReport(prev => {
        const newPages = [...prev.pages];
        newPages[activePageIndex] = {
          ...newPages[activePageIndex],
          elements: [...newPages[activePageIndex].elements, newElement]
        };
        return { ...prev, pages: newPages };
      });
      setSelectedElementId(newElement.id);
    } catch (error) {
      console.error("AI Summary Error:", error);
      setNotification({ type: 'error', message: "Failed to generate AI summary." });
    } finally {
      setIsAiGenerating(false);
    }
  };

  const addPage = () => {
    setCustomReport(prev => {
      const newId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Clone header, footer and author-info from page 1 if they exist
      const firstPage = prev.pages[0];
      const headerFooterElements = firstPage 
        ? firstPage.elements.filter(el => ['header', 'footer', 'author-info'].includes(el.type)) 
        : [];
      
      const clonedElements = headerFooterElements.map((el, idx) => ({
        ...el,
        id: `${el.type}-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`
      }));

      return {
        ...prev,
        pages: [
          ...prev.pages,
          {
            id: newId,
            elements: clonedElements
          }
        ]
      };
    });
    setActivePageIndex(customReport.pages.length);
  };

  const removePage = (index: number) => {
    if (customReport.pages.length <= 1) return;
    setCustomReport(prev => ({
      ...prev,
      pages: prev.pages.filter((_, i) => i !== index)
    }));
    setActivePageIndex(Math.max(0, index - 1));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newElement: ReportElement = {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'image',
          content: reader.result as string,
          x: 25,
          y: 25,
          width: 50,
          height: 30,
          style: {}
        };
        setCustomReport(prev => {
          const newPages = [...prev.pages];
          newPages[activePageIndex] = {
            ...newPages[activePageIndex],
            elements: [...newPages[activePageIndex].elements, newElement]
          };
          return { ...prev, pages: newPages };
        });
        setSelectedElementId(newElement.id);
      };
      reader.readAsDataURL(file);
    }
  };

  const addElement = (type: ReportElement['type'], content?: any) => {
    const newElement: ReportElement = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      x: type === 'footer' ? 0 : 10,
      y: type === 'footer' ? 95 : 30,
      width: type === 'footer' ? 100 : (type === 'chart' ? 80 : 80),
      height: type === 'footer' ? 5 : (type === 'chart' ? 40 : 20),
      filters: (type === 'chart' || type === 'table') ? {
        area: 'All Areas',
        equipment: [],
        startDate: startDate,
        endDate: endDate,
        trendType: 'daily',
        chartType: 'line',
        tableType: 'summary',
        unit: 'kwh'
      } : undefined,
      style: { 
        fontSize: type === 'footer' ? 7 : 12, 
        fontFamily: 'Inter', 
        color: '#0f172a',
        textAlign: type === 'footer' ? 'center' : 'left',
        fontWeight: type === 'footer' ? 'bold' : 'normal'
      }
    };

    setCustomReport(prev => {
      const newPages = [...prev.pages];
      newPages[activePageIndex] = {
        ...newPages[activePageIndex],
        elements: [...newPages[activePageIndex].elements, newElement]
      };
      return { ...prev, pages: newPages };
    });
    setSelectedElementId(newElement.id);
  };

  const updateElement = (id: string, updates: Partial<ReportElement>) => {
    setCustomReport(prev => {
      // Find the current page and element
      let sourcePageIndex = -1;
      let elementIndex = -1;
      
      for (let i = 0; i < prev.pages.length; i++) {
        const idx = prev.pages[i].elements.findIndex(el => el.id === id);
        if (idx !== -1) {
          sourcePageIndex = i;
          elementIndex = idx;
          break;
        }
      }

      if (sourcePageIndex === -1) return prev;

      const element = prev.pages[sourcePageIndex].elements[elementIndex];
      const updatedElement = { ...element, ...updates };
      
      let targetPageIndex = sourcePageIndex;
      let finalY = updatedElement.y;

      // Check if it moved to another page
      if (updates.y !== undefined) {
        // If y > 100, move to next page
        if (updatedElement.y > 100 && sourcePageIndex < prev.pages.length - 1) {
          targetPageIndex = sourcePageIndex + 1;
          finalY = updatedElement.y - 100;
        } 
        // If y < 0, move to previous page
        else if (updatedElement.y < 0 && sourcePageIndex > 0) {
          targetPageIndex = sourcePageIndex - 1;
          finalY = updatedElement.y + 100;
        }
      }

      if (targetPageIndex === sourcePageIndex) {
        // Normal update within same page
        const newPages = [...prev.pages];
        newPages[sourcePageIndex] = {
          ...newPages[sourcePageIndex],
          elements: newPages[sourcePageIndex].elements.map(el => el.id === id ? { ...el, ...updates } : el)
        };
        return { ...prev, pages: newPages };
      } else {
        // Move to another page
        const newPages = [...prev.pages];
        
        // Remove from source
        newPages[sourcePageIndex] = {
          ...newPages[sourcePageIndex],
          elements: newPages[sourcePageIndex].elements.filter(el => el.id !== id)
        };
        
        // Add to target
        newPages[targetPageIndex] = {
          ...newPages[targetPageIndex],
          elements: [...newPages[targetPageIndex].elements, { ...updatedElement, y: finalY }]
        };
        
        // Use a timeout to update the active page index to avoid state update during render issues
        setTimeout(() => setActivePageIndex(targetPageIndex), 0);
        
        return { ...prev, pages: newPages };
      }
    });
  };

  const updateElementStyle = (id: string, styleUpdates: Partial<ReportElement['style']>) => {
    setCustomReport(prev => ({
      ...prev,
      pages: prev.pages.map(page => ({
        ...page,
        elements: page.elements.map(el => el.id === id ? { ...el, style: { ...el.style, ...styleUpdates } } : el)
      }))
    }));
  };

  const removeElement = (id: string) => {
    setCustomReport(prev => ({
      ...prev,
      pages: prev.pages.map(page => ({
        ...page,
        elements: page.elements.filter(el => el.id !== id)
      }))
    }));
    if (selectedElementId === id) setSelectedElementId(null);
  };

   const handleDownloadPdf = async (isCustom: boolean = false) => {
    const ref = isCustom ? customReportRef : reportContentRef;
    if (ref.current) {
      setIsGenerating(true);
      try {
        const element = ref.current;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);
        const availableHeight = pageHeight - (margin * 2) - 10;

        const renderHeaderFooter = (pageNum: number) => {
          if (systemLogoUrl) {
            try {
              pdf.addImage(systemLogoUrl, 'PNG', margin, 6, 12, 12, undefined, 'FAST');
            } catch (e) {
              // Fallback if image fails to load
              pdf.setFillColor(16, 185, 129);
              pdf.roundedRect(margin, 8, 6, 6, 1, 1, 'F');
            }
          } else {
            // Logo Icon (Small Emerald Box) - Fallback
            pdf.setFillColor(16, 185, 129); // Emerald 500
            pdf.roundedRect(margin, 8, 6, 6, 1, 1, 'F');
          }
          
          pdf.setFontSize(10);
          pdf.setTextColor(5, 150, 105); // Emerald 600
          pdf.setFont('helvetica', 'bold');
          pdf.text('WattsUp', margin + (systemLogoUrl ? 14 : 8), 12);
          
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.setFont('helvetica', 'normal');
          pdf.text('Energy Intelligence Generated Report', margin + (systemLogoUrl ? 34 : 28), 12);
          
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.1);
          pdf.line(margin, 15, pageWidth - margin, 15);

          // Footer
          pdf.setFontSize(8);
          pdf.setTextColor(150, 150, 150);
          pdf.text(`Confidential • WattsUp Energy Intelligence • Page ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        };

        if (isCustom) {
          // For custom reports, capture each page element individually
          const pages = Array.from(element.children);
          for (let i = 0; i < pages.length; i++) {
            if (i > 0) pdf.addPage();
            const pageElement = pages[i] as HTMLElement;
            const dataUrl = await toPng(pageElement, {
              backgroundColor: '#ffffff',
              quality: 1,
              pixelRatio: 2,
            });
            pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
          }
        } else {
          // Inject temporary styles for professional PDF look
          const style = document.createElement('style');
          style.id = 'pdf-export-style-reports';
          style.innerHTML = `
            .pdf-export-container-reports {
              background: white !important;
              color: black !important;
              font-family: 'Helvetica', Arial, sans-serif !important;
              width: 800px !important;
              padding: 40px !important;
              border: none !important;
              border-radius: 0 !important;
            }
            .pdf-export-container-reports * {
              color: black !important;
              border-color: #e2e8f0 !important;
            }
            .pdf-export-container-reports .prose h1, 
            .pdf-export-container-reports .prose h2, 
            .pdf-export-container-reports .prose h3 {
              font-size: 20pt !important;
              margin-top: 24px !important;
              margin-bottom: 16px !important;
              color: #059669 !important;
              line-height: 1.4 !important;
            }
            .pdf-export-container-reports .prose p, 
            .pdf-export-container-reports .prose li {
              font-size: 11pt !important;
              line-height: 1.6 !important;
              margin-bottom: 12px !important;
            }
          `;
          document.head.appendChild(style);
          element.classList.add('pdf-export-container-reports');

          const chunks = [
            element.querySelector('.report-header'),
            element.querySelector('.report-section-energy'),
            element.querySelector('.report-section-equipment'),
            element.querySelector('.report-section-cost'),
            element.querySelector('.report-section-analysis'),
            element.querySelector('.report-footer')
          ].filter(Boolean) as HTMLElement[];

          let yOffset = margin + 5;
          let currentPage = 1;
          renderHeaderFooter(currentPage);

          for (const chunk of chunks) {
            const chunkImg = await toPng(chunk, {
              quality: 1,
              backgroundColor: '#ffffff',
              pixelRatio: 2
            });
            
            const props = pdf.getImageProperties(chunkImg);
            const h = (props.height * contentWidth) / props.width;

            if (yOffset + h > pageHeight - margin) {
              if (h > availableHeight) {
                let heightLeft = h;
                let chunkPosition = yOffset;
                pdf.addImage(chunkImg, 'PNG', margin, chunkPosition, contentWidth, h);
                heightLeft -= (pageHeight - chunkPosition - margin);

                while (heightLeft > 0) {
                  currentPage++;
                  pdf.addPage();
                  renderHeaderFooter(currentPage);
                  chunkPosition = margin + 5 - (h - heightLeft);
                  pdf.addImage(chunkImg, 'PNG', margin, chunkPosition, contentWidth, h);
                  heightLeft -= availableHeight;
                }
                yOffset = margin + 5 + (h + heightLeft);
              } else {
                pdf.addPage();
                currentPage++;
                renderHeaderFooter(currentPage);
                yOffset = margin + 5;
                pdf.addImage(chunkImg, 'PNG', margin, yOffset, contentWidth, h);
                yOffset += h + 8;
              }
            } else {
              pdf.addImage(chunkImg, 'PNG', margin, yOffset, contentWidth, h);
              yOffset += h + 8;
            }
          }
          
          element.classList.remove('pdf-export-container-reports');
          style.remove();
        }

        const fileName = isCustom 
          ? `${customReport.reportTitle.replace(/\s+/g, '_')}.pdf`
          : `WattsUp_Report_${startDate}_to_${endDate}.pdf`;
        pdf.save(fileName);
        
        return pdf.output('blob');
      } catch (error) {
        console.error("PDF Generation Error:", error);
        setNotification({ type: 'error', message: `PDF Generation failed: ${error instanceof Error ? error.message : String(error)}` });
      } finally {
        setIsGenerating(false);
      }
    }
    return null;
  };

  const handleSaveReport = async () => {
    if (!profile?.uid) return;
    
    setIsGenerating(true);
    try {
      const blob = await handleDownloadPdf(reportMode === ReportMode.CUSTOM);
      if (!blob) throw new Error("Failed to generate PDF blob");

      const reportId = `report_${Date.now()}`;
      const includedSections = reportMode === ReportMode.STANDARD 
        ? [
            ...(includeEnergy ? ['Energy Consumption'] : []),
            ...(includeEquipment ? ['Equipment Analysis'] : []),
            ...(includeCost ? ['Cost Analysis'] : [])
          ]
        : ['Custom Report'];

      const reportData: Report = {
        id: reportId,
        userId: profile.uid,
        startDate,
        endDate,
        generatedAt: new Date().toISOString(),
        summary: reportMode === ReportMode.STANDARD 
          ? `Performance Audit (${includedSections.join(', ')})`
          : customReport.reportTitle,
        includedSections,
        customReportData: reportMode === ReportMode.CUSTOM ? customReport : undefined
      };

      await ReportService.saveReport(reportData, blob);
      await DataService.addAuditLog('Report Creation', `Report created for period ${startDate} to ${endDate}. Type: ${reportMode === ReportMode.STANDARD ? 'Standard' : 'Custom'}`);
      await fetchHistory();
      setShowPreview(false);
      setNotification({ type: 'success', message: 'Report saved to history and cloud storage!' });
    } catch (error) {
      console.error("Save Report Error:", error);
      setNotification({ type: 'error', message: 'Failed to save report.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    try {
      await ReportService.deleteReport(reportToDelete.id, reportToDelete.storagePath);
      await DataService.addAuditLog('Report Deletion', `Report deleted: ${reportToDelete.summary} (ID: ${reportToDelete.id})`);
      setReportHistory(prev => prev.filter(r => r.id !== reportToDelete.id));
      setNotification({ type: 'success', message: 'Report deleted successfully.' });
      setReportToDelete(null);
    } catch (error) {
      console.error("Delete Error:", error);
      setNotification({ type: 'error', message: 'Failed to delete report.' });
    }
  };

  const formatCurrency = (value: number) => `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const EnergySection = () => {
    const totalKwh = filteredReadings.reduce((s, r) => s + r.kwh, 0);
    const peakKW = filteredReadings.length > 0 ? Math.max(...filteredReadings.map(r => r.actualKW)) : 0;
    const avgLoad = filteredReadings.length > 0 ? filteredReadings.reduce((s, r) => s + r.actualKW, 0) / filteredReadings.length : 0;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const daysInPeriod = Math.max(1, differenceInDays(end, start) + 1);
    const avgKWhPerDay = daysInPeriod > 0 ? totalKwh / daysInPeriod : 0;

    // Aggregate trend data by selected period
    const trendData = (() => {
      if (filteredReadings.length === 0) return [];
      const dataMap = new Map<string, { label: string; totalKWh: number; avgKW: number; count: number }>();

      if (reportTrendPeriod === 'daily') {
        eachDayOfInterval({ start, end }).forEach(d => {
          const key = format(d, 'yyyy-MM-dd');
          dataMap.set(key, { label: format(d, 'MMM dd'), totalKWh: 0, avgKW: 0, count: 0 });
        });
        filteredReadings.forEach(r => {
          const key = format(parseISO(r.timestamp), 'yyyy-MM-dd');
          const entry = dataMap.get(key);
          if (entry) { entry.totalKWh += r.kwh; entry.avgKW += r.actualKW; entry.count++; }
        });
      } else if (reportTrendPeriod === 'weekly') {
        eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).forEach(weekStart => {
          const key = format(weekStart, 'yyyy-ww');
          dataMap.set(key, { label: `W${format(weekStart, 'w MMM dd')}`, totalKWh: 0, avgKW: 0, count: 0 });
        });
        filteredReadings.forEach(r => {
          const ws = startOfWeek(parseISO(r.timestamp), { weekStartsOn: 1 });
          const key = format(ws, 'yyyy-ww');
          const entry = dataMap.get(key);
          if (entry) { entry.totalKWh += r.kwh; entry.avgKW += r.actualKW; entry.count++; }
        });
      } else {
        eachMonthOfInterval({ start: startOfMonth(start), end: endOfMonth(end) }).forEach(m => {
          const key = format(m, 'yyyy-MM');
          dataMap.set(key, { label: format(m, 'MMM yyyy'), totalKWh: 0, avgKW: 0, count: 0 });
        });
        filteredReadings.forEach(r => {
          const key = format(parseISO(r.timestamp), 'yyyy-MM');
          const entry = dataMap.get(key);
          if (entry) { entry.totalKWh += r.kwh; entry.avgKW += r.actualKW; entry.count++; }
        });
      }

      return Array.from(dataMap.values()).map(v => ({
        ...v,
        avgKW: v.count > 0 ? v.avgKW / v.count : 0,
      }));
    })();

    const cardCls = "p-4 rounded-xl bg-[#f8fafc] dark:bg-[var(--color-card-bg-dark)] border border-[#f1f5f9] dark:border-[var(--color-border-dark)]";

    return (
      <div className="report-section-energy space-y-6 py-6 border-b border-[#e2e8f0] dark:border-[var(--color-border-dark)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#10b981]" />
            <h3 className="text-lg font-bold">Energy Consumption Profile</h3>
          </div>
          {/* Trend period selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5">
            {(['daily','weekly','monthly'] as const).map(p => (
              <button key={p} onClick={() => setReportTrendPeriod(p)}
                className={cn('px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all',
                  reportTrendPeriod === p ? 'bg-white dark:bg-slate-800 text-emerald-500 shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className={cardCls}>
            <p className="text-[10px] font-bold opacity-50 uppercase mb-1">Total Consumption</p>
            <p className="text-xl font-bold">{totalKwh.toLocaleString(undefined, {maximumFractionDigits:1})} <span className="text-xs opacity-50">kWh</span></p>
          </div>
          <div className={cardCls}>
            <p className="text-[10px] font-bold opacity-50 uppercase mb-1">Peak Demand</p>
            <p className="text-xl font-bold">{peakKW.toFixed(2)} <span className="text-xs opacity-50">kW</span></p>
          </div>
          <div className={cardCls}>
            <p className="text-[10px] font-bold opacity-50 uppercase mb-1">Avg Load</p>
            <p className="text-xl font-bold">{avgLoad.toFixed(2)} <span className="text-xs opacity-50">kW</span></p>
          </div>
          <div className={cardCls}>
            <p className="text-[10px] font-bold opacity-50 uppercase mb-1">Avg Daily</p>
            <p className="text-xl font-bold">{avgKWhPerDay.toFixed(1)} <span className="text-xs opacity-50">kWh/day</span></p>
          </div>
        </div>

        <div className="h-[280px] w-full bg-[#f8fafc] dark:bg-[var(--color-card-bg-dark)] rounded-2xl p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="rpt-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
              <XAxis dataKey="label" fontSize={9} axisLine={false} tickLine={false}
                tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }} interval="preserveStartEnd" />
              <YAxis fontSize={9} axisLine={false} tickLine={false}
                tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(Math.round(v))} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: isDarkMode ? '#1e293b' : '#fff', fontSize: 11 }}
                formatter={(v: number, name: string) => [`${v.toLocaleString(undefined,{maximumFractionDigits:1})} ${name === 'totalKWh' ? 'kWh' : 'kW'}`, name === 'totalKWh' ? 'Consumption' : 'Avg Load']}
                labelFormatter={(l) => l}
              />
              <Area type="monotone" dataKey="totalKWh" name="totalKWh" stroke="#10b981" strokeWidth={2} fill="url(#rpt-grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] opacity-40 text-center">Trend aggregated {reportTrendPeriod} — {format(start, 'MMM dd, yyyy')} to {format(end, 'MMM dd, yyyy')} ({daysInPeriod} days)</p>
      </div>
    );
  };

  const EquipmentSection = () => (
    <div className="report-section-equipment space-y-6 py-6 border-b border-[#e2e8f0] dark:border-[var(--color-border-dark)]">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-[#3b82f6]" />
        <h3 className="text-lg font-bold">Equipment Performance Analysis</h3>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#e2e8f0] dark:border-[var(--color-border-dark)]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f8fafc] dark:bg-[var(--color-table-header-dark)] font-bold uppercase opacity-50">
            <tr>
              <th className="p-3">Equipment</th>
              <th className="p-3">Area</th>
              <th className="p-3">Total kWh</th>
              <th className="p-3">Efficiency</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {stats.allEquipment.slice(0, 8).map((eq, idx) => (
              <tr key={`${eq.name}-${idx}`} className="border-t border-[#f1f5f9] dark:border-[var(--color-border-dark)]">
                <td className="p-3 font-bold">{eq.name}</td>
                <td className="p-3 opacity-70">{eq.area}</td>
                <td className="p-3 font-mono">{eq.totalKWh.toFixed(1)}</td>
                <td className="p-3">{eq.avgEfficiency.toFixed(1)}%</td>
                <td className="p-3">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                    eq.efficiencyStatus === 'Efficient' ? "bg-[#10b9811a] text-[#10b981]" : 
                    eq.efficiencyStatus === 'Normal' ? "bg-[#3b82f61a] text-[#3b82f6]" : "bg-[#ef44441a] text-[#ef4444]"
                  )}>
                    {eq.efficiencyStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const CostSection = () => {
    const avgLoad = filteredReadings.length > 0 ? filteredReadings.reduce((sum, r) => sum + r.actualKW, 0) / filteredReadings.length : 0;
    const avgKWh = avgLoad * 24;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const daysInPeriod = Math.max(1, differenceInDays(end, start) + 1);
    const totalKwh = avgKWh * daysInPeriod;
    const costDetails = calculateDetailedCost(totalKwh, stats.maxDemand, costRules);
    
    const pieData = stats.allEquipment.slice(0, 5).map(eq => ({
      name: eq.name,
      value: eq.totalKWh * costRules.energyPrice
    }));

    return (
      <div className="report-section-cost space-y-6 py-6">
        <div className="flex items-center gap-2 mb-4">
          <PhilippinePeso className="w-5 h-5 text-[#f59e0b]" />
          <h3 className="text-lg font-bold">Cost & Financial Analysis</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-5 rounded-2xl bg-[#10b9810d] border border-[#10b9811a]">
            <p className="text-[10px] font-bold text-[#10b981] uppercase mb-1">Total Energy Cost</p>
            <p className="text-2xl font-bold">{formatCurrency(costDetails.totalCost)}</p>
          </div>
          <div className={cn(
            "p-5 rounded-2xl border",
            costDetails.totalCost > costRules.monthlyBudget ? "bg-[#ef44440d] border-[#ef44441a]" : "bg-[#3b82f60d] border-[#3b82f61a]"
          )}>
            <p className={cn("text-[10px] font-bold uppercase mb-1", costDetails.totalCost > costRules.monthlyBudget ? "text-[#ef4444]" : "text-[#3b82f6]")}>Budget Utilization</p>
            <p className="text-2xl font-bold">{((costDetails.totalCost / costRules.monthlyBudget) * 100).toFixed(1)}%</p>
          </div>
        </div>
        <div className="flex items-center gap-8 bg-[#f8fafc] dark:bg-[var(--color-card-bg-dark)] rounded-2xl p-6">
          <div className="w-1/2 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-1/2 space-y-2">
            <h4 className="text-xs font-bold opacity-50 uppercase mb-2">Top Cost Centers</h4>
            {pieData.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="opacity-70">{item.name}</span>
                </div>
                <span className="font-bold">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const AnalysisSection = () => (
    <div className="report-section-analysis space-y-6 py-6 border-t border-[#e2e8f0] dark:border-[var(--color-border-dark)]">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-emerald-500" />
        <h3 className="text-lg font-bold">AI-Powered Audit Analysis</h3>
      </div>
      {isStandardAiGenerating ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
          <Clock className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-sm font-medium text-emerald-600">Generating comprehensive audit analysis...</p>
        </div>
      ) : (
        <div className="p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
            {standardAiAnalysis}
          </div>
        </div>
      )}
    </div>
  );

  if (isLoading && !hasInitialLoad) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm font-bold opacity-50">Initializing Reports Engine...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border",
              notification.type === 'success' 
                ? (isDarkMode ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-emerald-50 border-emerald-100 text-emerald-600")
                : (isDarkMode ? "bg-rose-500/10 border-rose-500/20 text-rose-500" : "bg-rose-50 border-rose-100 text-rose-600")
            )}
          >
            {notification.type === 'success' ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <p className="text-sm font-bold">{notification.message}</p>
          </motion.div>
        )}

        {reportToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReportToDelete(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "relative w-full max-w-md border rounded-3xl p-8 shadow-2xl",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200"
              )}
            >
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6 border border-rose-500/20">
                <Trash2 className="text-rose-500 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Delete Report?</h3>
              <p className="text-sm opacity-50 mb-8">
                Are you sure you want to delete this report? This will also remove it from cloud storage. This action cannot be undone.
              </p>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setReportToDelete(null)}
                  className={cn(
                    "flex-1 px-6 py-3 rounded-xl font-bold transition-all",
                    isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteReport}
                  className="flex-1 px-6 py-3 bg-rose-500 text-white rounded-xl font-bold shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all flex items-center justify-center gap-2"
                >
                  Delete Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight uppercase">Reports Engine</h2>
          <div className={cn(
            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
            isDarkMode ? "bg-emerald-500/10 text-emerald-500" : "bg-emerald-100 text-emerald-600"
          )}>
            
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Filters isDarkMode={isDarkMode} />
          <div className={cn(
            "flex p-1 rounded-xl",
            isDarkMode ? "bg-white/5" : "bg-slate-100"
          )}>
            <button
              onClick={() => setReportMode(ReportMode.STANDARD)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                reportMode === ReportMode.STANDARD
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              Standard
            </button>
            <button
              onClick={() => setReportMode(ReportMode.CUSTOM)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                reportMode === ReportMode.CUSTOM
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              Custom Builder
            </button>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all",
              showHistory ? "bg-emerald-500 text-white" : (isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200")
            )}
          >
            <History className="w-4 h-4" />
            {showHistory ? "Hide History" : "View History"}
          </button>
        </div>
      </div>

      {reportMode === ReportMode.STANDARD ? (
        <>
          {/* Configuration Card */}
          <div className={cn(
            "rounded-3xl p-6 border",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
          )}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold mb-1">Report Parameters</h3>
                  <p className="text-xs opacity-50">Configure the scope and timeframe of your energy audit</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold opacity-40 uppercase ml-1">Report Period</label>
                    <div className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-xs flex items-center gap-2",
                      isDarkMode 
                        ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    )}>
                      <Calendar className="w-4 h-4 opacity-40" />
                      <span>{format(parseISO(startDate), 'MMM dd, yyyy')} - {format(parseISO(endDate), 'MMM dd, yyyy')}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold opacity-40 uppercase ml-1">Include Sections</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'energy', label: 'Energy Consumption', state: includeEnergy, setter: setIncludeEnergy, icon: Zap },
                      { id: 'equipment', label: 'Equipment Analysis', state: includeEquipment, setter: setIncludeEquipment, icon: Activity },
                      { id: 'cost', label: 'Cost Analysis', state: includeCost, setter: setIncludeCost, icon: PhilippinePeso },
                    ].map(section => (
                      <button
                        key={section.id}
                        onClick={() => section.setter(!section.state)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border transition-all text-left",
                          section.state 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" 
                            : (isDarkMode ? "bg-white/5 border-white/10 opacity-50" : "bg-slate-50 border-slate-200 opacity-50")
                        )}
                      >
                        <section.icon className="w-4 h-4 shrink-0" />
                        <span className="text-[10px] font-bold leading-tight">{section.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center items-center p-8 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-4">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-lg font-bold mb-2">Generate Audit</h4>
                <p className="text-xs opacity-60 max-w-[240px] mb-6">Create a comprehensive PDF report with data visualizations and cost breakdowns.</p>
                <button
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="w-full max-w-[200px] bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGenerating ? <Clock className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {isGenerating ? "Processing..." : "Generate Preview"}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Top: Customization Form */}
          <div className={cn(
            "rounded-3xl p-8 border flex flex-col gap-8",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
          )}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Basic Info & Pages */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-lg font-bold">Report Structure</h3>
                  </div>
                  <button
                    onClick={addPage}
                    className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all"
                    title="Add Page"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Page Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  {customReport.pages.map((page, idx) => (
                    <div key={page.id} className="relative group">
                      <button
                        onClick={() => setActivePageIndex(idx)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                          activePageIndex === idx
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                            : isDarkMode ? "bg-white/5 text-white/50 hover:bg-white/10" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        Page {idx + 1}
                      </button>
                      {customReport.pages.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removePage(idx); }}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Minus className="w-2 h-2" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold opacity-40 uppercase ml-1">Report Title</label>
                  <input
                    type="text"
                    value={customReport.reportTitle}
                    onChange={(e) => setCustomReport(prev => ({ ...prev, reportTitle: e.target.value }))}
                    className={cn(
                      "w-full border rounded-xl py-2.5 px-4 text-xs outline-none focus:border-emerald-500 transition-colors",
                      isDarkMode 
                        ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                </div>
              </div>

              {/* Add Elements Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-lg font-bold">Add Content</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => addElement('header', 'Report Header')} 
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-all text-[10px] font-bold",
                      isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white/70 hover:bg-[var(--color-card-bg-dark)]" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <Layout className="w-4 h-4 text-emerald-500" /> Add Header
                  </button>
                  <button 
                    onClick={() => addElement('footer', 'Report Footer')} 
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-all text-[10px] font-bold",
                      isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white/70 hover:bg-[var(--color-card-bg-dark)]" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <Layout className="w-4 h-4 text-emerald-500" /> Add Footer
                  </button>
                  <button 
                    onClick={() => addElement('title', 'New Title')} 
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-all text-[10px] font-bold",
                      isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white/70 hover:bg-[var(--color-card-bg-dark)]" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <Type className="w-4 h-4 text-emerald-500" /> Add Title
                  </button>
                  <button 
                    onClick={() => addElement('text', 'Enter your text here...')} 
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-all text-[10px] font-bold",
                      isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white/70 hover:bg-[var(--color-card-bg-dark)]" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <FileText className="w-4 h-4 text-emerald-500" /> Add Text
                  </button>
                  <button 
                    onClick={() => addElement('chart', { id: 'energy-trend', title: 'Energy Consumption Trend' })} 
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-all text-[10px] font-bold",
                      isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white/70 hover:bg-[var(--color-card-bg-dark)]" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <BarChart3 className="w-4 h-4 text-emerald-500" /> Add Chart
                  </button>
                  <button 
                    onClick={() => addElement('table', { id: 'equip-table', title: 'Equipment Summary Table' })} 
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-all text-[10px] font-bold",
                      isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white/70 hover:bg-[var(--color-card-bg-dark)]" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <Layout className="w-4 h-4 text-emerald-500" /> Add Table
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logo-upload-stacked" />
                    <label htmlFor="logo-upload-stacked" className={cn(
                      "flex items-center justify-center gap-2 w-full border border-dashed rounded-xl py-2.5 px-4 text-[10px] font-bold cursor-pointer hover:bg-emerald-500/5 hover:border-emerald-500/30 transition-all",
                      isDarkMode 
                        ? "bg-white/5 border-white/20 text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    )}>
                      <Upload className="w-3.5 h-3.5" /> Logo
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id="photo-upload-stacked" />
                    <label htmlFor="photo-upload-stacked" className={cn(
                      "flex items-center justify-center gap-2 w-full border border-dashed rounded-xl py-2.5 px-4 text-[10px] font-bold cursor-pointer hover:bg-emerald-500/5 hover:border-emerald-500/30 transition-all",
                      isDarkMode 
                        ? "bg-white/5 border-white/20 text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    )}>
                      <ImageIcon className="w-3.5 h-3.5" /> Photo
                    </label>
                  </div>
                </div>
              </div>

              {/* Author & Actions Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-lg font-bold">Author Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={customReport.name}
                    onChange={(e) => setCustomReport(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Author Name"
                    className={cn(
                      "w-full border rounded-xl py-2 px-3 text-[10px] outline-none focus:border-emerald-500 transition-colors",
                      isDarkMode 
                        ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                  <input
                    type="text"
                    value={customReport.company}
                    onChange={(e) => setCustomReport(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Company"
                    className={cn(
                      "w-full border rounded-xl py-2 px-3 text-[10px] outline-none focus:border-emerald-500 transition-colors",
                      isDarkMode 
                        ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                  <input
                    type="text"
                    value={customReport.department}
                    onChange={(e) => setCustomReport(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="Department"
                    className={cn(
                      "w-full border rounded-xl py-2 px-3 text-[10px] outline-none focus:border-emerald-500 transition-colors",
                      isDarkMode 
                        ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                  <input
                    type="text"
                    value={customReport.position}
                    onChange={(e) => setCustomReport(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="Position"
                    className={cn(
                      "w-full border rounded-xl py-2 px-3 text-[10px] outline-none focus:border-emerald-500 transition-colors",
                      isDarkMode 
                        ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)] text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    )}
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={isSavingTemplate}
                    className="flex items-center gap-2 text-[10px] font-bold text-blue-500 hover:text-blue-400 transition-colors uppercase tracking-wider"
                  >
                    {isSavingTemplate ? <Clock className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {isSavingTemplate ? 'Saving...' : 'Save Template'}
                  </button>
                  <button
                    onClick={generateAiSummary}
                    disabled={isAiGenerating}
                    className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-wider"
                  >
                    {isAiGenerating ? <Clock className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Summary
                  </button>
                  <button
                    onClick={() => handleDownloadPdf(true)}
                    disabled={isGenerating}
                    className="bg-emerald-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-2 text-[10px] uppercase"
                  >
                    {isGenerating ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Generate
                  </button>
                </div>
                {lastSaved && (
                  <p className="text-[8px] opacity-40 text-right mt-1 italic">
                    Last saved: {format(lastSaved, 'HH:mm:ss')}
                  </p>
                )}
              </div>
            </div>

            {/* Element Styling Controls (Full Width when active) */}
            {selectedElementId && (
              <div className="p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-6 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-emerald-600" />
                    <h4 className="text-sm font-bold uppercase text-emerald-600">Element Customization</h4>
                  </div>
                  <button onClick={() => setSelectedElementId(null)} className="text-[10px] opacity-40 hover:opacity-100 font-bold uppercase">Close Editor</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold opacity-40 uppercase">Font Family</label>
                    <select
                      value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.style.fontFamily || ''}
                      onChange={(e) => updateElementStyle(selectedElementId, { fontFamily: e.target.value })}
                      className={cn(
                        "w-full bg-white dark:bg-[var(--color-main-bg-dark)] border border-black/5 dark:border-[var(--color-border-dark)] rounded-lg py-2 px-3 text-xs outline-none",
                        isDarkMode ? "text-white" : "text-slate-900"
                      )}
                    >
                      <option value="Inter">Inter (Sans)</option>
                      <option value="Georgia">Georgia (Serif)</option>
                      <option value="JetBrains Mono">JetBrains Mono</option>
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold opacity-40 uppercase">Font Size</label>
                    <input
                      type="number"
                      value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.style.fontSize || 0}
                      onChange={(e) => updateElementStyle(selectedElementId, { fontSize: parseInt(e.target.value) })}
                      className={cn(
                        "w-full bg-white dark:bg-[var(--color-main-bg-dark)] border border-black/5 dark:border-[var(--color-border-dark)] rounded-lg py-2 px-3 text-xs outline-none",
                        isDarkMode ? "text-white" : "text-slate-900"
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold opacity-40 uppercase">Text Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.style.color || '#000000'}
                        onChange={(e) => updateElementStyle(selectedElementId, { color: e.target.value })}
                        className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent"
                      />
                      <span className="text-xs font-mono opacity-50 uppercase">{customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.style.color}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold opacity-40 uppercase">Alignment</label>
                    <div className="flex border border-black/5 dark:border-[var(--color-border-dark)] rounded-xl overflow-hidden">
                      {(['left', 'center', 'right', 'justify'] as const).map(align => (
                        <button
                          key={align}
                          onClick={() => updateElementStyle(selectedElementId, { textAlign: align })}
                          className={cn(
                            "flex-1 py-2 text-[10px] capitalize transition-colors",
                            customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.style.textAlign === align 
                              ? "bg-emerald-500 text-white" 
                              : isDarkMode ? "bg-white/5 text-white/50" : "bg-white text-slate-500"
                          )}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.type === 'header' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-black/5 dark:border-[var(--color-border-dark)]">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold opacity-40 uppercase">Line Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.style.borderColor || '#10b981'}
                          onChange={(e) => updateElementStyle(selectedElementId, { borderColor: e.target.value })}
                          className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent"
                        />
                        <span className="text-xs font-mono opacity-50 uppercase">{customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.style.borderColor || '#10b981'}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold opacity-40 uppercase">Line Thickness</label>
                      <input
                        type="number"
                        value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.style.borderWidth || 2}
                        onChange={(e) => updateElementStyle(selectedElementId, { borderWidth: parseInt(e.target.value) })}
                        className={cn(
                          "w-full bg-white dark:bg-[var(--color-main-bg-dark)] border border-black/5 dark:border-[var(--color-border-dark)] rounded-lg py-2 px-3 text-xs outline-none",
                          isDarkMode ? "text-white" : "text-slate-900"
                        )}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold opacity-40 uppercase">Line Spacing</label>
                      <input
                        type="number"
                        value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.style.paddingBottom || 8}
                        onChange={(e) => updateElementStyle(selectedElementId, { paddingBottom: parseInt(e.target.value) })}
                        className={cn(
                          "w-full bg-white dark:bg-[var(--color-main-bg-dark)] border border-black/5 dark:border-[var(--color-border-dark)] rounded-lg py-2 px-3 text-xs outline-none",
                          isDarkMode ? "text-white" : "text-slate-900"
                        )}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.type === 'text' && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold opacity-40 uppercase">Edit Text Content</label>
                      <textarea
                        value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.content || ''}
                        onChange={(e) => updateElement(selectedElementId, { content: e.target.value })}
                        className={cn(
                          "w-full bg-white dark:bg-[var(--color-main-bg-dark)] border border-black/5 dark:border-[var(--color-border-dark)] rounded-xl py-3 px-4 text-xs min-h-[120px] outline-none focus:border-emerald-500 transition-colors",
                          isDarkMode ? "text-white" : "text-slate-900"
                        )}
                      />
                    </div>
                  )}

                  {(customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.type === 'chart' || 
                    customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.type === 'table') && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold uppercase text-emerald-600">Data Filters</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold opacity-40 uppercase">Trend</label>
                          <select
                            value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.filters?.trendType || ''}
                            onChange={(e) => {
                              const el = customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId);
                              updateElement(selectedElementId, { filters: { ...el?.filters, trendType: e.target.value as any } });
                            }}
                            className={cn(
                              "w-full bg-white dark:bg-[var(--color-main-bg-dark)] border border-black/5 dark:border-[var(--color-border-dark)] rounded-lg py-2 px-3 text-xs outline-none",
                              isDarkMode ? "text-white" : "text-slate-900"
                            )}
                          >
                            <option value="daily">Daily</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold opacity-40 uppercase">Unit</label>
                          <select
                            value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.filters?.unit || ''}
                            onChange={(e) => {
                              const el = customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId);
                              updateElement(selectedElementId, { filters: { ...el?.filters, unit: e.target.value as any } });
                            }}
                            className={cn(
                              "w-full bg-white dark:bg-[var(--color-main-bg-dark)] border border-black/5 dark:border-[var(--color-border-dark)] rounded-lg py-2 px-3 text-xs outline-none",
                              isDarkMode ? "text-white" : "text-slate-900"
                            )}
                          >
                            <option value="kwh">KWh</option>
                            <option value="kw">KW</option>
                          </select>
                        </div>

                        {customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.type === 'chart' && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold opacity-40 uppercase">Chart Type</label>
                            <select
                              value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.filters?.chartType || ''}
                              onChange={(e) => {
                                const el = customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId);
                                updateElement(selectedElementId, { filters: { ...el?.filters, chartType: e.target.value as any } });
                              }}
                              className={cn(
                                "w-full bg-white dark:bg-[var(--color-main-bg-dark)] border border-black/5 dark:border-[var(--color-border-dark)] rounded-lg py-2 px-3 text-xs outline-none",
                                isDarkMode ? "text-white" : "text-slate-900"
                              )}
                            >
                              <option value="line">Line</option>
                              <option value="bar">Bar</option>
                              <option value="area">Area</option>
                            </select>
                          </div>
                        )}

                        {customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.type === 'table' && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold opacity-40 uppercase">Table Type</label>
                            <select
                              value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.filters?.tableType || ''}
                              onChange={(e) => {
                                const el = customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId);
                                updateElement(selectedElementId, { filters: { ...el?.filters, tableType: e.target.value as any } });
                              }}
                              className={cn(
                                "w-full bg-white dark:bg-[var(--color-main-bg-dark)] border border-black/5 dark:border-[var(--color-border-dark)] rounded-lg py-2 px-3 text-xs outline-none",
                                isDarkMode ? "text-white" : "text-slate-900"
                              )}
                            >
                              <option value="summary">Equipment Summary</option>
                              <option value="detailed">Detailed Readings</option>
                            </select>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold opacity-40 uppercase">Start Date</label>
                          <input
                            type="date"
                            value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.filters?.startDate || ''}
                            onChange={(e) => {
                              const el = customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId);
                              updateElement(selectedElementId, { filters: { ...el?.filters, startDate: e.target.value } });
                            }}
                            className={cn(
                              "w-full bg-white dark:bg-[var(--color-main-bg-dark)] border border-black/5 dark:border-[var(--color-border-dark)] rounded-lg py-2 px-3 text-xs outline-none",
                              isDarkMode ? "text-white" : "text-slate-900"
                            )}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold opacity-40 uppercase">End Date</label>
                          <input
                            type="date"
                            value={customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId)?.filters?.endDate || ''}
                            onChange={(e) => {
                              const el = customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId);
                              updateElement(selectedElementId, { filters: { ...el?.filters, endDate: e.target.value } });
                            }}
                            className={cn(
                              "w-full bg-white dark:bg-[var(--color-main-bg-dark)] border border-black/5 dark:border-[var(--color-border-dark)] rounded-lg py-2 px-3 text-xs outline-none",
                              isDarkMode ? "text-white" : "text-slate-900"
                            )}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold opacity-40 uppercase">Area Filter (Multi-select)</label>
                          <div className={cn(
                            "max-h-40 overflow-y-auto border border-black/5 dark:border-[var(--color-border-dark)] rounded-xl p-3 space-y-2",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)]" : "bg-white"
                          )}>
                            {allAreas.length === 0 ? (
                              <p className="text-[10px] opacity-50 italic py-2">No areas found</p>
                            ) : allAreas.map((area, aIdx) => {
                              const el = customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId);
                              const selectedAreas = el?.filters?.areas || (el?.filters?.area && el?.filters?.area !== 'All Areas' ? [el?.filters?.area] : []);
                              
                              return (
                                <label key={`${area}-${aIdx}`} className="flex items-center gap-2 cursor-pointer group">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedAreas.includes(area)}
                                    onChange={() => {
                                      const newList = selectedAreas.includes(area)
                                        ? selectedAreas.filter(i => i !== area)
                                        : [...selectedAreas, area];
                                      updateElement(selectedElementId, { 
                                        filters: { ...el?.filters, areas: newList, area: undefined } 
                                      });
                                    }}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                  />
                                  <span className="text-xs opacity-70 group-hover:opacity-100 transition-opacity">{area}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-bold opacity-40 uppercase">Equipment Filter (Multi-select)</label>
                          <div className={cn(
                            "max-h-40 overflow-y-auto border border-black/5 dark:border-[var(--color-border-dark)] rounded-xl p-3 space-y-2",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)]" : "bg-white"
                          )}>
                            {(() => {
                              const el = customReport.pages[activePageIndex].elements.find(el => el.id === selectedElementId);
                              const selectedAreas = el?.filters?.areas || (el?.filters?.area && el?.filters?.area !== 'All Areas' ? [el?.filters?.area] : []);
                              
                              // Use allEquipmentObjects if available, otherwise fallback to stats.allEquipment
                              const sourceList = allEquipmentObjects.length > 0 ? allEquipmentObjects : stats.allEquipment;
                              
                              const equipmentList = selectedAreas.length === 0 
                                ? sourceList
                                : sourceList.filter(e => selectedAreas.includes(e.area));
                              
                              const selectedEquip = el?.filters?.equipment || [];

                              if (equipmentList.length === 0) {
                                return <p className="text-[10px] opacity-50 italic py-2">No equipment found {selectedAreas.length > 0 ? 'for selected areas' : ''}</p>;
                              }

                              return equipmentList.map((eq, eqIdx) => (
                                <label key={`${eq.name}-${eqIdx}`} className="flex items-center gap-2 cursor-pointer group">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedEquip.includes(eq.name)}
                                    onChange={() => {
                                      const newList = selectedEquip.includes(eq.name)
                                        ? selectedEquip.filter(i => i !== eq.name)
                                        : [...selectedEquip, eq.name];
                                      updateElement(selectedElementId, { 
                                        filters: { ...el?.filters, equipment: newList } 
                                      });
                                    }}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                  />
                                  <span className="text-xs opacity-70 group-hover:opacity-100 transition-opacity">{eq.name}</span>
                                </label>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom: Real-time Preview */}
          <div className={cn(
            "rounded-3xl border overflow-hidden flex flex-col min-h-[800px]",
            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-100 border-slate-200"
          )}>
            <div className={cn(
              "p-4 border-b flex items-center justify-between",
              isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200"
            )}>
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-50">Live Preview</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold opacity-40 uppercase">A4 Format</span>
              </div>
            </div>
            
            <div className={cn(
              "flex-1 p-12",
              isDarkMode ? "bg-slate-800" : "bg-slate-200"
            )}>
              <div 
                ref={customReportRef}
                className="flex flex-col gap-12 w-full mx-auto"
                onMouseDown={() => setSelectedElementId(null)}
              >
                {customReport.pages.map((page, pIdx) => (
                  <div 
                    key={`report-page-${page.id || pIdx}-${pIdx}`}
                    className={cn(
                      "w-full aspect-[1/1.414] bg-white shadow-2xl mx-auto p-10 relative overflow-hidden",
                      "text-[#0f172a]" // Force light text for PDF preview
                    )}
                  >
                    {/* Page Number */}
                    <div className="absolute top-4 right-4 text-[8px] font-bold opacity-20">PAGE {pIdx + 1}</div>

                    {/* Render Elements */}
                    {page.elements.map((element, eIdx) => (
                      <DraggableElement
                        key={`element-${element.id}-${pIdx}-${eIdx}`}
                        element={element}
                        isSelected={selectedElementId === element.id}
                        onSelect={() => setSelectedElementId(element.id)}
                        onUpdate={(updates) => updateElement(element.id, updates)}
                        onRemove={() => removeElement(element.id)}
                        customReport={customReport}
                        readings={readings}
                        startDate={startDate}
                        endDate={endDate}
                        containerRef={customReportRef}
                        pageNumber={pIdx + 1}
                        totalPages={customReport.pages.length}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Section */}
      {showHistory && (
        <div className={cn(
          "rounded-3xl p-6 border animate-in slide-in-from-top-4",
          isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold uppercase tracking-wider opacity-50">Archived Reports</h3>
            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportHistory.length === 0 ? (
              <div className="col-span-full py-12 text-center opacity-30">
                <History className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">No reports generated yet.</p>
              </div>
            ) : (
              reportHistory.map((report, idx) => (
                <div key={`archived-report-${report.id || idx}-${idx}`} className="p-4 rounded-2xl border border-slate-200 dark:border-[var(--color-border-dark)] bg-slate-50 dark:bg-[var(--color-main-bg-dark)] space-y-3 group">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1">
                      {report.customReportData && (
                        <button 
                          onClick={() => {
                            setCustomReport(report.customReportData!);
                            setReportMode(ReportMode.CUSTOM);
                            setTempDateFilter({
                              startDate: report.startDate,
                              endDate: report.endDate,
                              type: 'custom'
                            });
                            applyFilters();
                            setShowHistory(false);
                            setNotification({ type: 'success', message: 'Report loaded into custom builder' });
                          }}
                          className="p-2 hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-colors"
                          title="Edit in Custom Builder"
                        >
                          <Layout className="w-4 h-4" />
                        </button>
                      )}
                      {report.downloadUrl && (
                        <a 
                          href={report.downloadUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button 
                        onClick={() => setReportToDelete(report)}
                        className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold truncate">{report.summary}</p>
                    <p className="text-[10px] opacity-50">{format(parseISO(report.generatedAt), 'MMMM dd, yyyy • HH:mm')}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {report.includedSections?.map((s, sIdx) => (
                      <span key={`${s}-${sIdx}`} className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase",
                        isDarkMode ? "bg-[var(--color-border-dark)]/30 text-white/70" : "bg-slate-100 text-slate-600"
                      )}>{s}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={cn(
            "w-full max-w-7xl max-h-[95vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl",
            isDarkMode ? "bg-[var(--color-main-bg-dark)] border border-[var(--color-border-dark)]" : "bg-white border-slate-200"
          )}>
            <div className="p-6 border-b border-slate-200 dark:border-[var(--color-border-dark)] flex items-center justify-between bg-slate-50 dark:bg-[var(--color-main-bg-dark)]">
              <div>
                <h3 className="text-lg font-bold">Report Preview</h3>
                <p className="text-xs opacity-50">Review your generated audit before saving</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDownloadPdf(reportMode === ReportMode.CUSTOM)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-[var(--color-border-dark)] hover:bg-slate-100 dark:hover:bg-[var(--color-card-bg-dark)] transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={handleSaveReport}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Save className="w-4 h-4" />
                  {isGenerating ? "Saving..." : "Save to History"}
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-12 scrollbar-thin">
              <div ref={reportContentRef} className={cn(
                "w-full max-w-6xl mx-auto p-12 rounded-lg",
                isDarkMode ? "bg-[var(--color-main-bg-dark)] text-white" : "bg-white text-[#0f172a]"
              )}>
                {/* PDF Header */}
                <div className="report-header flex justify-between items-start border-b-2 border-[#10b981] pb-8 mb-8">
                  <Logo isDarkMode={isDarkMode} />
                  <div className="text-right">
                    <p className="text-xs font-bold opacity-50 uppercase mb-1">Generated On</p>
                    <p className="text-sm font-bold">{format(new Date(), 'MMMM dd, yyyy')}</p>
                    <p className="text-[10px] opacity-50 mt-2">Period: {startDate} to {endDate}</p>
                  </div>
                </div>

                {/* Report Content */}
                <div className="space-y-12">
                  {includeEnergy && <EnergySection />}
                  {includeEquipment && <EquipmentSection />}
                  {includeCost && <CostSection />}
                  <AnalysisSection />
                </div>

                {/* PDF Footer */}
                <div className="report-footer mt-12 pt-8 border-t border-[#e2e8f0] dark:border-[#ffffff1a] text-center">
                  <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Confidential • WattsUp Energy Management System • {new Date().getFullYear()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State / Initial View */}
      {!showPreview && !showHistory && (
        <div className={cn(
          "flex-1 rounded-3xl p-12 flex flex-col items-center justify-center text-center border-2 border-dashed min-h-[400px]",
          isDarkMode ? "border-[var(--color-border-dark)] bg-[var(--color-main-bg-dark)]" : "border-slate-200 bg-slate-50"
        )}>
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
            <TrendingUp className="w-10 h-10 text-emerald-500 opacity-40" />
          </div>
          <h3 className="text-2xl font-bold mb-3">Report Generator</h3>
          <p className="max-w-md opacity-60 text-sm mb-8">
            Configure your report sections and date range above. You can preview the generated audit before saving it to your permanent history.
          </p>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest opacity-40">
            <span className="flex items-center gap-2"><Check className="w-3 h-3" /> WattsUp</span>
            <span className="flex items-center gap-2"><Check className="w-3 h-3" /> Energy</span>
            <span className="flex items-center gap-2"><Check className="w-3 h-3" /> Intelligence</span>
          </div>
        </div>
      )}
    </div>
  );
};
