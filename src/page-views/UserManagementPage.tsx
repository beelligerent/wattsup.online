'use client';
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Shield, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  History,
  Loader2,
  Filter,
  Lock,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { UserService, DEFAULT_ROLES } from '../services/UserService';
import { DataService } from '../services/DataService';
import { UserProfile, AuditLog, CustomRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { useAuth } from '../auth/AuthContext';
import { cn } from '../utils/cn';


interface UserManagementProps {
  isDarkMode?: boolean;
}

export const UserManagementPage: React.FC<UserManagementProps> = ({ isDarkMode = true }) => {
  const { profile: currentUser, hasPermission } = useAuth();

  if (!hasPermission('manage_users') && !hasPermission('view_audit_logs')) {
    return null;
  }

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  type ManagementView = 'users' | 'logs' | 'pending';
  const [view, setView] = useState<ManagementView>('users');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'operations' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeUserMenu, setActiveUserMenu] = useState<string | null>(null);
  const [changingPasswordUser, setChangingPasswordUser] = useState<UserProfile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ uid: string, email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allUsers, allLogs] = await Promise.all([
        UserService.getAllUsers(),
        DataService.getAuditLogs()
      ]);
      setUsers(allUsers);
      setLogs(allLogs);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: string) => {
    try {
      await UserService.updateUserRole(uid, newRole);
      await DataService.addAuditLog('User Role Change', `Changed role of ${uid} to ${newRole}`);
      loadData();
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const handleStatusToggle = async (uid: string, currentStatus: boolean) => {
    try {
      await UserService.updateUserStatus(uid, !currentStatus);
      await DataService.addAuditLog('User Status Change', `Toggled status of ${uid} to ${!currentStatus}`);
      loadData();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleApprove = async (uid: string, role: string) => {
    try {
      await UserService.approveUser(uid, role);
      await DataService.addAuditLog('User Approval', `Approved user ${uid} with role ${role}`);
      loadData();
    } catch (error) {
      console.error("Failed to approve user:", error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await UserService.createUser(newUser.email, newUser.name, newUser.role);
      await DataService.addAuditLog('User Creation', `Created user profile for ${newUser.email} with role ${newUser.role}`);
      setIsAddingUser(false);
      setNewUser({ name: '', email: '', role: 'operations' });
      setNotification({ type: 'success', message: "User profile created successfully." });
      loadData();
    } catch (error: any) {
      console.error("Failed to add user:", error);
      setNotification({ type: 'error', message: error.message || "Failed to add user. Please check your permissions." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirm) return;
    
    setIsSubmitting(true);
    try {
      await UserService.deleteUser(deleteConfirm.uid);
      await DataService.addAuditLog('User Deletion', `Deleted user profile for ${deleteConfirm.email}`, currentUser?.email);
      setNotification({ type: 'success', message: "User deleted successfully." });
      setDeleteConfirm(null);
      loadData();
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      setNotification({ type: 'error', message: error.message || "Failed to delete user." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changingPasswordUser) return;
    
    setIsSubmitting(true);
    try {
      // In Azure AD, password management is typically handled via user flows or Graph API.
      // For now, we'll just show a notification that it's managed by the identity provider.
      setNotification({ 
        type: 'error', 
        message: "Password management is handled through the Microsoft Entra ID portal for this organization." 
      });
      setChangingPasswordUser(null);
      setNewPassword('');
    } catch (error: any) {
      console.error("Failed to change password:", error);
      setNotification({ type: 'error', message: error.message || "Failed to change password." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())) &&
    (view === 'pending' ? !u.approved : u.approved)
  );

  const getRoleBadgeColor = (roleId: string) => {
    switch (roleId) {
      case 'admin': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'engineer': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'management': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'operations': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'pending': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Administration</h2>
          <p className="opacity-50">Manage user access, roles, and security audit logs</p>
        </div>
        <div className={cn(
          "flex items-center gap-2 p-1 rounded-xl border",
          isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"
        )}>
          <button
            onClick={() => setView('users')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
              view === 'users' 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                : (isDarkMode ? "hover:bg-white/5 text-white/50" : "hover:bg-white text-slate-500")
            )}
          >
            <Users className="w-4 h-4" />
            Users
          </button>
          <button
            onClick={() => setView('pending')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 relative",
              view === 'pending' 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                : (isDarkMode ? "hover:bg-white/5 text-white/50" : "hover:bg-white text-slate-500")
            )}
          >
            <ShieldAlert className="w-4 h-4" />
            Pending
            {users.filter(u => !u.approved).length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-slate-950">
                {users.filter(u => !u.approved).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setView('logs')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
              view === 'logs' 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                : (isDarkMode ? "hover:bg-white/5 text-white/50" : "hover:bg-white text-slate-500")
            )}
          >
            <History className="w-4 h-4" />
            Audit Logs
          </button>
        </div>
      </div>

      {view !== 'logs' ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-30" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  "w-full border rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-emerald-500 transition-colors",
                  isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-slate-200"
                )}
              />
            </div>
            <button 
              onClick={() => setIsAddingUser(true)}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
            >
              <UserPlus className="w-5 h-5" />
              Add User
            </button>
          </div>

          <div className={cn(
            "border rounded-3xl overflow-hidden",
            isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
          )}>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={cn(
                    "border-b",
                    isDarkMode ? "border-white/10 bg-white/5" : "border-slate-100 bg-slate-50"
                  )}>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-50">User</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-50">Organization</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-50">Role</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-50">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-50 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={cn(
                "divide-y",
                isDarkMode ? "divide-white/5" : "divide-slate-100"
              )}>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto opacity-20" />
                    </td>
                  </tr>
                ) : filteredUsers.map((user, idx) => (
                  <tr key={`user-row-${user.uid || user.email || idx}`} className={cn(
                    "transition-colors group",
                    isDarkMode ? "hover:bg-white/5" : "hover:bg-slate-50"
                  )}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                          isDarkMode ? "bg-gradient-to-br from-slate-700 to-slate-900 text-slate-400" : "bg-slate-100 text-slate-500"
                        )}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{user.name}</p>
                          <p className="text-xs opacity-50">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-xs font-bold">{user.company || 'N/A'}</p>
                        <p className="text-[10px] opacity-50">{user.department} • {user.position}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => {
                          if (view === 'pending') {
                            handleApprove(user.uid, e.target.value);
                          } else {
                            handleRoleChange(user.uid, e.target.value);
                          }
                        }}
                        className={cn(
                          "text-[10px] font-bold px-3 py-1 rounded-full border outline-none bg-transparent",
                          getRoleBadgeColor(user.role)
                        )}
                      >
                        {DEFAULT_ROLES.map(r => (
                          <option key={r.id} value={r.id} className={isDarkMode ? "bg-zinc-900" : "bg-white"}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      {view === 'pending' ? (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleApprove(user.uid, 'operations')}
                            className="flex items-center gap-2 text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ uid: user.uid, email: user.email })}
                            className="flex items-center gap-2 text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStatusToggle(user.uid, user.active)}
                          className={cn(
                            "flex items-center gap-2 text-xs font-bold",
                            user.active ? 'text-emerald-500' : 'text-rose-500'
                          )}
                        >
                          {user.active ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {user.active ? 'Active' : 'Inactive'}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button 
                        onClick={() => setActiveUserMenu(activeUserMenu === user.uid ? null : user.uid)}
                        className={cn(
                          "p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100",
                          isDarkMode ? "hover:bg-white/10" : "hover:bg-slate-100",
                          activeUserMenu === user.uid && "opacity-100 bg-white/10"
                        )}
                      >
                        <MoreVertical className="w-5 h-5 opacity-50" />
                      </button>
                      
                      {activeUserMenu === user.uid && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setActiveUserMenu(null)}
                          />
                          <div className={cn(
                            "absolute right-6 top-12 w-48 rounded-xl border shadow-xl z-20 overflow-hidden",
                            isDarkMode ? "bg-[var(--color-main-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200"
                          )}>
                            <button
                              onClick={() => {
                                setChangingPasswordUser(user);
                                setActiveUserMenu(null);
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-colors",
                                isDarkMode ? "hover:bg-white/5" : "hover:bg-slate-50"
                              )}
                            >
                              <Lock className="w-4 h-4 text-amber-500" />
                              Change Password
                            </button>
                            <button
                              onClick={() => {
                                handleStatusToggle(user.uid, user.active);
                                setActiveUserMenu(null);
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-colors",
                                isDarkMode ? "hover:bg-white/5" : "hover:bg-slate-50"
                              )}
                            >
                              {user.active ? <XCircle className="w-4 h-4 text-rose-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                              {user.active ? 'Deactivate User' : 'Activate User'}
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirm({ uid: user.uid, email: user.email });
                                setActiveUserMenu(null);
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-rose-500 transition-colors border-t",
                                isDarkMode ? "hover:bg-rose-500/10 border-white/5" : "hover:bg-rose-50 border-slate-100"
                              )}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete User
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ) : (
      <div className={cn(
        "border rounded-3xl overflow-hidden",
        isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200 shadow-sm"
      )}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn(
                "border-b",
                isDarkMode ? "border-white/10 bg-white/5" : "border-slate-100 bg-slate-50"
              )}>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-50">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-50">User</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-50">Action</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider opacity-50">Details</th>
              </tr>
            </thead>
            <tbody className={cn(
              "divide-y",
              isDarkMode ? "divide-white/5" : "divide-slate-100"
            )}>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto opacity-20" />
                  </td>
                </tr>
              ) : logs.map((log, index) => (
                <tr key={`log-row-${log.id || `idx-${index}`}-${log.timestamp?.toMillis?.() || `ts-${index}`}`} className={cn(
                  "transition-colors",
                  isDarkMode ? "hover:bg-white/5" : "hover:bg-slate-50"
                )}>
                  <td className="px-6 py-4 text-sm opacity-50">
                    {log.timestamp ? format(new Date(log.timestamp), 'MMM d, HH:mm:ss') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 font-bold text-sm">{log.user}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                      isDarkMode ? "bg-white/10" : "bg-slate-100"
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm opacity-70">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border",
              notification.type === 'success' 
                ? (isDarkMode ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-emerald-50 border-emerald-100 text-emerald-600")
                : (isDarkMode ? "bg-rose-500/10 border-rose-500/20 text-rose-500" : "bg-rose-50 border-rose-100 text-rose-600")
            )}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <p className="text-sm font-bold">{notification.message}</p>
          </motion.div>
        )}

        {isAddingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingUser(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "relative w-full max-w-md border rounded-3xl p-8 shadow-2xl",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200"
              )}
            >
              <h3 className="text-2xl font-bold mb-6">Add New User</h3>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold opacity-50 uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className={cn(
                      "w-full border rounded-xl py-3 px-4 outline-none focus:border-emerald-500 transition-colors",
                      isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
                    )}
                    placeholder="Enter full name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold opacity-50 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className={cn(
                      "w-full border rounded-xl py-3 px-4 outline-none focus:border-emerald-500 transition-colors",
                      isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
                    )}
                    placeholder="user@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold opacity-50 uppercase tracking-wider">Assign Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className={cn(
                      "w-full border rounded-xl py-3 px-4 outline-none focus:border-emerald-500 transition-colors",
                      isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
                    )}
                  >
                    {DEFAULT_ROLES.map(r => (
                      <option key={r.id} value={r.id} className={isDarkMode ? "bg-zinc-900" : "bg-white"}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingUser(false)}
                    className={cn(
                      "flex-1 px-6 py-3 rounded-xl font-bold transition-all",
                      isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save User"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {changingPasswordUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChangingPasswordUser(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "relative w-full max-w-md border rounded-3xl p-8 shadow-2xl",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200"
              )}
            >
              <h3 className="text-2xl font-bold mb-2">Change Password</h3>
              <p className="text-sm opacity-50 mb-6">Updating password for {changingPasswordUser.email}</p>
              
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold opacity-50 uppercase tracking-wider">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={cn(
                      "w-full border rounded-xl py-3 px-4 outline-none focus:border-emerald-500 transition-colors",
                      isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
                    )}
                    placeholder="Enter new password"
                    autoFocus
                  />
                </div>
                
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setChangingPasswordUser(null);
                      setNewPassword('');
                    }}
                    className={cn(
                      "flex-1 px-6 py-3 rounded-xl font-bold transition-all",
                      isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || newPassword.length < 6}
                    className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "relative w-full max-w-md border rounded-3xl p-8 shadow-2xl",
                isDarkMode ? "bg-[var(--color-card-bg-dark)] border-[var(--color-border-dark)]" : "bg-white border-slate-200"
              )}
            >
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6 border border-rose-500/20">
                <Trash2 className="text-rose-500 w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Delete User?</h3>
              <p className="text-sm opacity-50 mb-8">
                Are you sure you want to delete <span className="font-bold text-rose-500">{deleteConfirm.email}</span>? 
                This action will remove their access and delete their profile from the system. This cannot be undone.
              </p>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className={cn(
                    "flex-1 px-6 py-3 rounded-xl font-bold transition-all",
                    isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-rose-500 text-white rounded-xl font-bold shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete User"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
