'use client';
import React, { useState } from 'react';
import { Sun, Moon, Zap, LayoutDashboard, BarChart3, FileUp, Settings, LogOut, Sparkles, ShieldCheck, DollarSign, FileText, ExternalLink, Activity, Coins, ArrowLeft } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../auth/AuthContext';

import { DataService } from '../services/DataService';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';

import { Permission } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

// Add a hamburger icon for mobile menu
const HamburgerIcon = ({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="lg:hidden p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-primary-accent)]"
  >
    <div className={cn(
      "w-6 h-0.5 bg-[var(--color-text-dark)] transition-all duration-300",
      isOpen ? "rotate-45 translate-y-1.5" : ""
    )} />
    <div className={cn(
      "w-6 h-0.5 bg-[var(--color-text-dark)] transition-all duration-300 mt-1",
      isOpen ? "opacity-0" : ""
    )} />
    <div className={cn(
      "w-6 h-0.5 bg-[var(--color-text-dark)] transition-all duration-300 mt-1",
      isOpen ? "-rotate-45 -translate-y-1.5" : ""
    )} />
  </button>
);

const PesoIcon = ({ className }: { className?: string }) => (
  <span className={cn("font-bold text-lg leading-none", className)}>₱</span>
);

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, isDarkMode, toggleDarkMode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { profile, hasPermission, role, user, logout } = useAuth();
  

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard' as Permission },
    { id: 'realtime', label: 'Realtime', icon: Activity, url: 'https://172.24.192.7/PIVision/#/', external: true },
    { id: 'energy-user', label: 'Energy User', icon: Zap, permission: 'view_energy_user' as Permission },
    { id: 'analytics', label: 'Equipment Analysis', icon: BarChart3, permission: 'view_analytics' as Permission },
    { id: 'cost-analytics', label: 'Cost Analytics', icon: Coins, permission: 'view_cost_analytics' as Permission },
    { id: 'ai-analyst', label: 'AI Analytics', icon: Sparkles, permission: 'view_ai_analyst' as Permission },
    { id: 'reports', label: 'Reports', icon: FileText, permission: 'view_reports' as Permission },
    { id: 'database', label: 'Database', icon: FileUp, permission: 'manage_data' as Permission },
    { id: 'users', label: 'Admin Panel', icon: ShieldCheck, permissions: ['manage_users', 'view_audit_logs'] as Permission[] },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.permission) {
      return hasPermission(item.permission as Permission);
    }
    if (item.permissions) {
      return item.permissions.some(p => hasPermission(p));
    }
    return true;
  });

  const handleLogout = async () => {
    try {
      if (profile) {
        await DataService.addAuditLog('Logout', 'User logged out', profile.email);
      }
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className={cn(
      "flex min-h-screen transition-colors duration-300",
      isDarkMode ? "bg-[var(--color-main-bg-dark)] text-[var(--color-text-dark)]" : "bg-[var(--color-main-bg-light)] text-[var(--color-text-light)]"
    )}>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-screen transition-all duration-300 z-50 flex flex-col border-r",
        isDarkMode ? "bg-[var(--color-sidebar-bg-dark)] border-[var(--color-border-dark)]" : "bg-[var(--color-sidebar-bg-light)] border-[var(--color-border-light)]",
        isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0",
        isSidebarCollapsed ? "lg:w-20" : "lg:w-64"
      )}>
        <div className="lg:hidden absolute top-4 right-4">
          <HamburgerIcon isOpen={isSidebarOpen} onClick={() => setIsSidebarOpen(false)} />
        </div>
        
        <div className={cn(
          "p-6 flex items-center transition-all duration-300",
          isSidebarCollapsed ? "justify-center px-4" : "gap-3"
        )}>
          <Logo isDarkMode={isDarkMode} collapsed={isSidebarCollapsed} isAnimated={true} />
        </div>

        <nav className="mt-8 px-4 space-y-2 flex-1 overflow-y-auto scrollbar-hide">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.external && item.url) {
                  window.open(item.url, '_blank');
                  return;
                }
                setActiveTab(item.id);
                setIsSidebarOpen(false); // Close sidebar on item click for mobile
              }}
              title={isSidebarCollapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center rounded-xl transition-all duration-200 group relative",
                isSidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                activeTab === item.id
                  ? (isDarkMode ? "bg-[var(--color-sidebar-active-dark)] text-[var(--color-primary-accent)]" : "bg-[var(--color-primary-accent)]/10 text-[var(--color-primary-accent)]")
                  : (isDarkMode ? "text-[var(--color-text-dark)] hover:bg-[var(--color-sidebar-hover-dark)]" : "text-black hover:bg-slate-100")
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-transform duration-200 group-hover:scale-110 shrink-0",
                activeTab === item.id ? "text-[var(--color-primary-accent)]" : "opacity-70"
              )} />
              {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>}
              {!isSidebarCollapsed && item.external && <ExternalLink className="w-3 h-3 opacity-30 ml-auto" />}
              {activeTab === item.id && !item.external && (
                <motion.div
                  layoutId="active-pill"
                  className={cn(
                    "rounded-full bg-[var(--color-primary-accent)]",
                    isSidebarCollapsed ? "absolute right-1 w-1 h-4" : "ml-auto w-1.5 h-1.5"
                  )}
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-white/5 space-y-1">
          {/* Collapse Toggle - Desktop Only */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={cn(
              "hidden lg:flex w-full items-center gap-3 px-4 py-2 mb-2 rounded-xl transition-all text-xs opacity-50 hover:opacity-100",
              isSidebarCollapsed && "justify-center px-0"
            )}
          >
            <div className={cn("transition-transform duration-300", isSidebarCollapsed ? "rotate-180" : "")}>
              <ArrowLeft className="w-4 h-4" />
            </div>
            {!isSidebarCollapsed && <span className="font-medium">Collapse Sidebar</span>}
          </button>

          {/* User Profile */}
          <div className={cn(
            "flex items-center gap-3 px-2 py-2 mb-2 rounded-xl bg-black/5 dark:bg-white/5 transition-all",
            isSidebarCollapsed ? "justify-center px-0" : ""
          )}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
              {profile?.name?.charAt(0) || 'U'}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "text-xs font-semibold truncate leading-none",
                  isDarkMode ? "text-white" : "text-black"
                )}>{profile?.name || user?.displayName || user?.email?.split('@')[0] || 'User'}</p>
                <p className={cn(
                  "text-[9px] opacity-50 uppercase tracking-tighter truncate mt-1",
                  isDarkMode ? "text-white" : "text-black"
                )}>{(role?.name || profile?.role || 'User').charAt(0).toUpperCase() + (role?.name || profile?.role || 'User').slice(1)}</p>
              </div>
            )}
            {!isSidebarCollapsed && (
              <button
                onClick={toggleDarkMode}
                className={cn(
                  "p-1.5 rounded-lg transition-all duration-200 border shrink-0",
                  isDarkMode 
                    ? "bg-white/5 border-white/10 text-[var(--color-secondary-accent)] hover:bg-white/10" 
                    : "bg-white border-[var(--color-border-light)] text-[var(--color-text-muted-light)] hover:bg-slate-50 shadow-sm"
                )}
              >
                {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          <button 
            onClick={() => setActiveTab('settings')}
            title={isSidebarCollapsed ? "Settings" : undefined}
            className={cn(
              "w-full flex items-center rounded-xl transition-all text-sm relative",
              isSidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-2",
              activeTab === 'settings'
                ? (isDarkMode ? "bg-[var(--color-sidebar-active-dark)] text-[var(--color-primary-accent)]" : "bg-[var(--color-primary-accent)]/10 text-[var(--color-primary-accent)]")
                : (isDarkMode ? "text-[var(--color-text-dark)] hover:bg-[var(--color-sidebar-hover-dark)]" : "text-black hover:bg-slate-100")
            )}
          >
            <Settings className={cn(
              "w-4 h-4 transition-transform duration-200 shrink-0",
              activeTab === 'settings' ? "text-[var(--color-primary-accent)]" : "opacity-70"
            )} />
            {!isSidebarCollapsed && <span className="font-medium">Settings</span>}
            {activeTab === 'settings' && (
              <motion.div
                layoutId="active-pill-settings"
                className={cn(
                  "rounded-full bg-[var(--color-primary-accent)]",
                  isSidebarCollapsed ? "absolute right-1 w-1 h-4" : "ml-auto w-1.5 h-1.5"
                )}
              />
            )}
          </button>
          <button 
            onClick={handleLogout}
            title={isSidebarCollapsed ? "Logout" : undefined}
            className={cn(
              "w-full flex items-center rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors text-sm",
              isSidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-2"
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 min-w-0 transition-all duration-300 flex flex-col min-h-screen",
        isSidebarOpen ? "pl-64" : "pl-0",
        isSidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
      )}>
        {/* Mobile Menu Trigger - Minimal floating button */}
        <div className="lg:hidden fixed top-4 left-4 z-40">
          <div className={cn(
            "p-2 rounded-xl shadow-lg border backdrop-blur-md",
            isDarkMode ? "bg-black/20 border-white/10" : "bg-white/80 border-slate-200"
          )}>
            <HamburgerIcon isOpen={isSidebarOpen} onClick={() => setIsSidebarOpen(true)} />
          </div>
        </div>

        <div className="flex-1 p-4 lg:p-8 pt-16 lg:pt-8 flex flex-col min-h-0 w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
