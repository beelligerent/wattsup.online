'use client';
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { MeterReading, FilterState, DashboardStats, EquipmentSummary, AppSettings, GlobalDateFilter, DateFilterType } from './types';
import { aggregateData } from './utils/EnergyCalculator';
import { DataService } from './services/DataService';
import { SystemSettingsService } from './services/SystemSettingsService';
import { useAuth } from './auth/AuthContext';
import { useStore } from './store/useStore';
import { parseISO, isWithinInterval, format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const DEFAULT_DATE_FILTER: GlobalDateFilter = {
  type: 'custom',
  startDate: '2020-01-01',
  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    .toISOString().split('T')[0]
};

interface DataContextType {
  readings: MeterReading[];
  filteredReadings: MeterReading[];
  stats: DashboardStats;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  appliedDateFilter: GlobalDateFilter;
  tempDateFilter: GlobalDateFilter;
  setTempDateFilter: (filter: Partial<GlobalDateFilter>) => void;
  applyFilters: () => Promise<void>;
  isFilterDirty: boolean;
  setReadings: (newReadings: MeterReading[], fileMetadata?: any) => Promise<void>;
  isLoading: boolean;
  hasInitialLoad: boolean;
  loadProgress: number;
  allAreas: string[];
  allEquipment: string[];
  allEquipmentObjects: { name: string, area: string }[];
  dailyMWGenerated: number;
  setDailyMWGenerated: React.Dispatch<React.SetStateAction<number>>;
  error: string | null;
  refreshData: (forceRefresh?: boolean) => Promise<void>;
  fetchFilteredData: (area?: string, startDate?: string, endDate?: string, forceRefresh?: boolean) => Promise<void>;
  handleExport: (format: 'csv' | 'xlsx') => void;
  globalSettings: AppSettings | null;
  updateGlobalSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    readings,
    isLoaded: hasInitialLoad,
    settings: globalSettings,
    generalSettings,
    equipmentSummaries: precomputedEquipment,
    areaSummaries: precomputedArea,
    setSettings
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dailyMWGenerated, setDailyMWGenerated] = useState(100);

  const [appliedDateFilter, setAppliedDateFilter] = useState<GlobalDateFilter>(DEFAULT_DATE_FILTER);
  const [tempDateFilter, setTempDateFilterState] = useState<GlobalDateFilter>(DEFAULT_DATE_FILTER);

  const [filters, setFilters] = useState<FilterState>({
    dateRange: [new Date(DEFAULT_DATE_FILTER.startDate), new Date(DEFAULT_DATE_FILTER.endDate)],
    areas: [],
    equipment: [],
    search: '',
    baselineRange: [null, null],
    baselineFactor: 100,
    baselineEquipment: [],
    baselineDecimals: 2
  });

  const { user, loading: authLoading, profile } = useAuth();

  const isFilterDirty = useMemo(() => {
    return tempDateFilter.type !== appliedDateFilter.type ||
           tempDateFilter.startDate !== appliedDateFilter.startDate ||
           tempDateFilter.endDate !== appliedDateFilter.endDate;
  }, [tempDateFilter, appliedDateFilter]);

  const setTempDateFilter = (filter: Partial<GlobalDateFilter>) => {
    setTempDateFilterState(prev => ({ ...prev, ...filter }));
  };

  const applyFilters = async () => {
    setAppliedDateFilter(tempDateFilter);
    setFilters(prev => ({
      ...prev,
      dateRange: [new Date(tempDateFilter.startDate), new Date(tempDateFilter.endDate)]
    }));
  };

  // Sync settings from store and handle subscriptions
  useEffect(() => {
    if (!user) return;

    const unsubscribeGeneral = SystemSettingsService.subscribeToSettings((settings) => {
      if (settings) setSettings('general', settings);
    }, 'general');

    const unsubscribeGlobal = SystemSettingsService.subscribeToSettings((settings) => {
      if (settings) setSettings('global', settings);
    }, 'global');

    return () => {
      unsubscribeGeneral();
      unsubscribeGlobal();
    };
  }, [user, setSettings]);

  // Handle global settings changes (date filters)
  useEffect(() => {
    if (globalSettings) {
      if (globalSettings.defaultDateFilter) {
        setAppliedDateFilter(globalSettings.defaultDateFilter);
        setTempDateFilterState(globalSettings.defaultDateFilter);
        setFilters(prev => ({
          ...prev,
          dateRange: [new Date(globalSettings.defaultDateFilter.startDate), new Date(globalSettings.defaultDateFilter.endDate)]
        }));
      }
    }
  }, [globalSettings]);

  const updateGlobalSettings = async (newSettings: Partial<AppSettings>) => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'engineer')) {
      throw new Error('Unauthorized to update global settings');
    }

    try {
      await SystemSettingsService.updateSettings('global', {
        ...newSettings,
        updatedBy: profile.name || profile.email
      });
      await DataService.addAuditLog('Settings Update', 'Global settings updated', profile.email);
    } catch (error) {
      console.error('Failed to update global settings:', error);
      throw error;
    }
  };

  // Helper: resolve userId from every possible source
  const resolveUserId = (): string | null => {
    return useStore.getState().userProfile?.uid
      || user?.localAccountId
      || user?.homeAccountId
      || profile?.uid
      || null;
  };

  const fetchFilteredData = async (area?: string, startDate?: string, endDate?: string, forceRefresh: boolean = false) => {
    try {
      const { PreloadService } = await import('./services/PreloadService');
      const userId = resolveUserId();
      if (userId) {
        await PreloadService.fetchAndStore(userId);
      } else {
        console.warn('[DataContext] fetchFilteredData: no userId available, skipping fetch');
      }
    } catch (err) {
      console.error('[DataContext] fetchFilteredData error:', err);
      throw err;
    }
  };

  const loadData = async (forceRefresh: boolean = false) => {
    if (isLoading) return;

    setIsLoading(true);
    setLoadProgress(10);

    try {
      setLoadProgress(30);
      await fetchFilteredData(
        filters.areas[0],
        appliedDateFilter.startDate,
        appliedDateFilter.endDate,
        forceRefresh
      );
      setLoadProgress(85);
    } catch (e) {
      console.error('Failed to load data:', e);
      setError('Failed to load energy data. Please try again.');
    } finally {
      setLoadProgress(100);
      setTimeout(() => {
        setIsLoading(false);
        setLoadProgress(0);
      }, 500);
    }
  };

  const saveReadings = async (newReadings: MeterReading[], fileMetadata?: any) => {
    try {
      if (newReadings.length === 0) {
        // Clear DB
        await DataService.clearAllReadings();
        // Immediately clear store so UI reflects empty state
        useStore.getState().setAllData({
          readings: [],
          files: [],
          logs: [],
          settings: [],
          userProfile: useStore.getState().userProfile,
          summaries: { equipment: [], area: [] },
          timestamp: new Date().toISOString(),
        });
      } else {
        // Save to Cosmos DB
        await DataService.saveReadings(newReadings, fileMetadata);
      }

      // Clear preload cache so next fetch hits the DB
      const { PreloadService } = await import('./services/PreloadService');
      await PreloadService.clearCache();

      // Re-fetch from Cosmos DB and update store
      const userId = resolveUserId();
      if (userId) {
        await PreloadService.fetchAndStore(userId);
      } else {
        // Fallback: optimistically merge new readings into store
        console.warn('[DataContext] saveReadings: no userId resolved, using optimistic update');
        if (newReadings.length > 0) {
          const currentState = useStore.getState();
          useStore.getState().setAllData({
            readings: [...currentState.readings, ...newReadings],
            files: currentState.files,
            logs: currentState.logs,
            settings: [currentState.settings, currentState.generalSettings].filter(Boolean),
            userProfile: currentState.userProfile,
            summaries: {
              equipment: currentState.equipmentSummaries,
              area: currentState.areaSummaries,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to save readings:', error);
      throw error;
    }
  };

  const filteredReadings = useMemo(() => {
    return readings.filter(r => {
      const matchesSearch = r.equipmentName.toLowerCase().includes(filters.search.toLowerCase()) ||
                           r.area.toLowerCase().includes(filters.search.toLowerCase());
      const matchesArea = filters.areas.length === 0 || filters.areas.includes(r.area);
      const matchesEquip = filters.equipment.length === 0 || filters.equipment.includes(r.equipmentName);
      let matchesDate = true;
      if (filters.dateRange[0] && filters.dateRange[1]) {
        const date = parseISO(r.timestamp);
        matchesDate = isWithinInterval(date, {
          start: filters.dateRange[0],
          end: filters.dateRange[1]
        });
      }
      return matchesSearch && matchesArea && matchesEquip && matchesDate;
    });
  }, [readings, filters]);

  const stats: DashboardStats = useMemo(() => {
    if (filteredReadings.length === 0) {
      return {
        totalPlantKW: 0,
        totalPlantKWh: 0,
        energyIntensity: 0,
        totalEquipmentCount: 0,
        highestEnergyEquipment: 'N/A',
        mostEfficientArea: 'N/A',
        totalCarbonEmission: 0,
        anomalyCount: 0,
        maxDemand: 0,
        potentialSavingsKWh: 0,
        totalCostImpact: 0,
        daysInPeriod: 0,
        topEquipment: [],
        allEquipment: [],
        areaBreakdown: []
      };
    }

    return aggregateData(filteredReadings, dailyMWGenerated, {
      range: filters.baselineRange,
      factor: filters.baselineFactor,
      allReadings: readings,
      appliedEquipment: filters.baselineEquipment,
      decimals: filters.baselineDecimals
    });
  }, [filteredReadings, readings, dailyMWGenerated, filters.baselineRange, filters.baselineFactor, filters.baselineEquipment, filters.baselineDecimals]);

  const allAreas = useMemo(() => {
    return Array.from(new Set(readings.map(r => r.area))).sort();
  }, [readings]);

  const allEquipment = useMemo(() => {
    return Array.from(new Set(readings.map(r => r.equipmentName))).sort();
  }, [readings]);

  const allEquipmentObjects = useMemo(() => {
    const map = new Map<string, { name: string, area: string }>();
    readings.forEach(r => {
      if (!map.has(r.equipmentName)) {
        map.set(r.equipmentName, { name: r.equipmentName, area: r.area });
      }
    });
    return Array.from(map.values());
  }, [readings]);

  const handleExport = (format: 'csv' | 'xlsx') => {
    const dataToExport = filteredReadings.map(r => ({
      Timestamp: r.timestamp,
      Equipment: r.equipmentName,
      Area: r.area,
      'Load (kW)': r.actualKW
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Energy Data');

    if (format === 'xlsx') {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `WattsUp_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws);
      saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `WattsUp_Export_${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const value = {
    readings,
    filteredReadings,
    stats,
    filters,
    setFilters,
    appliedDateFilter,
    tempDateFilter,
    setTempDateFilter,
    applyFilters,
    isFilterDirty,
    setReadings: saveReadings,
    isLoading,
    hasInitialLoad,
    loadProgress: hasInitialLoad ? 100 : 0,
    allAreas,
    allEquipment,
    allEquipmentObjects,
    dailyMWGenerated,
    setDailyMWGenerated,
    error,
    refreshData: loadData,
    fetchFilteredData,
    handleExport,
    globalSettings,
    updateGlobalSettings
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
