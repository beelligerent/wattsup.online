'use client';
import { Type } from "@google/genai";

export type Permission = 
  | 'view_dashboard' 
  | 'view_analytics' 
  | 'view_ai_analyst' 
  | 'manage_data' 
  | 'manage_users' 
  | 'delete_data'
  | 'view_audit_logs'
  | 'view_cost_analytics'
  | 'view_reports'
  | 'view_energy_user';

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem?: boolean;
}

export interface UserPreferences {
  emailNotifications: {
    anomalies: boolean;
    dailySummaries: boolean;
    systemAlerts: boolean;
  };
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: string; // Changed from UserRole to string to support custom roles
  createdAt: any;
  active: boolean;
  company?: string;
  position?: string;
  department?: string;
  approved: boolean;
  preferences?: UserPreferences;
}

export interface AuditLog {
  id?: string;
  user: string; // email or name
  action: string;
  timestamp: any;
  details: string;
}

export interface MeterReading {
  timestamp: string;
  equipmentName: string;
  area: string;
  unit: string;
  baselineKW: number;
  designKW: number;
  actualKW: number;
  kwh: number;
  efficiencyScore: number;
  carbonEmission: number; // in kg CO2
  isAnomaly: boolean;
  anomalyReason?: string;
  fileId?: string; // Link to the uploaded file record
}

export type EfficiencyStatus = 'Efficient' | 'Normal' | 'Inefficient';

export interface EquipmentSummary {
  name: string;
  area: string;
  unit: string;
  baselineKW: number;
  designKW: number;
  avgLoad: number;
  avgKWh: number;
  maxDemand: number;
  minLoad: number;
  totalKWh: number;
  totalKW?: number;
  count?: number;
  avgEfficiency: number;
  efficiencyStatus: EfficiencyStatus;
  totalCarbon: number;
  anomalyCount: number;
  loadFactor: number;
  utilization: number;
  daysOnline: number;
  runningSince: string;
  computedBaseline?: number;
}

export interface AreaSummary {
  area: string;
  totalKW: number;
  totalKWh: number;
  avgEfficiency: number;
  equipmentCount: number;
  carbonEmission: number;
}

export interface DashboardStats {
  totalPlantKW: number;
  totalPlantKWh: number;
  energyIntensity: number;
  totalEquipmentCount: number;
  highestEnergyEquipment: string;
  mostEfficientArea: string;
  totalCarbonEmission: number; // in tons
  anomalyCount: number;
  maxDemand: number; // Add maxDemand to DashboardStats
  potentialSavingsKWh: number;
  totalCostImpact: number;
  daysInPeriod: number;
  topEquipment: EquipmentSummary[];
  allEquipment: EquipmentSummary[];
  areaBreakdown: AreaSummary[];
}

export interface ForecastPoint {
  timestamp: string;
  actual?: number;
  forecast?: number;
  lowerBound?: number;
  upperBound?: number;
}

export interface FilterState {
  dateRange: [Date | null, Date | null];
  areas: string[];
  equipment: string[];
  search: string;
  baselineRange: [Date | null, Date | null];
  baselineFactor: number;
  baselineEquipment?: string[];
  baselineDecimals?: number;
}

export interface AIInsight {
  analysis: string;
  recommendations: string[];
  supportingData?: any;
}

export interface AIReportVisualization {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: {
    label: string;
    value: number;
    color?: string;
  }[];
}

export interface AIReportResponse {
  reportText: string;
  visualizations: AIReportVisualization[];
}

export interface SavedAIReport {
  id: string;
  userId: string;
  userName: string;
  generatedAt: any;
  prompt: string;
  downloadUrl: string;
  storagePath: string;
  reportText?: string;
  visualizations?: AIReportVisualization[];
}

export type DateFilterType = 'daily' | 'monthly' | 'yearly' | 'custom';

export interface GlobalDateFilter {
  type: DateFilterType;
  startDate: string;
  endDate: string;
}

export interface AppSettings {
  defaultStartDate: string;
  defaultEndDate: string;
  defaultDateFilter: GlobalDateFilter;
  updatedAt: any;
  updatedBy: string;
}

export interface CostKPIs {
  totalEnergyCost: number;
  costPerKwh: number;
  peakDemandCost: number;
  projectedMonthlyTotal: number;
  totalEnergyCostComparison?: number; // e.g., 5.2% vs Last Month
}

export interface CostRules {
  energyPrice: number; // PHP/kWh
  demandCharge: number; // PHP/kW
  systemLoss: number; // %
  vat: number; // %
  monthlyBudget: number; // PHP
}

export interface CostDistributionItem {
  name: string;
  value: number; // Absolute cost in PHP
  percentage: number; // % contribution
}

export interface Report {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  summary: string;
  storagePath?: string;
  downloadUrl?: string;
  includedSections?: string[];
  customReportData?: CustomReport; // Store the structure of custom reports for editing
}

export interface UploadedFile {
  id: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: any;
  recordCount: number;
  fileSize: number;
  content: string; // Storing the CSV content for download (optional if using storage)
  storagePath?: string;
  downloadUrl?: string;
}

export interface ReportElement {
  id: string;
  type: 'header' | 'footer' | 'title' | 'text' | 'chart' | 'table' | 'image' | 'author-info' | 'logo';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: any;
  style: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    backgroundColor?: string;
    padding?: number;
    borderRadius?: number;
    borderColor?: string;
    borderWidth?: number;
    paddingTop?: number;
    paddingBottom?: number;
  };
  filters?: {
    area?: string;
    areas?: string[];
    equipment?: string[];
    startDate?: string;
    endDate?: string;
    chartType?: 'line' | 'bar' | 'area';
    tableType?: 'summary' | 'detailed';
    unit?: 'kwh' | 'kw';
    trendType?: 'daily' | 'monthly' | 'yearly';
  };
}

export interface ReportPage {
  id: string;
  elements: ReportElement[];
}

export interface CustomReport {
  id?: string;
  reportTitle: string;
  logo?: string;
  name: string;
  position: string;
  company: string;
  department?: string;
  pages: ReportPage[];
  createdAt?: any;
  updatedAt?: any;
}
