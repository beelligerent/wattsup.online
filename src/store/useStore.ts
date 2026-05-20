'use client';
import { create } from 'zustand';
import { MeterReading, UploadedFile, AuditLog, AppSettings, UserProfile, EquipmentSummary, AreaSummary } from '../types';

interface AppState {
  readings: MeterReading[];
  files: UploadedFile[];
  logs: AuditLog[];
  settings: AppSettings | null;
  generalSettings: any | null;
  userProfile: UserProfile | null;
  equipmentSummaries: EquipmentSummary[];
  areaSummaries: AreaSummary[];
  costRules: any | null;
  roles: any[];
  isLoaded: boolean;
  lastUpdated: string | null;

  // Actions
  setAllData: (data: {
    readings: MeterReading[];
    files: UploadedFile[];
    logs: AuditLog[];
    settings: any[];
    userProfile: UserProfile | null;
    summaries: {
      equipment: EquipmentSummary[];
      area: AreaSummary[];
    };
    costRules?: any[];
    roles?: any[];
    timestamp: string;
  }) => void;

  setSettings: (id: string, settings: any) => void;
  clearData: () => void;
  updateUserProfile: (profile: UserProfile) => void;
  setLoaded: (loaded: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  readings: [],
  files: [],
  logs: [],
  settings: null,
  generalSettings: null,
  userProfile: null,
  equipmentSummaries: [],
  areaSummaries: [],
  costRules: null,
  roles: [],
  isLoaded: false,
  lastUpdated: null,

  setLoaded: (loaded) => set({ isLoaded: loaded }),

  setAllData: (data) => {
    const globalSettings  = data.settings?.find(s => s.id === 'global') || null;
    const generalSettings = data.settings?.find(s => s.id === 'general') || null;
    const costRules       = data.costRules && data.costRules.length > 0 ? data.costRules[0] : null;

    set({
      readings:           data.readings,
      files:              data.files,
      logs:               data.logs,
      settings:           globalSettings,
      generalSettings:    generalSettings,
      userProfile:        data.userProfile,
      equipmentSummaries: data.summaries.equipment,
      areaSummaries:      data.summaries.area,
      costRules:          costRules,
      roles:              data.roles || [],
      isLoaded:           true,
      lastUpdated:        data.timestamp,
    });
  },

  setSettings: (id, settings) => set((state) => ({
    settings:        id === 'global'   ? settings : state.settings,
    generalSettings: id === 'general'  ? settings : state.generalSettings,
  })),

  clearData: () => set({
    readings:           [],
    files:              [],
    logs:               [],
    settings:           null,
    userProfile:        null,
    equipmentSummaries: [],
    areaSummaries:      [],
    costRules:          null,
    roles:              [],
    isLoaded:           false,
    lastUpdated:        null,
  }),

  updateUserProfile: (profile) => set({ userProfile: profile }),
}));
