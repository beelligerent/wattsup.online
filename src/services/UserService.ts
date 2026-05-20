'use client';
import { CosmosService } from "./CosmosService";
import { UserProfile, CustomRole } from "../types";

const CONTAINER_NAME = "users";

export const UserService = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!CosmosService.isConfigured) return null;
    try {
      const container = await CosmosService.getContainer(CONTAINER_NAME);
      const { resource } = await container.item(uid, uid).read();
      return resource as UserProfile || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      console.error("Cosmos DB Error (getUserProfile):", error);
      return null;
    }
  },

  async getAllUsers(): Promise<UserProfile[]> {
    if (!CosmosService.isConfigured) return [];
    try {
      return await CosmosService.getAllItems<UserProfile>(CONTAINER_NAME, "SELECT * FROM c ORDER BY c.createdAt DESC");
    } catch (error: any) {
      console.error("Cosmos DB Error (getAllUsers):", error);
      return [];
    }
  },

  async createUserProfile(profile: UserProfile): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      await CosmosService.upsertItem(CONTAINER_NAME, {
        ...profile,
        id: profile.uid, // Cosmos DB requires 'id'
        createdAt: profile.createdAt instanceof Date ? profile.createdAt.toISOString() : profile.createdAt
      });
    } catch (error: any) {
      console.error("Cosmos DB Error (createUserProfile):", error);
    }
  },

  async createUser(email: string, name: string, role: string): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      const uid = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await CosmosService.upsertItem(CONTAINER_NAME, {
        id: uid,
        uid,
        email,
        name,
        role,
        approved: false,
        active: true,
        createdAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Cosmos DB Error (createUser):", error);
    }
  },

  async updateUserRole(uid: string, role: string): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      const profile = await this.getUserProfile(uid);
      if (profile) {
        await CosmosService.upsertItem(CONTAINER_NAME, { ...profile, role });
      }
    } catch (error: any) {
      console.error("Cosmos DB Error (updateUserRole):", error);
    }
  },

  async updateUserStatus(uid: string, active: boolean): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      const profile = await this.getUserProfile(uid);
      if (profile) {
        await CosmosService.upsertItem(CONTAINER_NAME, { ...profile, active });
      }
    } catch (error: any) {
      console.error("Cosmos DB Error (updateUserStatus):", error);
    }
  },

  async deleteUser(uid: string, adminToken?: string): Promise<void> {
    // For Azure migration, this might need to call a different endpoint or handle Entra ID user deletion
    if (adminToken) {
      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid, adminToken }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to delete user";
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch (e) {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
    }
    
    // Also delete from Cosmos DB
    if (CosmosService.isConfigured) {
      try {
        await CosmosService.deleteItem(CONTAINER_NAME, uid, uid);
      } catch (error) {
        console.error("Cosmos DB Error (deleteUser):", error);
      }
    }
  },

  async updateUserPreferences(uid: string, preferences: any): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      const profile = await this.getUserProfile(uid);
      if (profile) {
        await CosmosService.upsertItem(CONTAINER_NAME, { ...profile, preferences });
      }
    } catch (error: any) {
      console.error("Cosmos DB Error (updateUserPreferences):", error);
    }
  },

  async updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      const profile = await this.getUserProfile(uid);
      if (profile) {
        await CosmosService.upsertItem(CONTAINER_NAME, { ...profile, ...data });
      }
    } catch (error: any) {
      console.error("Cosmos DB Error (updateUserProfile):", error);
    }
  },

  async approveUser(uid: string, role: string): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      const profile = await this.getUserProfile(uid);
      if (profile) {
        await CosmosService.upsertItem(CONTAINER_NAME, { 
          ...profile,
          approved: true,
          role: role
        });
      }
    } catch (error: any) {
      console.error("Cosmos DB Error (approveUser):", error);
    }
  },

  async changeUserPassword(uid: string, newPassword: string, adminToken?: string): Promise<void> {
    // For Azure, password management is handled by Entra ID
    // This endpoint would need to be updated to use Microsoft Graph API
    if (adminToken) {
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid, newPassword, adminToken }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to change password";
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch (e) {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
    }
  }
};

export const DEFAULT_ROLES: CustomRole[] = [
  { 
    id: 'admin', 
    name: 'Administrator', 
    description: 'Full system access', 
    permissions: ['view_dashboard', 'view_analytics', 'view_ai_analyst', 'manage_data', 'manage_users', 'delete_data', 'view_audit_logs', 'view_cost_analytics', 'view_reports', 'view_energy_user'], 
    isSystem: true 
  },
  { 
    id: 'engineer', 
    name: 'Performance Engineer', 
    description: 'Technical and data management', 
    permissions: ['view_dashboard', 'view_analytics', 'view_ai_analyst', 'manage_data', 'delete_data', 'view_cost_analytics', 'view_reports', 'view_energy_user'], 
    isSystem: true 
  },
  { 
    id: 'management', 
    name: 'Management', 
    description: 'View analytics and AI insights', 
    permissions: ['view_dashboard', 'view_analytics', 'view_ai_analyst', 'view_cost_analytics', 'view_reports', 'view_energy_user'], 
    isSystem: true 
  },
  { 
    id: 'operations', 
    name: 'Operations', 
    description: 'Basic dashboard access', 
    permissions: ['view_dashboard', 'view_analytics', 'view_ai_analyst', 'view_energy_user'], 
    isSystem: true 
  },
  { 
    id: 'pending', 
    name: 'Pending', 
    description: 'Awaiting admin approval', 
    permissions: [], 
    isSystem: true 
  },
];
