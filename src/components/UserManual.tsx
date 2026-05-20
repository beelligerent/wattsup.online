'use client';
import React, { useEffect, useRef, useState } from 'react';
import { 
  Book, 
  ChevronDown, 
  ChevronRight, 
  Download, 
  Layout, 
  Activity, 
  Users, 
  BarChart3, 
  Zap, 
  Brain, 
  FileText, 
  Database, 
  ShieldCheck, 
  Settings as SettingsIcon,
  HelpCircle,
  Info,
  Server,
  UserCheck,
  Navigation,
  Workflow,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { cn } from '../utils/cn';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isDarkMode: boolean;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<SectionProps> = ({ title, icon, children, isDarkMode, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn(
      "border rounded-2xl overflow-hidden mb-4 transition-all",
      isDarkMode ? "border-white/10 bg-white/5" : "border-slate-200 bg-white shadow-sm"
    )}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between p-4 text-left transition-colors no-print",
          isOpen ? (isDarkMode ? "bg-white/5" : "bg-slate-50") : "hover:bg-black/5 dark:hover:bg-white/5"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isDarkMode ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500/10 text-emerald-600"
          )}>
            {icon}
          </div>
          <h3 className="font-bold text-lg">{title}</h3>
        </div>
        {isOpen ? <ChevronDown className="w-5 h-5 opacity-50" /> : <ChevronRight className="w-5 h-5 opacity-50" />}
      </button>
      
      <div 
        data-manual-section 
        data-section-title={title}
        className={cn(
          "p-6 border-t border-black/5 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-300",
          !isOpen && "hidden"
        )}
      >
        {/* For PDF export, we show the title inside the section content */}
        <h3 className="hidden print-only text-2xl font-bold mb-6 text-emerald-600">{title}</h3>
        {children}
      </div>
    </div>
  );
};

const MermaidChart: React.FC<{ chart: string; id: string }> = ({ chart, id }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const renderChart = async () => {
      try {
        // Dynamically import mermaid (browser-only) to avoid Next.js SSR issues
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          fontFamily: 'Inter, sans-serif',
        });
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(true);
      }
    };
    renderChart();
  }, [chart, id]);

  if (error) return <div className="p-4 bg-rose-500/10 text-rose-500 text-xs rounded-xl">Failed to render diagram</div>;
  
  return (
    <div 
      className="mermaid flex justify-center my-8 p-4 bg-white rounded-xl overflow-x-auto" 
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
};

