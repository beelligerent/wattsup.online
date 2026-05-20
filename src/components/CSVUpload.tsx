'use client';
import React, { useCallback, useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Download, Trash2, ShieldAlert, Lock, X, FileCheck } from 'lucide-react';
import Papa from 'papaparse';
import { MeterReading, UploadedFile, AuditLog } from '../types';
import { parseEnergyCSV, CSVValidationError } from '../utils/CSVParser';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../auth/AuthContext';

import { DataService } from '../services/DataService';
import { format } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CSVUploadProps {
  onDataLoaded: (data: MeterReading[], metadata?: any) => Promise<void>;
  onRefresh?: () => Promise<void>;
  onGoToDashboard?: () => void;
  isDarkMode: boolean;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ onDataLoaded, onRefresh, onGoToDashboard, isDarkMode }) => {
  const { hasPermission } = useAuth();
  if (!hasPermission('manage_data')) return null;

  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ row?: number; column?: string } | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  const [previewData, setPreviewData] = useState<MeterReading[] | null>(null);
  const [previewMetadata, setPreviewMetadata] = useState<any | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  
  const { profile, user } = useAuth();

  const canDelete = true;

  const loadFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const files = await DataService.getUploadedFiles();
      setUploadedFiles(files);
    } catch (err) {
      console.error("Error loading files:", err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const downloadTemplate = () => {
    const headers = ['Date', 'Boiler', 'Boiler', 'Cooling', 'Cooling'];
    const subHeaders = ['', 'BFP A', 'ID Fan', 'CT Fan 1', 'CT Fan 2'];
    const units = ['', 'kW', 'kW', 'kW', 'kW'];
    const designKWs = ['', '450', '320', '150', '140'];
    const sampleData = [
      ['2026-02-01', '460', '310', '155', '142'],
      ['2026-02-02', '455', '300', '152', '138'],
    ];
    
    const csvContent = [headers, subHeaders, units, designKWs, ...sampleData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "WattsUp_Energy_Template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadFile = (file: UploadedFile) => {
    if (file.downloadUrl) {
      window.open(file.downloadUrl, '_blank');
      return;
    }
    const blob = new Blob([file.content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", file.fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteFile = (fileId: string) => {
    setFileToDelete(fileId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteData = async () => {
    if (!user) return;
    setIsDeleting(true);
    setError(null);
    setDeleteStatus('idle');

    try {
      if (fileToDelete) {
        await DataService.deleteUploadedFile(fileToDelete);
        await DataService.addAuditLog('File Deletion', `Deleted file record: ${fileToDelete}`, profile?.email);
        // Refresh store data after file delete
        if (onRefresh) await onRefresh();
      } else {
        // Clear all — onDataLoaded([]) handles DB clear + store update
        await onDataLoaded([]);
        await DataService.addAuditLog('Data Deletion', 'Cleared all energy readings and database history', profile?.email);
      }

      setDeleteStatus('success');
      setFileToDelete(null);
      // Reload the file list
      await loadFiles();
    } catch (err: any) {
      console.error(err);
      setDeleteStatus('error');
      setError('Deletion failed. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setStatus('error');
      setError('Please upload a valid CSV file.');
      return;
    }

    setStatus('parsing');
    setError(null);
    setErrorDetails(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      
      Papa.parse(content, {
        header: false,
        skipEmptyLines: true,
        complete: async (results) => {
          const rawRows = results.data as any[][];
          
          try {
            const mappedData = parseEnergyCSV(rawRows);

            if (mappedData.length === 0) {
              setStatus('error');
              setError('No valid data records found in the CSV. Ensure it follows the required 5-row header structure.');
              return;
            }

            const metadata = {
              fileName: file.name,
              uploadedBy: user?.email || 'Unknown',
              recordCount: mappedData.length,
              fileSize: file.size,
              content: content
            };

            setSelectedFile(file);
            setPreviewData(mappedData);
            setPreviewMetadata(metadata);
            setStatus('idle');
          } catch (err) {
            setStatus('error');
            if (err instanceof CSVValidationError) {
              setError(err.message);
              setErrorDetails({ row: err.row, column: err.column });
            } else {
              setError(`Parsing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          }
        },
        error: (err) => {
          setStatus('error');
          setError(`CSV error: ${err.message}`);
        }
      });
    };
    reader.readAsText(file);
  }, [onDataLoaded, user, loadFiles]);

  const handleConfirmUpload = async () => {
    if (!previewData || !previewMetadata || !selectedFile) return;
    
    setStatus('uploading');
    try {
      // FIX: Pass the file and metadata to onDataLoaded (DataService handles Blob + Cosmos)
      // Blob Storage upload is non-fatal — readings always go to Cosmos DB
      const storagePath = `uploads/${Date.now()}_${previewMetadata.fileName}`;
      
      const finalMetadata = {
        ...previewMetadata,
        storagePath,
        uploadedBy: profile?.email || user?.username || 'Unknown',
      };

      await onDataLoaded(previewData, finalMetadata);
      await DataService.addAuditLog(
        'Database Upload',
        `Uploaded file: ${previewMetadata.fileName} with ${previewData.length} records.`,
        profile?.email
      );
      setStatus('success');
      setRecordCount(previewData.length);
      setPreviewData(null);
      setPreviewMetadata(null);
      setSelectedFile(null);
      loadFiles();
    } catch (err) {
      console.error("Upload error:", err);
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Upload failed: ${msg}`);
    }
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setPreviewMetadata(null);
    setSelectedFile(null);
    setStatus('idle');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold tracking-tight">Database</h1>
      </div>

      {status === 'error' && error?.includes('permissions') && (
        <div className={cn(
          "p-6 rounded-3xl space-y-4 border mb-6",
          isDarkMode ? "bg-rose-500/10 border-rose-500/20" : "bg-rose-50 border-rose-200"
        )}>
          <div className="flex items-center gap-3 text-rose-500">
            <ShieldAlert className="w-6 h-6" />
            <h3 className="font-bold">Database Permission Issue Detected</h3>
          </div>
          <p className={cn("text-sm", isDarkMode ? "opacity-70" : "text-slate-600")}>
            Your Azure Cosmos DB permissions are preventing the app from saving data. 
            Please ensure your account has the required roles (e.g., Cosmos DB Built-in Data Contributor).
          </p>
        </div>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center text-center",
          isDragging 
            ? "border-emerald-500 bg-emerald-500/5 scale-[1.02]" 
            : (isDarkMode ? "border-[var(--color-border-dark)] bg-[var(--color-card-bg-dark)]" : "border-slate-200 bg-white shadow-sm"),
          status === 'error' && "border-rose-500 bg-rose-500/5",
          previewData && "border-emerald-500/50 bg-emerald-500/5"
        )}
      >
        <AnimatePresence mode="wait">
          {previewData ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold mb-1">Data Preview</h3>
              <p className="text-sm opacity-50 mb-6">
                Found <span className="font-bold text-emerald-500">{previewData.length.toLocaleString()}</span> records in <span className="font-bold">{previewMetadata.fileName}</span>
              </p>

              <div className={cn(
                "w-full max-h-48 overflow-y-auto rounded-xl border mb-8 text-left",
                isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-200"
              )}>
                <table className="w-full text-[10px] border-collapse">
                  <thead className={cn(
                    "sticky top-0",
                    isDarkMode ? "bg-[var(--color-card-bg-dark)]" : "bg-slate-100"
                  )}>
                    <tr>
                      <th className="px-3 py-2 text-left">Timestamp</th>
                      <th className="px-3 py-2 text-left">Equipment</th>
                      <th className="px-3 py-2 text-right">Load (kW)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-inherit">
                    {previewData.slice(0, 5).map((r, i) => (
                      <tr key={`${r.timestamp}-${r.equipmentName}-${i}`}>
                        <td className="px-3 py-2 opacity-70">{r.timestamp}</td>
                        <td className="px-3 py-2 font-bold">{r.equipmentName}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.actualKW.toFixed(1)}</td>
                      </tr>
                    ))}
                    {previewData.length > 5 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-center opacity-40 italic">
                          ... and {(previewData.length - 5).toLocaleString()} more records
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-4 w-full max-w-sm">
                <button
                  onClick={handleCancelPreview}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold transition-all border",
                    isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)] hover:bg-[var(--color-sidebar-hover-dark)]" : "bg-white border-slate-200 hover:bg-slate-50"
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUpload}
                  disabled={status === 'uploading'}
                  className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                >
                  {status === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {status === 'uploading' ? 'Uploading...' : 'Confirm Upload'}
                </button>
              </div>
            </motion.div>
          ) : status === 'idle' || status === 'parsing' || status === 'uploading' ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <div className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-xl",
                (status === 'parsing' || status === 'uploading') ? "bg-emerald-500 animate-pulse" : "bg-emerald-500/10"
              )}>
                {(status === 'parsing' || status === 'uploading') ? (
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                ) : (
                  <Upload className="w-10 h-10 text-emerald-500" />
                )}
              </div>
              <h3 className="text-xl font-bold mb-2">
                {status === 'parsing' ? 'Processing Data...' : status === 'uploading' ? 'Uploading to Database...' : 'Upload Energy Data'}
              </h3>
              <p className="text-sm opacity-50 mb-8 max-w-xs">
                {status === 'uploading' 
                  ? 'Please wait while we sync large datasets with the secure cloud storage.' 
                  : 'Drag and drop your equipment kW consumption CSV file here.'}
              </p>
              
              {status === 'idle' && (
                <label className="cursor-pointer px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">
                  Select File
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </label>
              )}
            </motion.div>
          ) : status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-8"
            >
              <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/40 relative">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-emerald-500"
                />
                <CheckCircle2 className="w-12 h-12 text-white relative z-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-emerald-500">Upload Successful!</h3>
              <p className="text-sm opacity-60 mb-8 max-w-xs">
                Your energy data has been securely processed and added to the database. 
                <span className="block mt-2 font-bold text-emerald-500/80">{recordCount.toLocaleString()} records synchronized.</span>
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setStatus('idle')}
                  className={cn(
                    "px-6 py-2 rounded-xl text-sm font-bold transition-all border",
                    isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)] hover:bg-[var(--color-sidebar-hover-dark)]" : "bg-white border-slate-200 hover:bg-slate-50"
                  )}
                >
                  Upload More
                </button>
                <button
                  onClick={() => onGoToDashboard?.()}
                  className="px-6 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                >
                  View Dashboard
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <div className="w-20 h-20 rounded-2xl bg-rose-500 flex items-center justify-center mb-6 shadow-xl shadow-rose-500/20">
                <AlertCircle className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-rose-500">Upload Failed</h3>
              <div className="mb-6 max-w-xs">
                <p className="text-sm opacity-90 font-medium mb-1">{error}</p>
                {errorDetails && (
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {errorDetails.row && (
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 text-[10px] font-bold rounded uppercase tracking-wider">
                        Row {errorDetails.row}
                      </span>
                    )}
                    {errorDetails.column && (
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 text-[10px] font-bold rounded uppercase tracking-wider">
                        Col: {errorDetails.column}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setStatus('idle')}
                className={cn(
                  "px-8 py-3 rounded-xl font-bold transition-all",
                  isDarkMode ? "bg-[var(--color-sidebar-hover-dark)] text-white hover:bg-[var(--color-sidebar-active-dark)]" : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                )}
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Format Info */}
        <div className={cn(
          "p-6 rounded-2xl border",
          isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              Expected CSV Format
            </h4>
            <div className="flex gap-2">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-all"
              >
                <Download className="w-3 h-3" />
                Template
              </button>
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 text-rose-500 rounded-lg text-xs font-bold hover:bg-rose-500/20 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear DB
                </button>
              )}
            </div>
          </div>
          <div className={cn(
            "font-mono text-[10px] p-4 rounded-xl overflow-x-auto leading-relaxed",
            isDarkMode ? "bg-[var(--color-main-bg-dark)]" : "bg-slate-50 border border-slate-200 text-slate-600"
          )}>
            <p className="opacity-40 mb-1">Date, Boiler, Boiler, Cooling, Cooling</p>
            <p className="opacity-40 mb-1">, BFP A, ID Fan, CT Fan 1, CT Fan 2</p>
            <p className="opacity-40 mb-1">, kW, kW, kW, kW</p>
            <p className="opacity-40 mb-1">, 450, 320, 150, 140 (Design KW)</p>
            <p className="text-emerald-500/80">2026-02-01, 460, 310, 155, 142</p>
            <p className="text-emerald-500/80">2026-02-02, 455, 300, 152, 138</p>
          </div>
        </div>

        {/* Recent Uploads */}
        <div className={cn(
          "p-6 rounded-2xl border",
          isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
        )}>
          <h4 className="text-sm font-bold flex items-center gap-2 mb-6">
            <FileCheck className="w-4 h-4 text-emerald-500" />
            Recent Uploads
          </h4>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin opacity-20" />
              </div>
            ) : uploadedFiles.length === 0 ? (
              <div className="text-center py-8 opacity-30 text-xs italic">
                No upload history found
              </div>
            ) : (
              uploadedFiles.map((file) => (
                <div 
                  key={file.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors",
                    isDarkMode ? "bg-[var(--color-sidebar-hover-dark)] border-[var(--color-border-dark)]/50 hover:bg-[var(--color-sidebar-active-dark)]" : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{file.fileName}</p>
                    <p className="text-[10px] opacity-50">
                      {(() => {
                        if (!file.uploadedAt) return 'Just now';
                        const date = file.uploadedAt.toDate ? file.uploadedAt.toDate() : new Date(file.uploadedAt);
                        return format(date, 'MMM dd, yyyy HH:mm');
                      })()} • {file.recordCount} records
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => downloadFile(file)}
                      className="p-2 hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {canDelete && (
                      <button 
                        onClick={() => deleteFile(file.id)}
                        className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "w-full max-w-md p-8 rounded-3xl border shadow-2xl",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20">
                  <ShieldAlert className="text-rose-500 w-6 h-6" />
                </div>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="p-2 hover:bg-[var(--color-sidebar-hover-dark)] rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 opacity-50" />
                </button>
              </div>

              <h3 className="text-xl font-bold mb-2">Confirm {fileToDelete ? "File" : "Data"} Deletion</h3>
              <p className="text-sm opacity-50 mb-8">
                {fileToDelete 
                  ? "This action will permanently delete this file record and its associated data from storage." 
                  : "This action will permanently clear all energy readings and upload history. This cannot be undone."}
              </p>

              {deleteStatus === 'success' ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-12 space-y-4"
                >
                  <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30">
                    <CheckCircle2 className="text-white w-10 h-10" />
                  </div>
                  <div className="text-center">
                    <h4 className="text-xl font-bold text-emerald-500 mb-1">{fileToDelete ? "File" : "Database"} Cleared!</h4>
                    <p className="text-sm opacity-50 mb-6">
                      {fileToDelete ? "The file has been removed." : "All records have been permanently removed."}
                    </p>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteStatus('idle');
                        setFileToDelete(null);
                        loadFiles();
                      }}
                      className="px-8 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-4 pt-4">
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteStatus('idle');
                          setFileToDelete(null);
                        }}
                        className="flex-1 py-3 bg-[var(--color-sidebar-hover-dark)] border border-[var(--color-border-dark)] rounded-xl font-bold hover:bg-[var(--color-sidebar-active-dark)] transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteData}
                        disabled={isDeleting}
                        className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Delete"}
                      </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

