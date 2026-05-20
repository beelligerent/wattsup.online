'use client';
import { msalInstance, loginRequest } from "../auth/msalConfig";

/**
 * Example of how to make a protected API call using MSAL tokens
 */
export const ExampleProtectedService = {
  async getProtectedData() {
    const account = msalInstance.getActiveAccount();
    if (!account) {
      throw new Error("No active account found. Please log in.");
    }

    try {
      // Silently acquire token
      const tokenResponse = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: account
      });

      const accessToken = tokenResponse.accessToken;

      // Use the token in your API call
      const response = await fetch("/api/protected-data", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error acquiring token or fetching data:", error);
      
      // If silent acquisition fails, you might need to acquire token via popup or redirect
      // msalInstance.acquireTokenRedirect(loginRequest);
      
      throw error;
    }
  }
};
