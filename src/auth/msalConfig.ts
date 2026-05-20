'use client';

import { Configuration, LogLevel, PublicClientApplication } from '@azure/msal-browser';

const tenantId   = (process.env.NEXT_PUBLIC_AZURE_TENANT_ID   || '9b5844fc-0848-4db1-8feb-9ff689e54e70').trim();
const tenantName = (process.env.NEXT_PUBLIC_AZURE_TENANT_NAME || 'wattsupsmgp').trim();
const clientId   = (process.env.NEXT_PUBLIC_AZURE_CLIENT_ID   || 'd6a08ece-2963-411b-98e7-8e8402958559').trim();

// Safe origin guard — never runs server-side
const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

// Use env var if set, otherwise use current window origin
// This makes the app work on both localhost AND any network IP/domain
const rawRedirectUri = process.env.NEXT_PUBLIC_AZURE_REDIRECT_URI?.trim() || origin;
const redirectUri    = rawRedirectUri.endsWith('/') ? rawRedirectUri.slice(0, -1) : rawRedirectUri;

const authority = `https://${tenantName}.ciamlogin.com/${tenantId}`;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    knownAuthorities:          [`${tenantName}.ciamlogin.com`],
    redirectUri,
    postLogoutRedirectUri:     redirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation:          'localStorage',
    storeAuthStateInCookie: true,
  },
  system: {
    allowRedirectInIframe: true,
    windowHashTimeout:     60000,
    iframeHashTimeout:     6000,
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error)   console.error('[MSAL]', message);
        if (level === LogLevel.Warning) console.warn('[MSAL]', message);
      },
      logLevel:          LogLevel.Warning,
      piiLoggingEnabled: false,
    },
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
  prompt: 'select_account' as const,
};

// Singleton — initialized in MsalInitializer before MsalProvider mounts
export const msalInstance = new PublicClientApplication(msalConfig);
