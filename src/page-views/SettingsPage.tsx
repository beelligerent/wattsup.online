'use client';
import React from 'react';
import { Settings, Bell, Shield, Database, Globe, Moon, Sun, Monitor, Lock as LockIcon, Loader2, User as UserIcon, Check, Mail, Book, Calendar, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../auth/AuthContext';
import { UserService } from '../services/UserService';
import { SystemSettingsService } from '../services/SystemSettingsService';
import { BlobStorageService } from '../services/BlobStorageService';
import { UserPreferences, DateFilterType } from '../types';
import { UserManual } from '../components/UserManual';
import { useData } from '../DataContext';
import { useStore } from '../store/useStore';

interface SettingsPageProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  costRate: number;
  setCostRate: (rate: number) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ 
  isDarkMode, 
  toggleDarkMode, 
  costRate, 
  setCostRate 
}) => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = React.useState('general');
  const [passwords, setPasswords] = React.useState({ current: '', new: '', confirm: '' });
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = React.useState(false);

  const [emailData, setEmailData] = React.useState({ newEmail: '', password: '' });
  const [isChangingEmail, setIsChangingEmail] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = React.useState(false);

  // Notification Preferences State
  const [preferences, setPreferences] = React.useState<UserPreferences>({
    emailNotifications: {
      anomalies: profile?.preferences?.emailNotifications?.anomalies ?? true,
      dailySummaries: profile?.preferences?.emailNotifications?.dailySummaries ?? false,
      systemAlerts: profile?.preferences?.emailNotifications?.systemAlerts ?? true,
    }
  });
  const [isSavingPreferences, setIsSavingPreferences] = React.useState(false);
  const [prefSuccess, setPrefSuccess] = React.useState(false);

  React.useEffect(() => {
    if (profile?.preferences) {
      setPreferences(profile.preferences);
    }
  }, [profile]);

  const { globalSettings, updateGlobalSettings } = useData();
  const { generalSettings } = useStore();
  const [defaultDates, setDefaultDates] = React.useState({
    start: globalSettings?.defaultDateFilter?.startDate || globalSettings?.defaultStartDate || '2026-01-01',
    end: globalSettings?.defaultDateFilter?.endDate || globalSettings?.defaultEndDate || '2026-01-31',
    type: globalSettings?.defaultDateFilter?.type || 'custom' as DateFilterType
  });
  const [isUpdatingDates, setIsUpdatingDates] = React.useState(false);
  const [dateSuccess, setDateSuccess] = React.useState(false);

  // Logo Management State
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const [logoSuccess, setLogoSuccess] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (generalSettings?.logoUrl) {
      setLogoUrl(generalSettings.logoUrl);
    } else {
      setLogoUrl(null);
    }
  }, [generalSettings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setLogoSuccess(false);

    try {
      const storagePath = `system/logo_${Date.now()}_${file.name}`;
      const url = await BlobStorageService.uploadFile(file, storagePath);
      
      await SystemSettingsService.updateLogo(url);
      setLogoSuccess(true);
      setTimeout(() => setLogoSuccess(false), 3000);
    } catch (error) {
      console.error("Logo upload failed:", error);
      alert("Failed to upload logo. Please check your permissions.");
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm("Are you sure you want to remove the custom logo?")) return;
    
    setIsUploadingLogo(true);
    try {
      // If there's an existing URL, we could try to extract the path and delete it,
      // but for simplicity we'll just clear the reference.
      await SystemSettingsService.updateLogo('');
      setLogoUrl(null);
    } catch (error) {
      console.error("Failed to remove logo:", error);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  React.useEffect(() => {
    if (globalSettings) {
      setDefaultDates({
        start: globalSettings.defaultDateFilter?.startDate || globalSettings.defaultStartDate,
        end: globalSettings.defaultDateFilter?.endDate || globalSettings.defaultEndDate,
        type: globalSettings.defaultDateFilter?.type || 'custom'
      });
    }
  }, [globalSettings]);

  const handleUpdateDefaultDates = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingDates(true);
    setDateSuccess(false);
    try {
      await updateGlobalSettings({
        defaultDateFilter: {
          type: defaultDates.type,
          startDate: defaultDates.start,
          endDate: defaultDates.end
        },
        // Keep legacy fields for compatibility
        defaultStartDate: defaultDates.start,
        defaultEndDate: defaultDates.end
      });
      setDateSuccess(true);
      setTimeout(() => setDateSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update default dates:", error);
    } finally {
      setIsUpdatingDates(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!profile?.uid) return;
    setIsSavingPreferences(true);
    setPrefSuccess(false);
    try {
      await UserService.updateUserPreferences(profile.uid, preferences);
      setPrefSuccess(true);
      setTimeout(() => setPrefSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const togglePreference = (key: keyof UserPreferences['emailNotifications']) => {
    setPreferences(prev => ({
      ...prev,
      emailNotifications: {
        ...prev.emailNotifications,
        [key]: !prev.emailNotifications[key]
      }
    }));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwords.new !== passwords.confirm) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (passwords.new.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    setIsChangingPassword(true);
    // Password management is now handled by Microsoft Entra ID
    setPasswordError("Password management is handled by Microsoft Entra ID. Please use the Microsoft account portal to change your password.");
    setIsChangingPassword(false);
    return;
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(false);

    if (!profile?.uid) return;

    setIsChangingEmail(true);
    // Email management is now handled by Microsoft Entra ID
    setEmailError("Email management is handled by Microsoft Entra ID. Please contact your administrator to change your primary email address.");
    setIsChangingEmail(false);
    return;
  };

  return (
    <div className="w-full space-y-8 pb-12">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="opacity-50">Manage your application preferences and system configuration</p>
      </div>

      {/* Top Tab Navigation */}
      <div className={cn(
        "flex items-center gap-1 border-b overflow-x-auto scrollbar-hide pb-px",
        isDarkMode ? "border-white/10" : "border-slate-200"
      )}>
        {[
          { id: 'general', label: 'General', icon: Settings },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'security', label: 'Security', icon: Shield },
          { id: 'data', label: 'Data Management', icon: Database },
          { id: 'manual', label: 'User Manual', icon: Book },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-all",
              activeTab === item.id
                ? "border-emerald-500 text-emerald-500"
                : cn("border-transparent", isDarkMode ? "text-white/50 hover:text-white/80" : "text-slate-500 hover:text-slate-800")
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Full-width content */}
      <div className="w-full space-y-6">
          {activeTab === 'general' && (
            <>
              {/* User Credentials Section */}
              <section className={cn(
                "p-6 rounded-3xl border",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
              )}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold">User Credentials</h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className={cn(
                    "p-4 rounded-2xl border",
                    isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-100"
                  )}>
                    <p className="text-[10px] uppercase font-bold opacity-40 mb-1">Full Name</p>
                    <p className="text-sm font-bold">{profile?.name || 'N/A'}</p>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl border",
                    isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-100"
                  )}>
                    <p className="text-[10px] uppercase font-bold opacity-40 mb-1">Email Address</p>
                    <p className="text-sm font-bold">{profile?.email || 'N/A'}</p>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl border",
                    isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-100"
                  )}>
                    <p className="text-[10px] uppercase font-bold opacity-40 mb-1">Role</p>
                    <p className="text-sm font-bold capitalize">{profile?.role || 'N/A'}</p>
                  </div>
                </div>
              </section>

              {/* Appearance Section */}
              <section className={cn(
                "p-6 rounded-3xl border",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
              )}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold">Appearance</h3>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">Theme Mode</p>
                      <p className="text-xs opacity-50">Choose between light and dark interface</p>
                    </div>
                    <div className={cn(
                      "flex p-1 rounded-xl border",
                      isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-100 border-slate-200"
                    )}>
                      <button 
                        onClick={() => isDarkMode && toggleDarkMode()}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          !isDarkMode ? "bg-white shadow-sm text-emerald-500" : "text-white/40 hover:text-white"
                        )}
                      >
                        <Sun className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => !isDarkMode && toggleDarkMode()}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          isDarkMode ? "bg-emerald-500 shadow-sm text-white" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        <Moon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* System Info */}
              <section className={cn(
                "p-6 rounded-3xl border",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
              )}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold">System Information</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={cn(
                    "p-4 rounded-2xl border",
                    isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-100"
                  )}>
                    <p className="text-[10px] uppercase font-bold opacity-40 mb-1">Version</p>
                    <p className="text-sm font-bold">v2.4.0-stable</p>
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl border",
                    isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-100"
                  )}>
                    <p className="text-[10px] uppercase font-bold opacity-40 mb-1">Environment</p>
                    <p className="text-sm font-bold text-emerald-500">Production</p>
                  </div>
                </div>
              </section>

              {/* System Branding - Admin Only */}
              {profile?.role === 'admin' && (
                <section className={cn(
                  "p-6 rounded-3xl border",
                  isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold">System Branding</h3>
                        <p className="text-xs opacity-50">Upload a custom logo to be used across the application</p>
                      </div>
                    </div>
                    {logoSuccess && (
                      <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold animate-in fade-in slide-in-from-right-4">
                        <Check className="w-4 h-4" />
                        Updated
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    <div className={cn(
                      "w-32 h-32 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden",
                      isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-200"
                    )}>
                        {logoUrl ? (
                          <img src={logoUrl} alt="System Logo" className="max-w-full max-h-full object-contain p-2" />
                        ) : (
                          <ImageIcon className="w-8 h-8 opacity-20" />
                        )}
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap gap-3">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleLogoUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingLogo}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all disabled:opacity-50"
                          >
                            {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {logoUrl ? "Change Logo" : "Upload Logo"}
                          </button>
                          {logoUrl && (
                            <button
                              onClick={handleRemoveLogo}
                              disabled={isUploadingLogo}
                              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-500 rounded-xl text-sm font-bold hover:bg-rose-500/20 transition-all disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] opacity-50">
                          Recommended: PNG or SVG with transparent background. Max height 160px.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <section className={cn(
                "p-6 rounded-3xl border",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
              )}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                    <LockIcon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold">Security Management</h3>
                </div>

                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 text-blue-500 text-sm">
                  <p className="font-bold mb-1">Managed Authentication</p>
                  <p className="opacity-80">
                    Your account is managed via Microsoft Entra ID. Password changes and email updates must be performed through your organization's identity portal.
                  </p>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <section className={cn(
                "p-6 rounded-3xl border",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
              )}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold">Notification Preferences</h3>
                      <p className="text-xs opacity-50">Choose how you want to be notified</p>
                    </div>
                  </div>
                  {prefSuccess && (
                    <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold animate-in fade-in slide-in-from-right-4">
                      <Check className="w-4 h-4" />
                      Saved
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className={cn(
                    "p-4 rounded-2xl border",
                    isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-100"
                  )}>
                    <div className="flex items-center gap-3 mb-4">
                      <Mail className="w-4 h-4 text-emerald-500" />
                      <h4 className="text-sm font-bold">Email Notifications</h4>
                    </div>
                    
                    <div className="space-y-4">
                      {[
                        { id: 'anomalies', label: 'Anomaly Alerts', desc: 'Get notified immediately when an energy anomaly is detected.' },
                        { id: 'dailySummaries', label: 'Daily Summaries', desc: 'Receive a daily digest of your plant\'s energy performance.' },
                        { id: 'systemAlerts', label: 'System Alerts', desc: 'Important updates regarding system maintenance and status.' },
                      ].map((item) => (
                        <div key={item.id} className="flex items-center justify-between group">
                          <div className="max-w-[80%]">
                            <p className="text-sm font-bold">{item.label}</p>
                            <p className="text-xs opacity-50">{item.desc}</p>
                          </div>
                          <button
                            onClick={() => togglePreference(item.id as keyof UserPreferences['emailNotifications'])}
                            className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                              preferences.emailNotifications[item.id as keyof UserPreferences['emailNotifications']]
                                ? "bg-emerald-500"
                                : (isDarkMode ? "bg-white/10" : "bg-slate-200")
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                preferences.emailNotifications[item.id as keyof UserPreferences['emailNotifications']]
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              )}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleSavePreferences}
                    disabled={isSavingPreferences}
                    className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                  >
                    {isSavingPreferences ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Preferences"}
                  </button>
                </div>
              </section>

              <section className={cn(
                "p-6 rounded-3xl border opacity-50 cursor-not-allowed",
                isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-slate-200 shadow-sm"
              )}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold">Push Notifications</h3>
                </div>
                <p className="text-xs">Browser push notifications are currently disabled for this environment.</p>
              </section>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6">
              {(profile?.role === 'admin' || profile?.role === 'engineer') && (
                <section className={cn(
                  "p-6 rounded-3xl border",
                  isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-violet-500/10 text-violet-500">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold">Global Default Dates</h3>
                        <p className="text-xs opacity-50">Set the default date range for all analytics pages</p>
                      </div>
                    </div>
                    {dateSuccess && (
                      <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold animate-in fade-in slide-in-from-right-4">
                        <Check className="w-4 h-4" />
                        Updated
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleUpdateDefaultDates} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider opacity-50 ml-1">Default Filter Type</label>
                      <select
                        value={defaultDates.type}
                        onChange={(e) => setDefaultDates({ ...defaultDates, type: e.target.value as DateFilterType })}
                        className={cn(
                          "w-full border rounded-xl py-3 px-4 outline-none focus:border-emerald-500 transition-colors appearance-none",
                          isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-200"
                        )}
                      >
                        <option value="daily">Daily</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="custom">Custom Range</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider opacity-50 ml-1">Default Start Date</label>
                        <input
                          type="date"
                          required
                          value={defaultDates.start}
                          onChange={(e) => setDefaultDates({ ...defaultDates, start: e.target.value })}
                          className={cn(
                            "w-full border rounded-xl py-3 px-4 outline-none focus:border-emerald-500 transition-colors",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-200"
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider opacity-50 ml-1">Default End Date</label>
                        <input
                          type="date"
                          required
                          value={defaultDates.end}
                          onChange={(e) => setDefaultDates({ ...defaultDates, end: e.target.value })}
                          className={cn(
                            "w-full border rounded-xl py-3 px-4 outline-none focus:border-emerald-500 transition-colors",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-slate-50 border-slate-200"
                          )}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isUpdatingDates}
                      className="w-full bg-violet-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-violet-500/20 hover:bg-violet-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isUpdatingDates ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Default Settings"}
                    </button>
                  </form>
                </section>
              )}

              <section className={cn(
                "p-6 rounded-3xl border text-center py-12",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
              )}>
                <Database className="w-12 h-12 opacity-20 mx-auto mb-4" />
                <h3 className="font-bold mb-1">Data Management</h3>
                <p className="text-sm opacity-50">Advanced data export and cleanup tools are coming soon.</p>
              </section>
            </div>
          )}

          {activeTab === 'manual' && (
            <UserManual isDarkMode={isDarkMode} />
          )}
      </div>
    </div>
  );
};
