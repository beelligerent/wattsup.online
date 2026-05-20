'use client';
import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Send, Bot, User, Loader2, Download, Sparkles, Zap, FileText, Calendar, User as UserIcon, Briefcase, History, Trash2, ExternalLink, Clock, X, AlertCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import { getAIInsights } from '../services/AIService';
import { MeterReading, EquipmentSummary, AIReportResponse, AIReportVisualization, SavedAIReport } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { cn } from '../utils/cn';
import { useAuth } from '../auth/AuthContext';

import { CosmosService } from '../services/CosmosService';
import { BlobStorageService } from '../services/BlobStorageService';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      
      return (
        <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-center space-y-4">
          <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-rose-500">Something went wrong</h2>
          <p className="text-sm opacity-70 max-w-md mx-auto">
            {this.state.error?.message || "An unexpected error occurred while rendering this component."}
          </p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-2 bg-rose-500 text-white rounded-xl font-bold text-sm hover:bg-rose-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface AIAnalystProps {
  readings: MeterReading[];
  summaries: EquipmentSummary[];
  isDarkMode: boolean;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export const AIAnalyst: React.FC<AIAnalystProps> = (props) => {
  return (
    <ErrorBoundary>
      <AIAnalystContent {...props} />
    </ErrorBoundary>
  );
};

import { DataService } from '../services/DataService';
import { Logo } from './Logo';

const AIAnalystContent: React.FC<AIAnalystProps> = ({ readings, summaries, isDarkMode }) => {
  const { hasPermission, profile, isAdmin: isUserAdmin } = useAuth();
  if (!hasPermission('view_ai_analyst')) return null;

  const [prompt, setPrompt] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AIReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reports, setReports] = useState<SavedAIReport[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [reportToDelete, setReportToDelete] = useState<SavedAIReport | null>(null);
  const [previewReport, setPreviewReport] = useState<SavedAIReport | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const isAdmin = isUserAdmin;
  const isEngineer = profile?.role === 'engineer';

  useEffect(() => {
    if (!profile || !profile.approved) return;
    
    console.log("AIAnalyst: User profile loaded", { 
      uid: profile.uid, 
      role: profile.role, 
      approved: profile.approved,
      isAdmin,
      isEngineer
    });

    // Only Admin and Performance Engineer can see the report history
    if (!isAdmin && !isEngineer) {
      console.log("AIAnalyst: User is not Admin or Engineer, skipping history fetch");
      setReports([]);
      return;
    }

    console.log("AIAnalyst: Fetching report history...");
    const fetchReports = async () => {
      try {
        const querySpec = {
          query: "SELECT * FROM c ORDER BY c.generatedAt DESC"
        };
        const reportsData = await CosmosService.getAllItems<SavedAIReport>('ai_reports', querySpec);
        setReports(reportsData);
      } catch (err: any) {
        console.error("AI Reports fetch error:", err);
        setError(`Database error: ${err.message}`);
      }
    };

    fetchReports();
    const intervalId = setInterval(fetchReports, 30000); // Poll every 30 seconds

    return () => clearInterval(intervalId);
  }, [profile?.uid, profile?.approved, isAdmin, isEngineer]);

  const suggestedPrompts = [
    "Identify equipment with unusually high energy consumption last month.",
    "Suggest maintenance based on recent performance trends.",
    "Analyze peak demand patterns and recommend strategies to reduce demand charges.",
    "Compare energy consumption of similar equipment and highlight outliers.",
    "Predict future energy consumption based on historical data.",
    "Provide a summary of overall energy efficiency for the past quarter."
  ];

  const handleGetAnalysis = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setAnalysisResult(null);
    setError(null);

    try {
      const response = await getAIInsights(readings, summaries, prompt);
      setAnalysisResult(response);

      // Log AI Report Generation
      try {
        await DataService.addAuditLog(
          'AI Report Generation',
          `Generated AI report for prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}" (Readings: ${readings.length})`
        );
      } catch (logError) {
        console.error('Failed to log AI report generation:', logError);
      }
    } catch (error: any) {
      console.error("AI Analysis failed:", error);
      setError(error.message || "Failed to get analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderChart = (viz: AIReportVisualization, index: number) => {
    return (
      <div key={index} className="mb-8">
        <h4 className="text-sm font-bold mb-4 opacity-70 uppercase tracking-wider">{viz.title}</h4>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {viz.type === 'bar' ? (
              <BarChart data={viz.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1e293b' : '#e2e8f0'} vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : viz.type === 'line' ? (
              <LineChart data={viz.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#1e293b' : '#e2e8f0'} vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke={isDarkMode ? '#94a3b8' : '#64748b'} 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            ) : (
              <PieChart>
                <Pie
                  data={viz.data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="label"
                >
                  {viz.data.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const handleDownloadReport = async (saveToHistory: boolean = false) => {
    if (!resultRef.current || !analysisResult) return;

    if (saveToHistory) setIsSaving(true);
    
    try {
      const element = resultRef.current;
      
      // Inject temporary styles for professional PDF look
      const style = document.createElement('style');
      style.id = 'pdf-export-style';
      style.innerHTML = `
        .pdf-export-container {
          background: white !important;
          color: black !important;
          font-family: 'Helvetica', Arial, sans-serif !important;
          width: 800px !important;
          padding: 40px !important;
          border: none !important;
          border-radius: 0 !important;
        }
        .pdf-export-container * {
          color: black !important;
          border-color: #e2e8f0 !important;
        }
        .pdf-export-container .prose h1, 
        .pdf-export-container .prose h2, 
        .pdf-export-container .prose h3 {
          font-size: 20pt !important;
          margin-top: 24px !important;
          margin-bottom: 16px !important;
          color: #059669 !important;
          line-height: 1.4 !important;
        }
        .pdf-export-container .prose h4 {
          font-size: 16pt !important;
          margin-top: 20px !important;
          margin-bottom: 12px !important;
          color: #065f46 !important;
          line-height: 1.4 !important;
        }
        .pdf-export-container .prose p, 
        .pdf-export-container .prose li {
          font-size: 11pt !important;
          line-height: 1.6 !important;
          margin-bottom: 12px !important;
          text-align: justify !important;
        }
        .pdf-export-container .recharts-wrapper {
          background: white !important;
        }
        .pdf-export-container .recharts-cartesian-grid-horizontal line,
        .pdf-export-container .recharts-cartesian-grid-vertical line {
          stroke: #f1f5f9 !important;
        }
      `;
      document.head.appendChild(style);
      
      // Add class temporarily
      element.classList.add('pdf-export-container');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2) - 10; // 10mm for header/footer space
      
      const renderHeaderFooter = (pageNum: number) => {
        // Logo placeholder (Emerald bar)
        pdf.setFillColor(16, 185, 129); // Emerald 500
        pdf.rect(margin, 10, 2, 4, 'F');
        
        pdf.setFontSize(10);
        pdf.setTextColor(5, 150, 105); // Emerald 600
        pdf.setFont('helvetica', 'bold');
        pdf.text('WattsUp', margin + 4, 12);
        
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Energy Intelligence Generated Report', margin + 24, 12);
        
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.1);
        pdf.line(margin, 15, pageWidth - margin, 15);

        // Footer
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Confidential • WattsUp AI Analyst • Page ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      };

      const chunks = [
        element.querySelector('.report-header'),
        element.querySelector('.report-info'),
        element.querySelector('.report-visualizations'),
        element.querySelector('.report-text'),
        element.querySelector('.report-signature')
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

        // Check if chunk fits on current page
        if (yOffset + h > pageHeight - margin) {
          // If chunk itself is larger than a full page, we must split it
          if (h > availableHeight) {
            let heightLeft = h;
            let chunkPosition = yOffset;

            // Add first part of the long chunk
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
            yOffset = margin + 5 + (h + heightLeft); // heightLeft is negative here, representing remaining space
          } else {
            // Move to next page
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
      
      // Remove class and style
      element.classList.remove('pdf-export-container');
      style.remove();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `WattsUp_AI_Report_${timestamp}.pdf`;
      
      if (saveToHistory) {
        const pdfBlob = pdf.output('blob');
        const storagePath = `ai_reports/${profile?.uid}/${fileName}`;
        
        const downloadUrl = await BlobStorageService.uploadFile(pdfBlob, storagePath);
        
        await CosmosService.upsertItem('ai_reports', {
          id: `ai_report_${Date.now()}`,
          userId: profile?.uid,
          userName: profile?.name || 'Unknown User',
          generatedAt: new Date().toISOString(),
          prompt: prompt,
          downloadUrl: downloadUrl,
          storagePath: storagePath,
          reportText: analysisResult.reportText,
          visualizations: analysisResult.visualizations
        });
      }

      pdf.save(fileName);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      if (saveToHistory) setIsSaving(false);
    }
  };

  const handleDeleteReport = async (report: SavedAIReport) => {
    setReportToDelete(report);
    setShowAdminPrompt(true);
    setAdminPassword('');
  };

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportToDelete) return;

    // For demo purposes, we use a hardcoded admin password "ADMIN123"
    // In a real app, this would be verified against a secure backend or custom claim
    if (adminPassword !== 'ADMIN123') {
      alert('Invalid credentials. Please enter the correct password.');
      return;
    }

    setIsVerifying(true);
    try {
      // Delete from storage
      await BlobStorageService.deleteFile(reportToDelete.storagePath);
      
      // Delete from Cosmos DB
      await CosmosService.deleteItem('ai_reports', reportToDelete.id, reportToDelete.userId);
      
      setShowAdminPrompt(false);
      setReportToDelete(null);
    } catch (error) {
      console.error("Failed to delete report:", error);
      alert("Failed to delete report. It might have already been deleted or you lack permissions.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">AI Analytics</h1>
        {(isAdmin || isEngineer) && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border",
              isDarkMode ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:bg-slate-50"
            )}
          >
            <History className="w-4 h-4" />
            {showHistory ? "Hide History" : "View History"}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "p-6 rounded-2xl border mb-6",
              isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-[var(--color-card-bg-light)] border-[var(--color-border-light)] shadow-sm"
            )}>
              <div className="flex items-center gap-3 mb-6">
                <History className="w-5 h-5 text-violet-500" />
                <h3 className="text-lg font-bold">Report History</h3>
              </div>

              {reports.length === 0 ? (
                <div className="text-center py-12 opacity-50">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm">No reports generated yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reports.map((report) => (
                    <div 
                      key={report.id}
                      className={cn(
                        "p-4 rounded-xl border flex flex-col justify-between transition-all",
                        isDarkMode ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-violet-500" />
                          </div>
                          {(isAdmin || isEngineer) && (
                            <button 
                              onClick={() => handleDeleteReport(report)}
                              className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Delete Report"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs font-bold truncate mb-1" title={report.prompt}>{report.prompt}</p>
                        <p className="text-[10px] opacity-50 mb-4">
                          {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'Just now'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-black/5 dark:border-white/5">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setPreviewReport(report)}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            PREVIEW
                          </button>
                          <span className="text-[10px] opacity-20">|</span>
                          <a 
                            href={report.downloadUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[10px] font-bold text-violet-500 hover:underline"
                          >
                            <Download className="w-3 h-3" />
                            DOWNLOAD
                          </a>
                        </div>
                        <span className="text-[10px] opacity-50">By {report.userName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn(
        "p-6 rounded-2xl border",
        isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-[var(--color-card-bg-light)] border-[var(--color-border-light)] shadow-sm"
      )}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20">
            <Sparkles className="text-white w-7 h-7" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-1">AI-POWERED INSIGHTS</p>
            <h3 className="text-lg font-bold">Equipment Performance Analysis</h3>
          </div>
        </div>

        <p className="text-xs opacity-70 mb-6">Ask the AI to analyze your equipment's meter readings and energy records for insights into performance, anomalies, or optimization opportunities.</p>

        {/* Prompt Input */}
        <div className={cn(
          "relative p-4 rounded-xl border mb-4",
          isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
        )}>
          <textarea
            className="w-full bg-transparent outline-none text-sm resize-none h-24"
            placeholder="e.g., 'Identify equipment with unusually high energy consumption last month.' or 'Suggest maintenance based on recent performance trends.'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        {/* Suggested Prompts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {suggestedPrompts.map((sPrompt, idx) => (
            <button
              key={`${sPrompt}-${idx}`}
              onClick={() => setPrompt(sPrompt)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm text-left transition-all border",
                isDarkMode ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:bg-slate-50"
              )}
            >
              {sPrompt}
            </button>
          ))}
        </div>

        {/* Get Analysis Button */}
        <button
          onClick={handleGetAnalysis}
          disabled={isLoading || !prompt.trim()}
          className={cn(
            "w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl text-base font-bold transition-all",
            "bg-violet-600 text-white shadow-lg shadow-violet-600/30 hover:bg-violet-700 disabled:opacity-50"
          )}
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {isLoading ? "Getting Analysis..." : "GET AI ANALYSIS"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Analysis Result Display */}
      {analysisResult && (
        <div className={cn(
          "p-6 rounded-2xl border",
          isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-[var(--color-card-bg-light)] border-[var(--color-border-light)] shadow-sm"
        )}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Analysis Result</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDownloadReport(true)}
                disabled={isSaving}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                  isDarkMode ? "bg-violet-600/20 border-violet-600/30 text-violet-400 hover:bg-violet-600/30" : "bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100"
                )}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isSaving ? "Saving..." : "Save to History"}
              </button>
              <button
                onClick={() => handleDownloadReport(false)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                  isDarkMode ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:bg-slate-50"
                )}
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
          
          <div 
            ref={resultRef}
            className={cn(
              "p-8 rounded-2xl border",
              isDarkMode ? "bg-slate-950 border-white/5" : "bg-white border-slate-100"
            )}
          >
            {/* Professional Report Header */}
            <div className="report-header flex items-center justify-between mb-8 pb-8 border-b border-slate-200 dark:border-white/10">
              <Logo isDarkMode={isDarkMode} />
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Report ID</p>
                <p className="text-xs font-mono">WW-AI-{Math.random().toString(36).substring(7).toUpperCase()}</p>
              </div>
            </div>

            <div className="report-info grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <UserIcon className="w-4 h-4 opacity-40" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Prepared For</p>
                    <p className="text-sm font-bold">Management Team</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Briefcase className="w-4 h-4 opacity-40" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Department</p>
                    <p className="text-sm font-bold">Energy Analysis Department</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 opacity-40" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Date</p>
                    <p className="text-sm font-bold">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 opacity-40" />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Subject</p>
                    <p className="text-sm font-bold">AI-Generated Energy Intelligence Report</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visualizations */}
            <div className="report-visualizations grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              {analysisResult.visualizations.map((viz, idx) => renderChart(viz, idx))}
            </div>

            {/* Report Text */}
            <div className="report-text prose prose-sm dark:prose-invert max-w-none">
              <Markdown>{analysisResult.reportText}</Markdown>
            </div>

            {/* Signature Area */}
            <div className="report-signature mt-16 pt-8 border-t border-slate-200 dark:border-white/10 flex justify-between items-end">
              <div>
                <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold mb-8">Authorized By</p>
                <div className="w-48 border-b border-slate-400 dark:border-slate-600 mb-2"></div>
                <p className="text-xs font-bold">WattsUp AI Analyst</p>
                <p className="text-[10px] opacity-50">Automated Intelligence System</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] opacity-30 italic">This report was generated using advanced machine learning algorithms and should be reviewed by a qualified engineer before implementation of recommendations.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Report Preview Modal */}
      <AnimatePresence>
        {previewReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border shadow-2xl flex flex-col",
                isDarkMode ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className="flex items-center justify-between p-6 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Report Preview</h3>
                    <p className="text-[10px] opacity-50 font-bold uppercase tracking-wider">
                      Generated on {previewReport.generatedAt?.toDate ? previewReport.generatedAt.toDate().toLocaleString() : 'Just now'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={previewReport.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                      isDarkMode ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </a>
                  <button 
                    onClick={() => setPreviewReport(null)}
                    className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className={cn(
                  "p-8 rounded-2xl border",
                  isDarkMode ? "bg-slate-950 border-white/5" : "bg-white border-slate-100"
                )}>
                  {/* Report Header */}
                  <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-200 dark:border-white/10">
                    <Logo isDarkMode={isDarkMode} />
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Report ID</p>
                      <p className="text-xs font-mono">WW-AI-PREV-{previewReport.id.substring(0, 8).toUpperCase()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <UserIcon className="w-4 h-4 opacity-40" />
                        <div>
                          <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Prepared For</p>
                          <p className="text-sm font-bold">Management Team</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Briefcase className="w-4 h-4 opacity-40" />
                        <div>
                          <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Department</p>
                          <p className="text-sm font-bold">Energy Analysis Department</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 opacity-40" />
                        <div>
                          <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Date</p>
                          <p className="text-sm font-bold">
                            {previewReport.generatedAt?.toDate ? previewReport.generatedAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Just now'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 opacity-40" />
                        <div>
                          <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Subject</p>
                          <p className="text-sm font-bold">AI-Generated Energy Intelligence Report</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-8">
                    <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold mb-2">Original Prompt</p>
                    <p className="text-sm italic opacity-70 border-l-2 border-violet-500 pl-4 py-1">{previewReport.prompt}</p>
                  </div>

                  {previewReport.reportText && previewReport.visualizations ? (
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                        {previewReport.visualizations.map((viz, idx) => renderChart(viz, idx))}
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Markdown>{previewReport.reportText}</Markdown>
                      </div>
                    </>
                  ) : (
                    <div className="py-20 text-center space-y-4">
                      <AlertCircle className="w-12 h-12 text-amber-500 mx-auto opacity-50" />
                      <p className="text-sm opacity-50">This historical report does not have a digital preview available. Please download the PDF to view its content.</p>
                    </div>
                  )}

                  <div className="mt-16 pt-8 border-t border-slate-200 dark:border-white/10 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold mb-8">Authorized By</p>
                      <div className="w-48 border-b border-slate-400 dark:border-slate-600 mb-2"></div>
                      <p className="text-xs font-bold">WattsUp AI Analyst</p>
                      <p className="text-[10px] opacity-50">Automated Intelligence System</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Credential Prompt Modal */}
      <AnimatePresence>
        {showAdminPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-md p-6 rounded-3xl border shadow-2xl",
                isDarkMode ? "bg-slate-900 border-white/10" : "bg-white border-slate-200"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-rose-500" />
                  </div>
                  <h3 className="text-lg font-bold">Security Verification</h3>
                </div>
                <button 
                  onClick={() => setShowAdminPrompt(false)}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm opacity-70 mb-6">
                Deleting a report is a permanent action. Please enter the security password to confirm.
              </p>

              <form onSubmit={handleAdminVerify} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1.5 block">
                    Security Password
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter security password"
                    autoFocus
                    className={cn(
                      "w-full px-4 py-3 rounded-xl text-sm transition-all border outline-none",
                      isDarkMode 
                        ? "bg-white/5 border-white/10 focus:border-violet-500/50 text-white" 
                        : "bg-slate-50 border-slate-200 focus:border-violet-500/50 text-slate-900"
                    )}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminPrompt(false)}
                    className={cn(
                      "flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all border",
                      isDarkMode ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifying || !adminPassword}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {isVerifying ? "Verifying..." : "Confirm Delete"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
