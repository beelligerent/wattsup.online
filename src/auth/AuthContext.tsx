'use client';
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { UserProfile, CustomRole, Permission } from '../types';
import { UserService, DEFAULT_ROLES } from '../services/UserService';
import { DataService } from '../services/DataService';
import { loginRequest, msalConfig } from './msalConfig';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  role: CustomRole | null;
  loading: boolean;
  hasPermission: (permission: Permission) => boolean;
  isAdmin: boolean;
  isConfigured: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  bypassLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<CustomRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [bypassUser, setBypassUser] = useState<any | null>(null);
  // FIX: Track if redirect has been handled to avoid duplicate calls
  const redirectHandled = useRef(false);
  // FIX: Track if auth effect has run to prevent race conditions
  const authEffectRan = useRef(false);

  // FIX: Handle redirect response once on mount — must be the first thing called
  useEffect(() => {
    if (redirectHandled.current) return;
    redirectHandled.current = true;

    const handleRedirect = async () => {
      try {
        // handleRedirectPromise() must always be called on every page load
        // It resolves the redirect response if present, or null if not
        const response = await instance.handleRedirectPromise();
        if (response && response.account) {
          console.log("[Auth] Redirect login success:", response.account.username);
          instance.setActiveAccount(response.account);
        }
      } catch (error: any) {
        // FIX: Specific error handling for common MSAL redirect errors
        if (error.errorCode === 'interaction_in_progress') {
          console.warn("[Auth] Interaction already in progress, clearing cache...");
          // Clear any stale interaction state
          sessionStorage.removeItem('msal.interaction.status');
        } else {
          console.error("[Auth] Redirect handling error:", error);
        }
      }
    };

    handleRedirect();
  }, [instance]);

  const login = async () => {
    try {
      // FIX: Check for interaction_in_progress before starting new interaction
      if (inProgress !== InteractionStatus.None) {
        console.warn("[Auth] Interaction already in progress:", inProgress);
        return;
      }
      await instance.loginRedirect({
        ...loginRequest,
        redirectUri: msalConfig.auth.redirectUri,
      });
    } catch (error: any) {
      if (error.errorCode === 'interaction_in_progress') {
        // FIX: Clear stale session storage and retry
        console.warn("[Auth] Clearing stale interaction state and retrying...");
        sessionStorage.clear();
        window.location.reload();
      } else {
        console.error("[Auth] Login failed:", error);
      }
    }
  };

  const logout = async () => {
    try {
      if (bypassUser) {
        setBypassUser(null);
        setProfile(null);
        setRole(null);
        return;
      }
      // FIX: Clear active account before logout redirect
      instance.setActiveAccount(null);
      await instance.logoutRedirect({
        postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri,
      });
    } catch (error) {
      console.error("[Auth] Logout failed:", error);
    }
  };

  const refreshUser = async () => {
    if (bypassUser) {
      const userProfile = await UserService.getUserProfile(bypassUser.localAccountId);
      if (userProfile) {
        setProfile(userProfile);
        const userRole = DEFAULT_ROLES.find(r => r.id === userProfile.role);
        setRole(userRole || null);
      }
      return;
    }

    if (isAuthenticated && accounts.length > 0) {
      const account = instance.getActiveAccount() || accounts[0];
      try {
        const userProfile = await UserService.getUserProfile(account.localAccountId);
        if (userProfile) {
          setProfile(userProfile);
          const userRole = DEFAULT_ROLES.find(r => r.id === userProfile.role);
          setRole(userRole || null);
        }
      } catch (error) {
        console.error("[Auth] Error refreshing user profile:", error);
      }
    }
  };

  const bypassLogin = () => {
    const mockUser = {
      localAccountId: 'admin-bypass-id',
      homeAccountId: 'admin-bypass-id',
      username: 'hbabancio@gmail.com',
      name: 'Admin Bypass',
      idTokenClaims: {
        email: 'hbabancio@gmail.com'
      }
    };
    setBypassUser(mockUser);

    const mockProfile: UserProfile = {
      uid: 'admin-bypass-id',
      name: 'Admin Bypass',
      email: 'hbabancio@gmail.com',
      role: 'admin',
      createdAt: new Date().toISOString(),
      active: true,
      approved: true
    };
    setProfile(mockProfile);
    setRole(DEFAULT_ROLES.find(r => r.id === 'admin') || null);
    setLoading(false);
  };

  useEffect(() => {
    if (bypassUser) return;

    const handleAuth = async () => {
      // FIX: Wait for MSAL to finish any in-progress interaction before checking state
      if (inProgress !== InteractionStatus.None) {
        return; // Effect will re-run when inProgress changes to None
      }

      if (isAuthenticated && accounts.length > 0) {
        // FIX: Always prefer getActiveAccount(), fallback to first account
        const account = instance.getActiveAccount() || accounts[0];

        // FIX: Ensure active account is set
        if (!instance.getActiveAccount()) {
          instance.setActiveAccount(account);
        }

        console.log("[Auth] User authenticated:", account.username);

        try {
          let userProfile = await UserService.getUserProfile(account.localAccountId);

          // Bootstrap: designated admin emails get auto-promoted
          const adminEmails = ['hbsordilla@gmail.com', 'hbabancio@gmail.com'];
          // FIX: Properly extract email from multiple possible locations in MSAL account object
          const userEmail = account.username ||
            (account.idTokenClaims as any)?.email ||
            (account.idTokenClaims as any)?.preferred_username ||
            '';
          const isAdminEmail = userEmail ? adminEmails.includes(userEmail.toLowerCase()) : false;

          if (!userProfile && userEmail) {
            console.log("[Auth] Bootstrapping new user profile for:", userEmail);
            userProfile = {
              uid: account.localAccountId,
              name: account.name || userEmail.split('@')[0],
              email: userEmail,
              role: isAdminEmail ? 'admin' : 'pending',
              createdAt: new Date().toISOString(),
              active: true,
              approved: isAdminEmail,
            };
            await UserService.createUserProfile(userProfile);
          } else if (userProfile && isAdminEmail && (userProfile.role !== 'admin' || !userProfile.approved)) {
            console.log("[Auth] Promoting to admin:", userEmail);
            userProfile.role = 'admin';
            userProfile.approved = true;
            await UserService.updateUserProfile(userProfile.uid, { role: 'admin', approved: true });
          }

          if (userProfile) {
            const userRole = DEFAULT_ROLES.find(r => r.id === userProfile!.role);
            setRole(userRole || null);
            setProfile(userProfile);
            // Log login event — only on first load (authEffectRan guards double-fire)
            if (!authEffectRan.current) {
              authEffectRan.current = true;
              DataService.addAuditLog(
                'Login',
                `User logged in from ${typeof window !== 'undefined' ? window.location.hostname : 'unknown'}`,
                userEmail || account.username
              ).catch(() => {});
            }
          }
        } catch (error) {
          console.error("[Auth] Error fetching user profile from Cosmos DB:", error);
        }
      } else {
        console.log("[Auth] User not authenticated");
      }

      setLoading(false);
    };

    handleAuth();
  }, [isAuthenticated, accounts, inProgress, instance, bypassUser]);

  const hasPermission = useCallback((permission: Permission) => {
    if (!role) return false;
    return role.permissions.includes(permission);
  }, [role]);

  // FIX: Properly compute loading state — only loading during actual interactions
  const isLoading = loading || (!bypassUser && inProgress !== InteractionStatus.None);

  const value = {
    user: bypassUser || (accounts.length > 0 ? (instance.getActiveAccount() || accounts[0]) : null),
    profile,
    role,
    loading: isLoading,
    hasPermission,
    isAdmin: role?.id === 'admin',
    isConfigured: !!(process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || "d6a08ece-2963-411b-98e7-8e8402958559"),
    login,
    logout,
    refreshUser,
    bypassLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