export const UserManual: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => {
  const [isExporting, setIsExporting] = useState(false);
  const manualRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!manualRef.current) return;
    setIsExporting(true);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);

      // Helper to add header and footer
      const addHeaderFooter = (p: jsPDF, pageNum: number) => {
        p.setFontSize(9);
        p.setTextColor(100, 100, 100);
        p.setFont('helvetica', 'normal');
        
        // Header
        p.text('WattsUp Energy Intelligence System Manual', margin, 12);
        p.setDrawColor(200, 200, 200);
        p.setLineWidth(0.1);
        p.line(margin, 15, pageWidth - margin, 15);

        // Footer
        p.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      };

      // 1. Cover Page
      pdf.setFillColor(16, 185, 129); // Emerald 500
      pdf.rect(0, 0, pageWidth, 80, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(40);
      pdf.text('WattsUp', pageWidth / 2, 45, { align: 'center' });
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(28);
      pdf.text('Energy Intelligence System', pageWidth / 2, 120, { align: 'center' });
      
      pdf.setFontSize(20);
      pdf.setTextColor(80, 80, 80);
      pdf.setFont('helvetica', 'normal');
      pdf.text('User Manual', pageWidth / 2, 135, { align: 'center' });
      
      pdf.setDrawColor(16, 185, 129);
      pdf.setLineWidth(1);
      pdf.line(pageWidth / 4, 150, (pageWidth / 4) * 3, 150);

      pdf.setFontSize(12);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 250, { align: 'center' });
      pdf.text('Version 2.4.0', pageWidth / 2, 258, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text('© 2026 WattsUp Energy. All rights reserved.', pageWidth / 2, 275, { align: 'center' });

      // 2. Placeholder for TOC (Page 2)
      pdf.addPage();
      const tocPageIndex = 2;
      addHeaderFooter(pdf, 2);

      // 3. Sections
      // Force all sections to be visible and styled for print
      const style = document.createElement('style');
      style.id = 'pdf-export-style';
      style.innerHTML = `
        [data-manual-section] { 
          display: block !important; 
          visibility: visible !important;
          opacity: 1 !important;
          height: auto !important;
          background: white !important;
          color: black !important;
          font-family: 'Helvetica', Arial, sans-serif !important;
          line-height: 1.5 !important;
          width: 800px !important;
          padding: 20px !important;
        }
        [data-manual-section] h3.print-only { 
          font-size: 22pt !important; 
          margin-bottom: 24px !important; 
          color: #059669 !important; 
          border-bottom: 2px solid #059669 !important;
          padding-bottom: 8px !important;
        }
        [data-manual-section] h4 { 
          font-size: 18pt !important; 
          margin-top: 24px !important; 
          margin-bottom: 16px !important; 
          color: #065f46 !important; 
        }
        [data-manual-section] p, [data-manual-section] li { 
          font-size: 11.5pt !important; 
          margin-bottom: 12px !important; 
          text-align: justify !important;
        }
        [data-manual-section] ul, [data-manual-section] ol {
          margin-bottom: 16px !important;
        }
        [data-manual-section] .print-only { display: block !important; }
        .no-print { display: none !important; }
        .mermaid { 
          page-break-inside: avoid !important; 
          break-inside: avoid !important;
          margin: 20px 0 !important;
          display: flex !important;
          justify-content: center !important;
        }
        .mermaid svg { 
          max-width: 100% !important; 
          height: auto !important; 
        }
      `;
      document.head.appendChild(style);

      const sections = Array.from(manualRef.current.querySelectorAll('[data-manual-section]'));
      const tocEntries: { title: string; page: number }[] = [];
      
      let currentPage = 3;

      for (const section of sections) {
        const title = section.getAttribute('data-section-title') || 'Section';
        tocEntries.push({ title, page: currentPage });
        
        pdf.addPage();
        addHeaderFooter(pdf, currentPage);

        // Capture Section
        const dataUrl = await toPng(section as HTMLElement, {
          backgroundColor: '#ffffff',
          quality: 1,
          pixelRatio: 2,
        });

        const imgProps = pdf.getImageProperties(dataUrl);
        const imgWidth = contentWidth;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

        let heightLeft = imgHeight;
        let position = margin;

        // Add first part
        pdf.addImage(dataUrl, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;

        // Handle overflow
        while (heightLeft > 0) {
          currentPage++;
          pdf.addPage();
          addHeaderFooter(pdf, currentPage);
          
          position = margin - (imgHeight - heightLeft);
          // We use clipping by placing the image at a negative Y offset
          pdf.addImage(dataUrl, 'PNG', margin, position, imgWidth, imgHeight);
          heightLeft -= contentHeight;
        }
        
        currentPage++;
      }

      // 4. Generate TOC on Page 2
      pdf.setPage(tocPageIndex);
      pdf.setFontSize(26);
      pdf.setTextColor(5, 150, 105); // Emerald 600
      pdf.setFont('helvetica', 'bold');
      pdf.text('Table of Contents', margin, 40);
      
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      let y = 60;
      tocEntries.forEach(entry => {
        pdf.text(entry.title, margin, y);
        pdf.text(entry.page.toString(), pageWidth - margin, y, { align: 'right' });
        
        // Add dotted line
        const titleWidth = pdf.getTextWidth(entry.title);
        const pageNumWidth = pdf.getTextWidth(entry.page.toString());
        const startX = margin + titleWidth + 3;
        const endX = pageWidth - margin - pageNumWidth - 3;
        
        if (startX < endX) {
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineDashPattern([0.5, 1], 0);
          pdf.line(startX, y - 1, endX, y - 1);
          pdf.setLineDashPattern([], 0);
        }
        
        y += 10;
        
        // Handle TOC overflow (unlikely but safe)
        if (y > pageHeight - margin) {
          // In a real app we'd add another TOC page, but for 15 sections it fits.
        }
      });

      // Cleanup
      const styleEl = document.getElementById('pdf-export-style');
      if (styleEl) styleEl.remove();

      pdf.save('WattsUp_User_Manual.pdf');
    } catch (error) {
      console.error('PDF Export Error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Manual</h2>
          <p className="opacity-50">Comprehensive guide to the WattsUp Energy Intelligence System</p>
        </div>
        <button
          onClick={handleDownloadPDF}
          disabled={isExporting}
          className="no-print flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          Download Manual (PDF)
        </button>
      </div>

      <div ref={manualRef} className="space-y-4">
        {/* 1. Introduction */}
        <CollapsibleSection title="1. Introduction" icon={<Info className="w-5 h-5" />} isDarkMode={isDarkMode} defaultOpen={true}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4 className="text-xl font-bold mb-4">What is WattsUp?</h4>
            <p>
              WattsUp is a state-of-the-art Energy Intelligence Platform designed specifically for power plant monitoring and industrial energy management. 
              By combining real-time data acquisition with advanced AI analytics, WattsUp empowers organizations to optimize their energy consumption, 
              reduce operational costs, and minimize their carbon footprint.
            </p>
            
            <h4 className="text-xl font-bold mt-6 mb-4">Purpose of the System</h4>
            <p>
              The primary purpose of WattsUp is to provide actionable insights into energy usage patterns. It bridges the gap between raw meter data 
              and strategic decision-making. Whether you are an operator tracking live loads or an administrator managing system-wide access, 
              WattsUp provides the tools necessary to ensure peak efficiency.
            </p>

            <h4 className="text-xl font-bold mt-6 mb-4">How WattsUp Helps</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Real-time Visibility:</strong> Monitor equipment performance as it happens.</li>
              <li><strong>Anomaly Detection:</strong> Automatically identify unusual energy spikes or equipment failures.</li>
              <li><strong>Cost Optimization:</strong> Analyze tariff structures and peak demand to reduce utility bills.</li>
              <li><strong>Sustainability Tracking:</strong> Monitor carbon emissions and environmental impact.</li>
              <li><strong>Automated Reporting:</strong> Generate professional energy audits in seconds.</li>
            </ul>
          </div>
        </CollapsibleSection>

        {/* 2. System Architecture */}
        <CollapsibleSection title="2. System Architecture" icon={<Server className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p>WattsUp is built on an enterprise-grade Microsoft Azure cloud stack, migrated to Next.js 15 for improved performance, server-side API security, and deployment flexibility.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                <h5 className="font-bold text-emerald-500 mb-2">Frontend — Next.js 15 App Router</h5>
                <p className="text-xs">React 19 with Next.js 15 (App Router), Tailwind CSS v3, Recharts for data visualization, Framer Motion for animations, and Zustand for client-side state management. All components are client-side rendered (SPA) via <code>dynamic(() =&gt; import(...), &#123; ssr: false &#125;)</code>.</p>
              </div>
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                <h5 className="font-bold text-blue-500 mb-2">Database — Azure Cosmos DB</h5>
                <p className="text-xs">Microsoft Azure Cosmos DB (NoSQL) stores all energy readings, user profiles, audit logs, cost rules, reports, and system settings. Server-side API routes (<code>app/api/</code>) proxy all Cosmos operations — the client never touches the database directly.</p>
              </div>
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                <h5 className="font-bold text-violet-500 mb-2">AI Engine — Google Gemini</h5>
                <p className="text-xs">Google Gemini API (gemini-2.0-flash) powers the AI Analytics module, report narrative generation, and anomaly insight descriptions. Called securely from the client using the <code>NEXT_PUBLIC_GEMINI_API_KEY</code> environment variable.</p>
              </div>
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                <h5 className="font-bold text-amber-500 mb-2">Authentication — Azure CIAM (MSAL v5)</h5>
                <p className="text-xs">Microsoft Entra External ID (CIAM) via <code>@azure/msal-browser</code> v5 and <code>@azure/msal-react</code>. Microsoft accounts authenticate through a redirect flow. MSAL is initialized once in <code>MsalInitializer</code> before the app renders to prevent <code>uninitialized_public_client_application</code> errors.</p>
              </div>
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                <h5 className="font-bold text-cyan-500 mb-2">File Storage — Azure Blob Storage</h5>
                <p className="text-xs">Azure Blob Storage holds uploaded logos, generated PDF reports, and CSV data exports. Accessed from the client using a scoped SAS token via <code>@azure/storage-blob</code>.</p>
              </div>
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                <h5 className="font-bold text-rose-500 mb-2">API Routes — Next.js Server</h5>
                <p className="text-xs">All Cosmos DB operations go through <code>app/api/cosmos/[containerId]/</code> route handlers: <code>GET</code> (filter query), <code>POST</code> (arbitrary query), <code>/upsert</code>, <code>/bulk</code>, <code>/deleteAll</code>, and <code>/[itemId]</code>. Special routes: <code>/api/preloadAllData</code> and <code>/api/updateBaselines</code>.</p>
              </div>
            </div>

            <h4 className="text-xl font-bold mt-8 mb-4">Data Flow Diagram</h4>
            <MermaidChart
              id="architecture-flow"
              chart={`
                flowchart LR
                  CSV[CSV Upload] -->|Bulk Upsert| API[Next.js API Routes]
                  API -->|Read/Write| Cosmos[(Azure Cosmos DB)]
                  Cosmos -->|Preload on Login| Client[React Client SPA]
                  Client -->|Auth Redirect| MSAL[Azure CIAM MSAL]
                  MSAL -->|Token| Client
                  Client -->|AI Query| Gemini[Google Gemini API]
                  Gemini -->|Insights| Client
                  Client -->|Upload Logo/PDF| Blob[Azure Blob Storage]
              `}
            />
          </div>
        </CollapsibleSection>

        {/* 3. System Process Flow */}
        <CollapsibleSection title="3. System Process Flow" icon={<Workflow className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p>The following diagram illustrates the end-to-end operational workflow of the WattsUp platform, categorized by user roles and system automation layers.</p>
            
            <div className="my-8 overflow-x-auto border border-black/5 dark:border-white/10 rounded-2xl bg-white p-4">
              <MermaidChart 
                id="enterprise-process-flow"
                chart={`
                  flowchart LR
                    subgraph OP ["OPERATIONS USER"]
                        O1([Start]) --> O2[View Dashboard]
                        O2 --> O3[Open Realtime Monitoring]
                        O3 --> O4[Select Equipment]
                        O4 --> O5[Input Meter Reading]
                        O5 --> O6[Submit Reading]
                        
                        O2 --> O7[Open Energy User Page]
                        O7 --> O8[Review Dept. Energy Usage]
                    end

                    subgraph ENG ["ENGINEER"]
                        E1([Start]) --> E2[Open Equipment Analysis]
                        E2 --> E3[Select Equipment]
                        E3 --> E4[Retrieve Historical Data]
                        E4 --> E5[Generate Efficiency Charts]
                        E5 --> E6{Anomalies?}
                        E6 -- Yes --> E7[Diagnose Issue]
                        
                        E1 --> E8[Open Cost Analytics]
                        E8 --> E9[Calculate Energy Cost]
                        E9 --> E10[Compare Cost Performance]
                    end

                    subgraph ADM ["ADMINISTRATOR"]
                        A1([Start]) --> A2[Open Admin Panel]
                        A2 --> A3[Manage Users]
                        A3 --> A4[Assign Roles]
                        
                        A1 --> A5[Database Management]
                        A5 --> A6[Upload CSV Data]
                        A6 --> A7[Update Equipment DB]
                        
                        A1 --> A8[Settings Configuration]
                        A8 --> A9[Update Preferences]
                    end

                    subgraph SYS ["WATTSUP SYSTEM (AUTOMATION)"]
                        S1[Meter Data Received] --> S2[(Cosmos DB)]
                        S2 --> S3[Trigger Dashboard Update]
                        S3 --> S4[Run Energy Calculations]
                        S4 --> S5[Update Cost Analytics]
                        S5 --> S6[(Store Historical Data)]
                        
                        S6 --> S7{AI Trigger?}
                        S7 -- Yes --> S8[Gemini AI API]
                        S8 --> S9[AI Processing]
                        S9 --> S10[Generate Insights]
                        S10 --> S11[Display on AI Analytics]
                    end

                    %% Cross-lane interactions
                    O6 --> S1
                    E4 -.-> S6
                    S11 -.-> E5
                    A4 -.-> S2
                    A7 -.-> S2
                `}
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* 4. User Roles */}
        <CollapsibleSection title="4. User Roles" icon={<UserCheck className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p>WattsUp utilizes a strict Role-Based Access Control (RBAC) system to ensure data security and operational integrity.</p>
            
            <div className="space-y-6 mt-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h5 className="font-bold text-lg">Administrator</h5>
                  <p className="text-xs opacity-70">Full system access. Responsible for user management, role assignment, system configuration, and database maintenance.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Zap className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h5 className="font-bold text-lg">Engineer</h5>
                  <p className="text-xs opacity-70">Technical experts focused on efficiency. Access to equipment analysis, AI insights, cost analytics, and report generation.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Activity className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h5 className="font-bold text-lg">Operations User</h5>
                  <p className="text-xs opacity-70">Front-line staff responsible for data entry. Access to real-time monitoring and meter reading input.</p>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* 5. Dashboard */}
        <CollapsibleSection title="5. Dashboard" icon={<Layout className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4 className="text-xl font-bold mb-4">Overview</h4>
            <p>The Dashboard provides a high-level summary of the entire plant's energy performance. It is the first screen users see upon logging in.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Key Metrics</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Total Consumption:</strong> Real-time aggregate power usage across all monitored points.</li>
              <li><strong>Energy Intensity:</strong> Energy used per unit of production or area.</li>
              <li><strong>Carbon Footprint:</strong> Estimated CO2 emissions based on energy source factors.</li>
              <li><strong>Cost Summary:</strong> Current billing period estimated costs.</li>
            </ul>
          </div>
        </CollapsibleSection>

        {/* 6. Realtime Monitoring */}
        <CollapsibleSection title="6. Realtime Monitoring" icon={<Activity className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4 className="text-xl font-bold mb-4">Live Data Feed</h4>
            <p>The Realtime Monitoring link opens an external PI Vision dashboard (<code>http://172.24.192.7/PIVision/</code>) in a new tab, providing live SCADA-level data from plant meters. This link is accessible from the sidebar navigation.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Features</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>External SCADA Integration:</strong> Live meter data via PI Vision — opens in a new browser tab.</li>
              <li><strong>WattsUp Dashboard:</strong> The main dashboard KPI cards reflect the most recently preloaded data snapshot from Cosmos DB.</li>
              <li><strong>Manual Refresh:</strong> Use the refresh button (↻) on each page to re-fetch the latest data from Cosmos DB on demand.</li>
            </ul>
          </div>
        </CollapsibleSection>

        {/* 7. Energy User */}
        <CollapsibleSection title="7. Energy User" icon={<Users className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4 className="text-xl font-bold mb-4">Area-Based Energy View</h4>
            <p>The Energy User page provides area-level and equipment-level consumption analysis. Use the area selector tabs (Admin, MAH, Unit 1, Unit 2, WTP, All Areas) to scope data.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Consumption Trend Chart</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>All Areas selected:</strong> Chart shows one line per area (aggregated totals). Legend displays area names and colors matching the System Distribution chart on the dashboard.</li>
              <li><strong>Specific area selected:</strong> A toggle appears — <strong>Area Total</strong> (single aggregated line) or <strong>Per Equipment</strong> (one line per equipment in the area with legend).</li>
              <li><strong>Chart types:</strong> Area, Bar (stacked), or Line — switchable via the toolbar.</li>
              <li><strong>Units:</strong> Switch between kWh (total energy) and kW (average demand).</li>
              <li><strong>Baseline modes:</strong> Static (uses stored baselineKW) or Avg (95% of actual as target).</li>
            </ul>
            <h4 className="text-xl font-bold mt-6 mb-4">KPI Cards</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Total Consumption:</strong> Sum of all kWh in the selected date range, plus Avg Daily (kWh/day).</li>
              <li><strong>Peak Demand:</strong> Maximum kW recorded, plus Avg Demand (kW).</li>
              <li><strong>Savings Opportunities:</strong> Top 3 equipment items exceeding baseline, with estimated kWh waste.</li>
              <li><strong>Cost Implications:</strong> Wasted cost per day (₱/day) for the same top 3.</li>
            </ul>
            <h4 className="text-xl font-bold mt-6 mb-4">Top Consumers Chart</h4>
            <p>Horizontal bar chart showing top 10 equipment items by cumulative kWh consumption. Bar height is dynamic — proportional to the number of items so there are no gaps.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Equipment Performance Summary Table</h4>
            <p>Detailed table showing each equipment: Baseline (kWh), Total Consumption (kWh), Variance (Baseline − Total; red = over-consuming, green = under-consuming), and % Difference. Sortable by any column, searchable by name.</p>
          </div>
        </CollapsibleSection>

        {/* 8. Equipment Analysis */}
        <CollapsibleSection title="8. Equipment Analysis" icon={<BarChart3 className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4 className="text-xl font-bold mb-4">Equipment Performance Table</h4>
            <p>Lists all monitored equipment with aggregated metrics: Total kWh, Avg Load (kW), Peak Demand, Efficiency Score, Carbon Emissions, and Anomaly count. Sort or search to find any asset. Click a row to drill into that equipment's detail analytics.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Compare Mode</h4>
            <p>Select multiple equipment items using the checkbox column, then click <strong>Compare Selected</strong> to view a side-by-side performance overlay chart.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Baseline Calculator</h4>
            <p>Access via the <strong>Baseline Calculator</strong> button in the Equipment Analysis toolbar. Set a reference date range and a scaling factor (%) to compute new baseline kW values for all or selected equipment. Click <strong>Apply Baseline</strong> to commit — the operation runs in the background (minimizable progress widget) so you can keep working while Cosmos DB is updated.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Efficiency Metrics</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Efficiency Score:</strong> 0–100% rating based on actual vs. design kW.</li>
              <li><strong>Anomaly Flag:</strong> Automatically set when actual load deviates significantly from expected.</li>
              <li><strong>Carbon Emission:</strong> Calculated from kWh using the configured emission factor (kg CO₂/kWh).</li>
            </ul>
          </div>
        </CollapsibleSection>

        {/* 9. Cost Analytics */}
        <CollapsibleSection title="9. Cost Analytics" icon={<Zap className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4 className="text-xl font-bold mb-4">Financial Impact</h4>
            <p>Translate energy units (kWh) into local currency. This module applies complex tariff structures including peak/off-peak rates and demand charges.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Budgeting & Forecasting</h4>
            <p>Predict future energy costs based on historical patterns and planned production schedules.</p>
          </div>
        </CollapsibleSection>

        {/* 10. AI Analytics */}
        <CollapsibleSection title="10. AI Analytics" icon={<Brain className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4 className="text-xl font-bold mb-4">Intelligent Insights</h4>
            <p>Powered by Google Gemini, the AI Analytics module allows users to ask natural language questions about their data.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Example Queries</h4>
            <ul className="list-disc pl-5 space-y-2">
              <li>"Why was there a spike in energy usage last Tuesday at 3 PM?"</li>
              <li>"Which equipment is most likely to fail based on current vibration patterns?"</li>
              <li>"Suggest three ways to reduce our peak demand charges."</li>
            </ul>
          </div>
        </CollapsibleSection>

        {/* 11. Reports */}
        <CollapsibleSection title="11. Reports" icon={<FileText className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4 className="text-xl font-bold mb-4">Standard Reports</h4>
            <p>Generate PDF energy audits from the current filter date range. Choose which sections to include: Energy Consumption Profile, Equipment Performance Analysis, and Cost Analysis. The Energy Consumption chart supports <strong>Daily</strong>, <strong>Weekly</strong>, or <strong>Monthly</strong> aggregation — select using the period toggle above the chart inside the preview.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Custom Reports (Drag-and-Drop Builder)</h4>
            <p>Build pixel-precise multi-page reports using a drag-and-drop canvas. Add elements: Header, Author Info, Charts (line, area, bar), Tables (summary or detailed), AI Analysis text blocks, Images, and Footers. Each chart or table element has its own filter settings (area, date range, trend type, unit).</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Report Archive</h4>
            <p>All saved reports are stored in Azure Blob Storage and listed in the Report History tab. Download or delete any previous report. Reports are saved with metadata (date range, sections, generation timestamp) to Azure Cosmos DB.</p>
          </div>
        </CollapsibleSection>

        {/* 12. Database */}
        <CollapsibleSection title="12. Database" icon={<Database className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4 className="text-xl font-bold mb-4">CSV Upload</h4>
            <p>Administrators can upload energy reading data via CSV. The CSV parser validates columns, detects duplicates, and bulk-upserts records into the <code>energy_readings</code> Cosmos DB container in batches of 50. Supported columns: <code>timestamp, equipmentName, area, actualKW, baselineKW, designKW, kwh, efficiencyScore, carbonEmission, isAnomaly, anomalyReason</code>.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Data Export</h4>
            <p>Export the current filtered dataset as CSV or Excel (.xlsx) using the Export buttons in the Filters panel on any page. Exports include Timestamp, Equipment, Area, and Load (kW).</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Clear All Data</h4>
            <p>Administrators can clear all energy readings from the database using the <strong>Clear All Data</strong> button in the Database page. This operation is irreversible and requires confirmation. It clears both the <code>energy_readings</code> and <code>uploaded_files</code> containers.</p>
          </div>
        </CollapsibleSection>

        {/* 13. Admin Panel */}
        <CollapsibleSection title="13. Admin Panel" icon={<ShieldCheck className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4 className="text-xl font-bold mb-4">User Management</h4>
            <p>View all registered users, their roles, approval status, and last activity. Approve or reject pending accounts, promote/demote roles (Admin, Engineer, Operations User, Pending), and deactivate accounts.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Pending Approvals</h4>
            <p>New users who sign in for the first time are placed in a <strong>Pending</strong> state. Administrators must approve them before they can access the system. Designated admin emails (<code>hbabancio@gmail.com</code>, <code>hbsordilla@gmail.com</code>) are auto-approved on first login.</p>
            <h4 className="text-xl font-bold mt-6 mb-4">Audit Logs</h4>
            <p>Chronological log of all system events stored in the <code>audit_logs</code> Cosmos DB container. Logged events include: Login, Logout, Baseline Update, Cost Rules Update, Report Creation, Report Deletion, User Approval, Role Change, Settings Change, and CSV Upload. Sorted newest-first, showing up to 500 recent entries.</p>
          </div>
        </CollapsibleSection>

        {/* 14. Settings */}
        <CollapsibleSection title="14. Settings" icon={<SettingsIcon className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p>The Settings page uses a top-tab navigation bar: <strong>General</strong>, <strong>Notifications</strong>, <strong>Security</strong>, <strong>Data Management</strong>, <strong>User Manual</strong>.</p>
            <h4 className="text-xl font-bold mt-4 mb-2">General</h4>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li><strong>User Credentials:</strong> View your Microsoft account email and name (managed by Azure CIAM — changes must be made via Microsoft account settings).</li>
              <li><strong>Theme:</strong> Toggle Dark/Light mode — preference is saved to <code>localStorage</code> and persists across sessions.</li>
              <li><strong>Default Date Range:</strong> Set the global default start/end dates used across all pages when no filter has been applied. Saved to the <code>global</code> system settings in Cosmos DB.</li>
              <li><strong>Logo Upload:</strong> Administrators can upload a custom logo (PNG/JPG) stored in Azure Blob Storage. The logo appears on the Login screen and Preload overlay.</li>
            </ul>
            <h4 className="text-xl font-bold mt-4 mb-2">Notifications</h4>
            <p className="text-xs">Toggle email notification preferences: Anomaly Alerts, Daily Summaries, and System Alerts. Saved to your user profile in Cosmos DB.</p>
            <h4 className="text-xl font-bold mt-4 mb-2">Security</h4>
            <p className="text-xs">Email and password management is handled by Microsoft Entra External ID. Contact your administrator to change your primary email. Session management information is displayed here.</p>
            <h4 className="text-xl font-bold mt-4 mb-2">Data Management</h4>
            <p className="text-xs">Configure global energy rate (₱/kWh), system loss %, VAT %, monthly budget, and default date filters that apply system-wide.</p>
          </div>
        </CollapsibleSection>

        {/* 15. Troubleshooting */}
        <CollapsibleSection title="15. Troubleshooting" icon={<AlertTriangle className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="space-y-4">
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                <h5 className="font-bold text-rose-500 mb-2">BrowserAuthError: crypto_nonexistent</h5>
                <p className="text-xs">You are accessing the app via an HTTP network IP (e.g. <code>http://192.168.x.x:3000</code>). The browser blocks the Web Crypto API on insecure origins. <strong>Fix:</strong> Use <code>http://localhost:3000</code> on the same machine, or run <code>npm run dev:network</code> for HTTPS network access.</p>
              </div>
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                <h5 className="font-bold text-rose-500 mb-2">BrowserAuthError: uninitialized_public_client_application</h5>
                <p className="text-xs">MSAL was not initialized before use. This is handled automatically by <code>MsalInitializer</code>. If it persists, clear <code>localStorage</code> and <code>sessionStorage</code> and reload.</p>
              </div>
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                <h5 className="font-bold text-rose-500 mb-2">No Data Available on Energy User page</h5>
                <p className="text-xs">The active date filter does not overlap with the data in Cosmos DB. Click <strong>Reset to Default Date Range</strong> on the empty-state screen, or open Filters and set dates that match your data.</p>
              </div>
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                <h5 className="font-bold text-rose-500 mb-2">Baseline update takes a long time</h5>
                <p className="text-xs">Updating baselines patches every reading for the selected equipment in Cosmos DB. The progress widget can be <strong>minimized</strong> — click the minimize button to keep working while the update runs in the background. You will be notified upon completion.</p>
              </div>
              <div className={cn("p-4 rounded-xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200")}>
                <h5 className="font-bold text-rose-500 mb-2">First page load takes 15–20 seconds</h5>
                <p className="text-xs">Next.js in development mode compiles modules on-demand on the first request. Subsequent loads are fast. For instant loading, run a production build: <code>npm run build && npm start</code>.</p>
              </div>
            </div>
          </div>
        </CollapsibleSection>
        {/* 16. FAQ */}
        <CollapsibleSection title="16. FAQ" icon={<HelpCircle className="w-5 h-5" />} isDarkMode={isDarkMode}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="space-y-4">
              <div>
                <h6 className="font-bold">How often is data refreshed?</h6>
                <p className="text-xs opacity-70">Data is loaded from Azure Cosmos DB when you first log in (Preload phase). Use the <strong>Refresh (↻)</strong> button on any page to re-fetch the latest data. There is no automatic push — this is a batch-load system, not a real-time listener.</p>
              </div>
              <div>
                <h6 className="font-bold">Can I export data to Excel?</h6>
                <p className="text-xs opacity-70">Yes. Open the <strong>Filters</strong> panel on any page and click the <strong>Excel</strong> or <strong>CSV</strong> export button. The export includes the current filtered dataset (timestamp, equipment, area, kW load).</p>
              </div>
              <div>
                <h6 className="font-bold">Is my data secure?</h6>
                <p className="text-xs opacity-70">All data is stored in Azure Cosmos DB with key-based server-side access — the Cosmos keys are never exposed to the browser. Authentication is handled by Microsoft Entra External ID (Azure CIAM). AI queries go to Google Gemini via a client-side API key scoped to this application.</p>
              </div>
              <div>
                <h6 className="font-bold">Why does baseline update take so long?</h6>
                <p className="text-xs opacity-70">The system patches <em>every individual reading document</em> in Cosmos DB for the selected equipment. With tens of thousands of readings, this can take several minutes. The progress widget is minimizable so you can continue working. Speed depends on Cosmos DB throughput (RU/s) provisioned for the account.</p>
              </div>
              <div>
                <h6 className="font-bold">Can I access WattsUp from other devices on my network?</h6>
                <p className="text-xs opacity-70">Yes, but you must use HTTPS. Run <code>npm run dev:network</code> which starts Next.js with a self-signed certificate on all network interfaces. Then access via <code>https://[your-ip]:3000</code>. Add the redirect URI to your Azure app registration first.</p>
              </div>
              <div>
                <h6 className="font-bold">How do I request a new feature?</h6>
                <p className="text-xs opacity-70">Contact the system administrator or development team. The codebase is at <code>wattsup-next/</code> (Next.js 15, TypeScript, Azure).</p>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer */}
      <div className="pt-12 border-t border-black/5 dark:border-white/5 text-center">
        <p className="text-xs opacity-30">WattsUp Energy Intelligence System v3.0.0 (Next.js 15 + Azure) • User Manual • Confidential</p>
      </div>
    </div>
  );
};
